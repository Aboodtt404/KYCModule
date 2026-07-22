use candid::{CandidType, Deserialize};
use ic_cdk::api::management_canister::main::raw_rand;
use ic_cdk::api::management_canister::http_request::{
    http_request, CanisterHttpRequestArgument, HttpResponse, HttpMethod, HttpHeader,
};
use ic_cdk_macros::update;
use base64::{engine::general_purpose, Engine as _};
use sha2::{Sha256, Digest};
use std::borrow::Cow;
use std::cell::RefCell;
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    storable::Bound,
    DefaultMemoryImpl, StableBTreeMap, Storable,
};

type Memory = VirtualMemory<DefaultMemoryImpl>;

// Constant-time string equality — prevents OTP timing side-channel.
fn constant_time_eq(a: &str, b: &str) -> bool {
    let ab = a.as_bytes();
    let bb = b.as_bytes();
    if ab.len() != bb.len() { return false; }
    ab.iter().zip(bb.iter()).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

// ── Storable wrapper ──────────────────────────────────────────────────────────

#[derive(Clone, Debug, Default, PartialEq, Eq, PartialOrd, Ord)]
struct Str(String);

impl Storable for Str {
    fn to_bytes(&self) -> Cow<'_, [u8]> { Cow::Borrowed(self.0.as_bytes()) }
    fn from_bytes(bytes: Cow<'_, [u8]>) -> Self {
        Self(String::from_utf8(bytes.into_owned()).unwrap_or_default())
    }
    const BOUND: Bound = Bound::Bounded { max_size: 1024, is_fixed_size: false };
}

// ── Stable storage ────────────────────────────────────────────────────────────

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    /// phone → "otp:expires_at_ns"
    static OTP_STORE: RefCell<StableBTreeMap<Str, Str, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0))))
    );

    /// phone → "1"
    static VERIFIED_PHONES: RefCell<StableBTreeMap<Str, Str, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1))))
    );

    /// "account_sid" / "auth_token" / "from_number" → encrypted hex value
    static TWILIO_CONFIG: RefCell<StableBTreeMap<Str, Str, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(2))))
    );

    /// 32-byte encryption key (hex) set once by controller via set_encryption_key()
    /// Stored in stable memory so it survives upgrades.
    static ENC_KEY: RefCell<StableBTreeMap<Str, Str, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(3))))
    );

    /// Rate limiting: "sms:phone:<number>" or "sms:ip:<ip>" → "count:window_start_ns"
    static RATE_LIMIT: RefCell<StableBTreeMap<Str, Str, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(4))))
    );
}

// ── SHA-256 keystream XOR encryption ─────────────────────────────────────────
// Simple, no external crypto crate. The encryption key is stored separately
// from the data it protects — an attacker reading only the TWILIO_CONFIG map
// cannot decrypt without also reading ENC_KEY.

fn xor_encrypt(plaintext: &str, key_hex: &str) -> String {
    let key_bytes = hex::decode(key_hex).unwrap_or_default();
    if key_bytes.is_empty() { return plaintext.to_string(); }
    let plain = plaintext.as_bytes();
    let mut result = Vec::with_capacity(plain.len());
    let mut offset = 0usize;
    let mut block_idx = 0u64;
    while offset < plain.len() {
        // Derive a 32-byte keystream block from SHA-256(key || block_index)
        let mut h = Sha256::new();
        h.update(&key_bytes);
        h.update(&block_idx.to_le_bytes());
        let stream: [u8; 32] = h.finalize().into();
        for &b in stream.iter() {
            if offset >= plain.len() { break; }
            result.push(plain[offset] ^ b);
            offset += 1;
        }
        block_idx += 1;
    }
    hex::encode(result)
}

fn xor_decrypt(cipher_hex: &str, key_hex: &str) -> Option<String> {
    let cipher = hex::decode(cipher_hex).ok()?;
    let key_bytes = hex::decode(key_hex).unwrap_or_default();
    if key_bytes.is_empty() { return None; }
    let mut result = Vec::with_capacity(cipher.len());
    let mut offset = 0usize;
    let mut block_idx = 0u64;
    while offset < cipher.len() {
        let mut h = Sha256::new();
        h.update(&key_bytes);
        h.update(&block_idx.to_le_bytes());
        let stream: [u8; 32] = h.finalize().into();
        for &b in stream.iter() {
            if offset >= cipher.len() { break; }
            result.push(cipher[offset] ^ b);
            offset += 1;
        }
        block_idx += 1;
    }
    String::from_utf8(result).ok()
}

fn get_enc_key() -> Option<String> {
    ENC_KEY.with(|k| k.borrow().get(&Str("key".into())).map(|s| s.0.clone()))
}

// ── Response type ─────────────────────────────────────────────────────────────

#[derive(CandidType, Deserialize)]
pub struct Response {
    pub success: bool,
    pub message: String,
}

// ── Encryption key management ─────────────────────────────────────────────────

/// Set the 32-byte hex encryption key. Controller only. Run once after deploy.
/// Generate a key: openssl rand -hex 32
/// Example: dfx canister call sms_verification_backend set_encryption_key '("abcdef...64-hex-chars...")'
#[update]
pub fn set_encryption_key(key_hex: String) -> Response {
    if !ic_cdk::api::is_controller(&ic_cdk::caller()) {
        return Response { success: false, message: "Unauthorized.".to_string() };
    }
    if key_hex.len() != 64 || hex::decode(&key_hex).is_err() {
        return Response { success: false, message: "Key must be 64 hex characters (32 bytes).".to_string() };
    }
    // Re-encrypt existing Twilio config with the new key if present
    let old_key = get_enc_key();
    if let Some(old) = old_key {
        let fields = ["account_sid", "auth_token", "from_number"];
        TWILIO_CONFIG.with(|cfg| {
            let mut m = cfg.borrow_mut();
            for field in &fields {
                if let Some(cipher) = m.get(&Str(field.to_string())) {
                    if let Some(plain) = xor_decrypt(&cipher.0, &old) {
                        m.insert(Str(field.to_string()), Str(xor_encrypt(&plain, &key_hex)));
                    }
                }
            }
        });
    }
    ENC_KEY.with(|k| k.borrow_mut().insert(Str("key".into()), Str(key_hex)));
    Response { success: true, message: "Encryption key set. Re-configure Twilio credentials.".to_string() }
}

// ── Twilio config ─────────────────────────────────────────────────────────────

/// Store Twilio credentials encrypted at rest. Controller only.
/// Run after set_encryption_key:
///   dfx canister call sms_verification_backend configure_twilio '("ACxxx", "token", "+1xxx")'
#[update]
pub fn configure_twilio(account_sid: String, auth_token: String, from_number: String) -> Response {
    if !ic_cdk::api::is_controller(&ic_cdk::caller()) {
        return Response { success: false, message: "Unauthorized.".to_string() };
    }
    let key = match get_enc_key() {
        Some(k) => k,
        None => return Response {
            success: false,
            message: "Set encryption key first: set_encryption_key(\"<64 hex chars>\")".to_string(),
        },
    };
    TWILIO_CONFIG.with(|cfg| {
        let mut m = cfg.borrow_mut();
        m.insert(Str("account_sid".into()), Str(xor_encrypt(&account_sid, &key)));
        m.insert(Str("auth_token".into()),  Str(xor_encrypt(&auth_token, &key)));
        m.insert(Str("from_number".into()), Str(xor_encrypt(&from_number, &key)));
    });
    Response { success: true, message: "Twilio credentials encrypted and saved.".to_string() }
}

fn get_twilio_cfg() -> Option<(String, String, String)> {
    let key = get_enc_key()?;
    TWILIO_CONFIG.with(|cfg| {
        let m = cfg.borrow();
        let sid  = xor_decrypt(&m.get(&Str("account_sid".into()))?.0, &key)?;
        let tok  = xor_decrypt(&m.get(&Str("auth_token".into()))?.0, &key)?;
        let from = xor_decrypt(&m.get(&Str("from_number".into()))?.0, &key)?;
        if sid.is_empty() { return None; }
        Some((sid, tok, from))
    })
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

const SMS_WINDOW_NS: u64  = 3_600_000_000_000; // 1 hour
const MAX_PER_PHONE: u32  = 3;
const MAX_PER_CANISTER: u32 = 200; // global safety cap per hour

fn rl_key_phone(phone: &str) -> Str { Str(format!("ph:{}", phone)) }
fn rl_key_global()            -> Str { Str("global".into()) }

/// Returns Err(remaining_secs) if rate limit exceeded, Ok(()) otherwise.
fn check_rate_limit(phone: &str) -> Result<(), String> {
    let now = ic_cdk::api::time();

    let check = |key: &Str, max: u32| -> Result<(), String> {
        RATE_LIMIT.with(|rl| {
            let mut m = rl.borrow_mut();
            let (mut count, window_start) = m.get(key)
                .and_then(|v| {
                    let parts: Vec<&str> = v.0.split(':').collect();
                    let c: u32 = parts.first()?.parse().ok()?;
                    let w: u64 = parts.get(1)?.parse().ok()?;
                    Some((c, w))
                })
                .unwrap_or((0, now));

            // Reset if window expired
            if now - window_start >= SMS_WINDOW_NS {
                count = 0;
            }

            if count >= max {
                let remaining = ((SMS_WINDOW_NS - (now - window_start)) / 1_000_000_000) as u32;
                return Err(format!("Rate limit exceeded. Try again in {} minutes.", remaining / 60 + 1));
            }

            m.insert(key.clone(), Str(format!("{}:{}", count + 1, if count == 0 { now } else { window_start })));
            Ok(())
        })
    };

    check(&rl_key_phone(phone), MAX_PER_PHONE)?;
    check(&rl_key_global(), MAX_PER_CANISTER)?;
    Ok(())
}

// ── OTP helpers ───────────────────────────────────────────────────────────────

async fn generate_otp() -> String {
    let (bytes,) = raw_rand().await.unwrap_or((vec![0; 8],));
    let num = u64::from_le_bytes(bytes[..8].try_into().unwrap_or([0; 8]));
    format!("{:06}", num % 1_000_000)
}

fn otp_encode(otp: &str, expires_at: u64) -> Str { Str(format!("{}:{}", otp, expires_at)) }
fn otp_decode(s: &Str) -> Option<(String, u64)> {
    let mut parts = s.0.splitn(2, ':');
    let otp = parts.next()?.to_string();
    let exp: u64 = parts.next()?.parse().ok()?;
    Some((otp, exp))
}

// ── Public endpoints ──────────────────────────────────────────────────────────

#[update]
pub async fn send_sms(to: String) -> Response {
    if !to.starts_with('+') || to.len() < 8 || !to[1..].chars().all(|c| c.is_ascii_digit()) {
        return Response { success: false, message: "Invalid phone number format.".to_string() };
    }

    // Rate limiting check
    if let Err(msg) = check_rate_limit(&to) {
        return Response { success: false, message: msg };
    }

    let (account_sid, auth_token, from_number) = match get_twilio_cfg() {
        Some(cfg) => cfg,
        None => return Response { success: false, message: "SMS service not configured. Contact the administrator.".to_string() },
    };

    let now = ic_cdk::api::time();

    // Check for still-active OTP
    let existing = OTP_STORE.with(|s| s.borrow().get(&Str(to.clone())));
    if let Some(entry) = existing {
        if let Some((_, expiry)) = otp_decode(&entry) {
            if now < expiry {
                let remaining_secs = (expiry - now) / 1_000_000_000;
                return Response {
                    success: false,
                    message: format!("OTP already sent. Please wait {} seconds.", remaining_secs),
                };
            }
        }
    }

    let otp = generate_otp().await;
    let expires_at = now + 300_000_000_000; // 5 minutes

    OTP_STORE.with(|s| s.borrow_mut().insert(Str(to.clone()), otp_encode(&otp, expires_at)));

    let url = format!("https://api.twilio.com/2010-04-01/Accounts/{}/Messages.json", account_sid);
    let body = format!(
        "To={}&From={}&Body=Your KYC verification code is: {}. Valid for 5 minutes.",
        to, from_number, otp
    );
    let auth = format!("Basic {}", general_purpose::STANDARD.encode(format!("{}:{}", account_sid, auth_token)));

    let request = CanisterHttpRequestArgument {
        url,
        method: HttpMethod::POST,
        headers: vec![
            HttpHeader { name: "Authorization".to_string(), value: auth },
            HttpHeader { name: "Content-Type".to_string(), value: "application/x-www-form-urlencoded".to_string() },
        ],
        body: Some(body.into_bytes()),
        max_response_bytes: Some(2000),
        transform: None,
    };

    match http_request(request, 1_000_000_000).await {
        Ok((HttpResponse { status, body, .. },)) => {
            let code: u32 = status.0.try_into().unwrap_or(0);
            if code == 200 || code == 201 {
                Response { success: true, message: "OTP sent successfully!".to_string() }
            } else {
                Response { success: false, message: format!("SMS error {}: {}", code, String::from_utf8_lossy(&body)) }
            }
        }
        Err(e) => Response { success: false, message: format!("HTTP request failed: {:?}", e) },
    }
}

#[update]
pub fn verify_otp(phone: String, otp: String) -> Response {
    let now = ic_cdk::api::time();
    let entry = OTP_STORE.with(|s| s.borrow().get(&Str(phone.clone())));
    match entry.and_then(|e| otp_decode(&e)) {
        None => Response { success: false, message: "No OTP requested for this phone.".to_string() },
        Some((stored_otp, expiry)) => {
            if now > expiry {
                OTP_STORE.with(|s| s.borrow_mut().remove(&Str(phone)));
                Response { success: false, message: "OTP expired. Please request a new one.".to_string() }
            } else if !constant_time_eq(&stored_otp, &otp) {
                Response { success: false, message: "Invalid OTP.".to_string() }
            } else {
                OTP_STORE.with(|s| s.borrow_mut().remove(&Str(phone.clone())));
                VERIFIED_PHONES.with(|v| v.borrow_mut().insert(Str(phone), Str("1".into())));
                Response { success: true, message: "OTP verified successfully!".to_string() }
            }
        }
    }
}

#[update]
pub fn get_verified_phones() -> Vec<String> {
    VERIFIED_PHONES.with(|v| v.borrow().iter().map(|(k, _)| k.0.clone()).collect())
}
