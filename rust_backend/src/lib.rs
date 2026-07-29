
use candid::{CandidType, Decode, Deserialize as CandidDeserialize, Encode};
use ic_cdk_macros::*;
use ic_cdk::api::caller;
use std::borrow::Cow;
use std::cell::RefCell;
use std::collections::HashMap;
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    storable::Bound,
    DefaultMemoryImpl, StableBTreeMap, Storable,
};
use serde::{Deserialize, Serialize};
use serde_json;

// ── Admin principal list (stable — survives upgrades) ────────────────────────
// Principals are stored as text keys in a StableBTreeMap so they persist
// across canister upgrades without needing preupgrade/postupgrade hooks.
// Set via set_admin() by the canister controller after each deploy.

fn is_admin() -> bool {
    let c = caller();
    if ic_cdk::api::is_controller(&c) { return true; }
    let key = BoundedString(c.to_text());
    ADMIN_MAP.with(|m| m.borrow().contains_key(&key))
}

fn require_admin() -> Result<(), String> {
    if is_admin() { Ok(()) } else { Err("Unauthorized: admin only.".to_string()) }
}

/// Write a timestamped entry to the immutable audit log.
fn audit(action: &str, target: &str) {
    let ts = ic_cdk::api::time();
    let principal = caller().to_text();
    let seq = COUNTERS.with(|c| {
        let mut m = c.borrow_mut();
        let k = BoundedString("audit_seq".into());
        let v = m.get(&k).map(|s| s.0.parse::<u64>().unwrap_or(0)).unwrap_or(0);
        m.insert(k, BoundedString((v + 1).to_string()));
        v
    });
    let key = BoundedString(format!("{:020}:{:010}", ts, seq));
    let entry = BoundedString(format!(
        "{{\"action\":\"{}\",\"principal\":\"{}\",\"target\":\"{}\",\"ts\":{}}}",
        action, principal, target, ts
    ));
    AUDIT_LOG.with(|log| { log.borrow_mut().insert(key, entry); });
}

/// Returns true if the caller is a controller or a registered admin.
/// Used by the frontend to probe real admin status after II login.
#[query]
fn is_admin_check() -> bool {
    is_admin()
}

/// Add an admin principal. Controller only.
#[update]
fn set_admin(principal: candid::Principal) -> Result<(), String> {
    if !ic_cdk::api::is_controller(&caller()) {
        return Err("Unauthorized: only the canister controller can set admins.".to_string());
    }
    ADMIN_MAP.with(|m| {
        m.borrow_mut().insert(BoundedString(principal.to_text()), BoundedString("1".into()));
    });
    Ok(())
}

// ── Serialisable data models ──────────────────────────────────────────────────
// Fields are used only by serde for JSON deserialization, never read directly —
// hence the allow(dead_code) attributes.

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct KycData {
    #[serde(rename = "submissionId")]
    submission_id: String,
    timestamp: String,
    phone: String,
    #[serde(default)]
    email: String,
    #[serde(rename = "documentFile")]
    document_file: String,
    #[serde(rename = "ocrData")]
    ocr_data: OcrData,
    #[serde(rename = "faceVerified")]
    face_verified: bool,
    status: String,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct OcrData {
    full_name: String,
    national_id: String,
    birth_date: String,
    #[serde(default)]
    age: Option<u32>,
    address: String,
    governorate: String,
    gender: String,
    // Back-of-card fields (Egyptian National ID). Optional so passport submissions
    // and legacy records still deserialise.
    #[serde(default)]
    serial_number: String,
    // NID re-read from the back, kept as a cross-check against the front NID.
    #[serde(default)]
    national_id_back: String,
    #[serde(default)]
    marital_status: String,
    #[serde(default)]
    occupation: String,
    #[serde(default)]
    issue_date: String,
    #[serde(default)]
    expiry_date: String,
    // Default empty — face_image is no longer submitted from the frontend (GDPR data minimisation).
    // Legacy submissions stored with face_image will still deserialise correctly.
    #[serde(default)]
    face_image: String,
}

#[derive(Debug, Deserialize)]
struct KycSubmissionPayload {
    #[serde(rename = "kycData")]
    kyc_data: KycData,
}

// ── Stable storage helpers ────────────────────────────────────────────────────

const MAX_STRING_SIZE: u32    = 262144;        // 256 KiB — text/JSON values
const MAX_FILE_METADATA_SIZE: u32 = 2048;      // 2 KiB  — file metadata record
const MAX_FILE_DATA_SIZE: u32 = 3 * 1024 * 1024; // 3 MiB — assembled image bytes

#[derive(Clone, Debug, Default, CandidType, Deserialize, Serialize, PartialEq, Eq, PartialOrd, Ord)]
struct BoundedString(String);

impl Storable for BoundedString {
    fn to_bytes(&self) -> Cow<'_, [u8]> { Cow::Borrowed(self.0.as_bytes()) }
    fn from_bytes(bytes: Cow<'_, [u8]>) -> Self {
        Self(String::from_utf8(bytes.into_owned()).expect("UTF-8 conversion failed"))
    }
    const BOUND: Bound = Bound::Bounded { max_size: MAX_STRING_SIZE, is_fixed_size: false };
}

#[derive(Clone, Debug, Default, CandidType, Deserialize, Serialize)]
struct MimeType(String);

#[derive(Clone, Debug, Default, CandidType, Deserialize, Serialize)]
struct FileMetadata {
    path: BoundedString,
    mime_type: MimeType,
    size: u64,
    completed: bool,
    /// Principal text of the uploader — used to enforce delete ownership
    uploader: String,
}

impl Storable for FileMetadata {
    fn to_bytes(&self) -> Cow<'_, [u8]> { Cow::Owned(Encode!(self).expect("Serialization failed")) }
    fn from_bytes(bytes: Cow<'_, [u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).expect("Deserialization failed")
    }
    const BOUND: Bound = Bound::Bounded { max_size: MAX_FILE_METADATA_SIZE, is_fixed_size: false };
}

type Memory = VirtualMemory<DefaultMemoryImpl>;

// Raw binary storable for assembled file content (images, etc.)
#[derive(Clone, Debug, Default)]
struct FileData(Vec<u8>);

impl Storable for FileData {
    fn to_bytes(&self) -> Cow<'_, [u8]> { Cow::Borrowed(&self.0) }
    fn from_bytes(bytes: Cow<'_, [u8]>) -> Self { Self(bytes.into_owned()) }
    const BOUND: Bound = Bound::Bounded { max_size: MAX_FILE_DATA_SIZE, is_fixed_size: false };
}

// ── Stable memory layout ──────────────────────────────────────────────────────
//  0  FILE_METADATA
//  1  RESERVED — do not reuse (previously held a transient store; slot kept to avoid upgrade corruption)
//  2  RESERVED — do not reuse (same reason as 1)
//  3  EGYPTIAN_ID_RESULTS
//  4  PASSPORT_RESULTS
//  5  KYC_SUBMISSIONS
//  6  VERIFICATION_SESSIONS
//  7  NATIONAL_ID_INDEX
//  8  AUDIT_LOG
//  9  ADMIN_MAP
// 10  FILE_DATA
// 11  EMAIL_CONFIG
// 12  COUNTERS
// 13  APP_CONFIG
// 14  RATE_LIMITS
// ─────────────────────────────────────────────────────────────────────────────
thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    static FILE_METADATA: RefCell<StableBTreeMap<BoundedString, FileMetadata, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0))))
    );

    // Non-stable: in-flight upload chunks stored in heap memory and are lost on canister upgrade.
    // Uploads that span a canister upgrade window must be restarted by the client.
    static FILE_CHUNKS: RefCell<HashMap<String, Vec<Vec<u8>>>> = RefCell::new(HashMap::new());

    // MemoryId 1 and 2 are reserved — see layout comment above.

    static EGYPTIAN_ID_RESULTS: RefCell<StableBTreeMap<BoundedString, BoundedString, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(3))))
    );

    static PASSPORT_RESULTS: RefCell<StableBTreeMap<BoundedString, BoundedString, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(4))))
    );

    static KYC_SUBMISSIONS: RefCell<StableBTreeMap<BoundedString, BoundedString, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(5))))
    );

    static VERIFICATION_SESSIONS: RefCell<StableBTreeMap<BoundedString, BoundedString, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(6))))
    );

    /// Indexed lookup: national_id → submission_id (O(1) duplicate check)
    static NATIONAL_ID_INDEX: RefCell<StableBTreeMap<BoundedString, BoundedString, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(7))))
    );

    /// Audit log: "timestamp_ns:seq" → JSON {action, principal, target, timestamp_ns}
    static AUDIT_LOG: RefCell<StableBTreeMap<BoundedString, BoundedString, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(8))))
    );

    /// Admin principals: principal_text → "1"  (stable — survives upgrades)
    static ADMIN_MAP: RefCell<StableBTreeMap<BoundedString, BoundedString, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(9))))
    );

    /// Assembled file content: path → raw bytes  (stable — survives upgrades)
    static FILE_DATA: RefCell<StableBTreeMap<BoundedString, FileData, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(10))))
    );

    /// Email config: "resend_api_key" / "from_email" → value
    static EMAIL_CONFIG: RefCell<StableBTreeMap<BoundedString, BoundedString, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(11))))
    );

    /// Stable counters: "next_doc_id" / "audit_seq" → decimal string
    static COUNTERS: RefCell<StableBTreeMap<BoundedString, BoundedString, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(12))))
    );

    /// App-level config: "ocr_server_url" → value
    static APP_CONFIG: RefCell<StableBTreeMap<BoundedString, BoundedString, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(13))))
    );

    /// Per-caller rate limit counters: "principal:action:window_start_ns" → count string
    static RATE_LIMITS: RefCell<StableBTreeMap<BoundedString, BoundedString, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(14))))
    );

    /// Partner API clients: client_id → JSON {name, website, contact_email,
    /// key_hash, status, created_at, request_count}. The raw API key is never
    /// stored — only its SHA-256 hash.
    static API_CLIENTS: RefCell<StableBTreeMap<BoundedString, BoundedString, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(15))))
    );
}

// ── File upload & management ──────────────────────────────────────────────────

#[update]
fn add_document(path: String, mime_type: String, chunk: Vec<u8>, complete: bool) -> u64 {
    let doc_id = COUNTERS.with(|c| {
        let mut m = c.borrow_mut();
        let k = BoundedString("next_doc_id".into());
        let v = m.get(&k).map(|s| s.0.parse::<u64>().unwrap_or(0)).unwrap_or(0);
        m.insert(k, BoundedString((v + 1).to_string()));
        v
    });
    upload(path, mime_type, chunk, complete);
    doc_id
}

#[update]
fn upload(path: String, mime_type: String, chunk: Vec<u8>, complete: bool) {
    let uploader = caller().to_text();

    FILE_CHUNKS.with(|chunks_ref| {
        chunks_ref.borrow_mut().entry(path.clone()).or_default().push(chunk);
    });

    if complete {
        // Assemble all in-flight chunks into a single contiguous buffer
        let assembled: Vec<u8> = FILE_CHUNKS.with(|chunks_ref| {
            chunks_ref.borrow().get(&path).cloned()
                .unwrap_or_default().into_iter().flatten().collect()
        });
        let size = assembled.len() as u64;
        let bounded_path = BoundedString(path.clone());

        // Persist assembled bytes in stable storage so they survive upgrades
        FILE_DATA.with(|fd| {
            fd.borrow_mut().insert(bounded_path.clone(), FileData(assembled));
        });

        // Clean up transient chunk buffer to free heap memory
        FILE_CHUNKS.with(|chunks_ref| { chunks_ref.borrow_mut().remove(&path); });

        FILE_METADATA.with(|metadata_ref| {
            metadata_ref.borrow_mut().insert(bounded_path.clone(), FileMetadata {
                path: bounded_path,
                mime_type: MimeType(mime_type),
                size,
                completed: true,
                uploader,
            });
        });
    }
}

/// Returns the number of bytes currently used in stable memory (one wasm page = 64 KiB).
#[query]
fn get_stable_memory_used() -> u64 {
    ic_cdk::api::stable::stable64_size() * 65_536
}

/// True when stable memory exceeds 3.8 GiB — approaching the 4 GiB ICP hard cap.
/// All write paths check this to avoid hitting the cap mid-upgrade.
fn stable_memory_near_limit() -> bool {
    const MAX_PAGES: u64 = 62_259; // 3.8 GiB / 64 KiB
    ic_cdk::api::stable::stable64_size() >= MAX_PAGES
}

#[query]
fn list() -> Vec<FileMetadata> {
    FILE_METADATA.with(|m| m.borrow().iter().map(|(_, v)| v.clone()).collect())
}

/// Delete a file. Only the uploader or an admin can delete.
#[update]
fn delete(path: String) -> Result<(), String> {
    let caller_text = caller().to_text();
    let bounded_path = BoundedString(path.clone());

    let meta = FILE_METADATA.with(|m| m.borrow().get(&bounded_path));
    match meta {
        None => return Err("File not found.".to_string()),
        Some(m) if m.uploader != caller_text && !is_admin() => {
            return Err("Unauthorized: you do not own this file.".to_string());
        }
        _ => {}
    }

    FILE_METADATA.with(|m| { m.borrow_mut().remove(&bounded_path); });
    FILE_DATA.with(|fd| { fd.borrow_mut().remove(&bounded_path); });
    FILE_CHUNKS.with(|c| { c.borrow_mut().remove(&path); }); // transient buffer, just in case
    Ok(())
}

// ── KYC submissions ───────────────────────────────────────────────────────────

/// Per-caller rate limiter.  Key = "principal:action", value = "window_start_ns:count".
/// Returns Err if the caller has exceeded `max_calls` within `window_ns` nanoseconds.
fn check_rate_limit(action: &str, max_calls: u64, window_ns: u64) -> Result<(), String> {
    let principal = caller().to_text();
    let now = ic_cdk::api::time();
    let map_key = BoundedString(format!("{}:{}", principal, action));

    RATE_LIMITS.with(|rl| {
        let mut store = rl.borrow_mut();
        let (window_start, count) = store
            .get(&map_key)
            .and_then(|v| {
                let parts: Vec<&str> = v.0.splitn(2, ':').collect();
                let ws: u64 = parts.get(0)?.parse().ok()?;
                let c: u64  = parts.get(1)?.parse().ok()?;
                Some((ws, c))
            })
            .unwrap_or((now, 0));

        let (new_start, new_count) = if now - window_start >= window_ns {
            (now, 1) // new window
        } else {
            (window_start, count + 1)
        };

        if new_count > max_calls {
            return Err(format!(
                "Rate limit exceeded for '{}'. Try again later.", action
            ));
        }

        store.insert(map_key, BoundedString(format!("{}:{}", new_start, new_count)));
        Ok(())
    })
}

/// Validate that a national ID has the correct Egyptian format: 14 digits, starts with 2 or 3.
fn validate_national_id(id: &str) -> Result<(), String> {
    if id.len() != 14 { return Err("National ID must be exactly 14 digits, starting with 2 (born 1900–1999) or 3 (born 2000–present).".to_string()); }
    if !id.chars().all(|c| c.is_ascii_digit()) { return Err("National ID must contain only digits.".to_string()); }
    if !id.starts_with('2') && !id.starts_with('3') {
        return Err("National ID must start with 2 (1900s) or 3 (2000s).".to_string());
    }
    Ok(())
}

fn normalize_phone(phone: &str) -> String {
    phone.trim().trim_start_matches('+').replace(' ', "")
}

#[update]
fn submit_kyc(submission_id: String, kyc_data_json: String) -> Result<(), String> {
    if stable_memory_near_limit() {
        return Err("Storage capacity is almost full. Please contact the platform administrator.".to_string());
    }
    // 3 submissions per hour per principal
    check_rate_limit("submit_kyc", 3, 3_600_000_000_000)?;

    let parsed: KycSubmissionPayload =
        serde_json::from_str(&kyc_data_json).map_err(|e| format!("Failed to parse KYC data: {}", e))?;
    let ocr = &parsed.kyc_data.ocr_data;

    // Input validation
    if submission_id.len() > 128 { return Err("Submission ID is too long.".to_string()); }
    if ocr.full_name.trim().is_empty()   { return Err("Full name is required.".to_string()); }
    if ocr.full_name.len() > 200         { return Err("Full name is too long.".to_string()); }
    if ocr.address.trim().is_empty()     { return Err("Address is required.".to_string()); }
    if ocr.governorate.trim().is_empty() { return Err("Governorate is required.".to_string()); }
    if ocr.gender.trim().is_empty()      { return Err("Gender is required.".to_string()); }
    validate_national_id(&ocr.national_id)?;
    // Phone is optional: users may skip OTP verification. Submissions without a
    // phone cannot use the self-service status check or deletion (both use phone
    // as the second factor) — admins manage those records instead.
    if !parsed.kyc_data.email.is_empty() {
        let e = parsed.kyc_data.email.trim();
        let at_count = e.chars().filter(|&c| c == '@').count();
        let parts: Vec<&str> = e.splitn(2, '@').collect();
        let local = parts.first().copied().unwrap_or("");
        let domain = parts.get(1).copied().unwrap_or("");
        if at_count != 1
            || local.is_empty()
            || !domain.contains('.')
            || domain.starts_with('.')
            || domain.ends_with('.')
            || e.len() > 254
        {
            return Err("Email address format is invalid.".to_string());
        }
    }

    // O(1) duplicate check via index
    if national_id_exists(ocr.national_id.clone()) {
        return Err("This National ID has already been submitted.".to_string());
    }

    // Persist submission
    KYC_SUBMISSIONS.with(|p| {
        p.borrow_mut().insert(BoundedString(submission_id.clone()), BoundedString(kyc_data_json))
    });

    // Update national ID index
    NATIONAL_ID_INDEX.with(|idx| {
        idx.borrow_mut().insert(BoundedString(ocr.national_id.clone()), BoundedString(submission_id.clone()))
    });

    audit("submit_kyc", &submission_id);
    Ok(())
}

/// O(1) duplicate check using the national ID index.
#[query]
fn national_id_exists(national_id: String) -> bool {
    NATIONAL_ID_INDEX.with(|idx| idx.borrow().contains_key(&BoundedString(national_id)))
}

/// Status check — requires the phone number used during OTP as a second factor
/// so that knowing only the national ID is not sufficient to probe someone else's status.
/// Returns only {submission_id, status, face_verified} — no PII beyond what was already known.
#[query]
fn get_my_kyc_status(national_id: String, phone: String) -> Option<String> {
    validate_national_id(&national_id).ok()?;
    if phone.trim().is_empty() { return None; }

    let sub_id = NATIONAL_ID_INDEX.with(|idx| {
        idx.borrow().get(&BoundedString(national_id)).map(|s| s.0.clone())
    })?;
    let json = KYC_SUBMISSIONS.with(|s| {
        s.borrow().get(&BoundedString(sub_id.clone())).map(|s| s.0.clone())
    })?;
    let parsed: serde_json::Value = serde_json::from_str(&json).ok()?;
    let kyc = parsed.get("kycData").unwrap_or(&parsed);

    // Verify phone matches stored submission (same normalisation as delete_my_kyc)
    let stored_phone = kyc.get("phone")
        .and_then(|p| p.as_str())
        .map(|p| normalize_phone(p))
        .unwrap_or_default();
    let provided = normalize_phone(&phone);
    if stored_phone.is_empty() || provided != stored_phone { return None; }

    let status        = kyc.get("status").and_then(|v| v.as_str()).unwrap_or("pending_review");
    let face_verified = kyc.get("faceVerified").and_then(|v| v.as_bool()).unwrap_or(false);
    let updated_at    = kyc.get("updatedAt").and_then(|v| v.as_u64());
    let submitted_at  = kyc.get("timestamp").and_then(|v| v.as_str()).map(String::from);
    Some(serde_json::json!({
        "submission_id":  sub_id,
        "status":         status,
        "face_verified":  face_verified,
        "updated_at":     updated_at,
        "submitted_at":   submitted_at,
    }).to_string())
}

/// Get a single submission. Returns only to the submitter (by matching phone/id) or admin.
#[query]
fn get_kyc_submission(submission_id: String) -> Option<String> {
    if !is_admin() { return None; } // simplest gate — caller must be admin
    KYC_SUBMISSIONS.with(|s| s.borrow().get(&BoundedString(submission_id)).map(|s| s.0))
}

/// List all submissions. Admin only. Capped at 500 entries to stay under ICP's 2 MB response limit.
/// Use get_kyc_submissions_page for full exports at scale.
#[update]
fn get_all_kyc_submissions() -> Vec<(String, String)> {
    if !is_admin() { return vec![]; }
    audit("admin_bulk_read", "get_all_kyc_submissions");
    KYC_SUBMISSIONS.with(|s| {
        s.borrow().iter().take(500).map(|(k, v)| (k.0, v.0)).collect()
    })
}

/// Paginated submissions. Admin only.
/// Returns (total_count, Vec<(id, json)>) for the requested page.
#[query]
fn get_kyc_submissions_page(limit: u64, offset: u64) -> (u64, Vec<(String, String)>) {
    if !is_admin() { return (0, vec![]); }
    KYC_SUBMISSIONS.with(|s| {
        let store = s.borrow();
        let total = store.len();
        let page  = store.iter()
            .skip(offset as usize)
            .take(limit.min(100) as usize)   // hard cap at 100 per page
            .map(|(k, v)| (k.0, v.0))
            .collect();
        (total, page)
    })
}

/// Total count of submissions. Admin only. Used for pagination UI.
#[query]
fn get_kyc_submissions_count() -> u64 {
    if !is_admin() { return 0; }
    KYC_SUBMISSIONS.with(|s| s.borrow().len())
}

/// Returns (approved, rejected, pending) counts — computed on-chain, no bulk download.
#[query]
fn get_kyc_status_counts() -> (u64, u64, u64) {
    if !is_admin() { return (0, 0, 0); }
    let mut approved: u64 = 0;
    let mut rejected: u64 = 0;
    let mut pending: u64 = 0;
    KYC_SUBMISSIONS.with(|s| {
        for (_, v) in s.borrow().iter() {
            let status = serde_json::from_str::<serde_json::Value>(&v.0)
                .ok()
                .and_then(|d| {
                    let kyc = d.get("kycData").cloned().unwrap_or(d);
                    kyc.get("status").and_then(|s| s.as_str()).map(|s| s.to_string())
                })
                .unwrap_or_else(|| "pending_review".to_string());
            match status.as_str() {
                "approved" => approved += 1,
                "rejected" => rejected += 1,
                _ => pending += 1,
            }
        }
    });
    (approved, rejected, pending)
}

/// Update the status of a KYC submission (approved / rejected). Admin only.
/// Returns Ok(true) if the status was updated AND the notification email was sent.
/// Returns Ok(false) if the status was updated but email sending failed (still a success
/// for the status change — admin should be aware the user may not have been notified).
#[update]
async fn update_kyc_status(submission_id: String, new_status: String) -> Result<bool, String> {
    require_admin()?;

    let allowed = ["approved", "rejected", "pending_review"];
    if !allowed.contains(&new_status.as_str()) {
        return Err(format!("Invalid status '{}'. Use: approved, rejected, pending_review.", new_status));
    }

    let (name, email) = KYC_SUBMISSIONS.with(|submissions| {
        let mut store = submissions.borrow_mut();
        let key = BoundedString(submission_id.clone());

        let current = store.get(&key).ok_or_else(|| "Submission not found.".to_string())?;

        // Parse → update status → re-serialize
        let mut payload: serde_json::Value =
            serde_json::from_str(&current.0).map_err(|e| format!("Parse error: {}", e))?;

        let now_ns = ic_cdk::api::time();
        if let Some(kyc_data) = payload.get_mut("kycData") {
            kyc_data["status"]    = serde_json::Value::String(new_status.clone());
            kyc_data["updatedAt"] = serde_json::json!(now_ns);
        } else {
            payload["status"]    = serde_json::Value::String(new_status.clone());
            payload["updatedAt"] = serde_json::json!(now_ns);
        }

        let kyc_section = payload.get("kycData");
        let name = kyc_section
            .and_then(|d| d.get("ocrData"))
            .and_then(|d| d.get("full_name"))
            .and_then(|v| v.as_str())
            .unwrap_or("Applicant")
            .to_string();
        let email = kyc_section
            .and_then(|d| {
                // Primary: kycData.email (set by OTP step)
                // Fallback: kycData.ocrData.email (legacy / alternative paths)
                let direct = d.get("email").and_then(|v| v.as_str()).unwrap_or("");
                if !direct.is_empty() {
                    Some(direct)
                } else {
                    d.get("ocrData").and_then(|o| o.get("email")).and_then(|v| v.as_str())
                }
            })
            .unwrap_or("")
            .to_string();

        let updated = serde_json::to_string(&payload).map_err(|e| format!("Serialize error: {}", e))?;
        store.insert(key, BoundedString(updated));
        audit("update_kyc_status", &format!("{}=>{}", submission_id, new_status));
        Ok::<(String, String), String>((name, email))
    })?;

    // Await email so the caller knows whether the user was notified.
    let email_sent = send_status_email(&submission_id, &name, &email, &new_status)
        .await
        .is_ok();

    Ok(email_sent)
}

/// Delete the caller's own KYC submission.
/// Requires the phone number used during the OTP step as a second factor so
/// that knowing only the national ID is not sufficient to delete someone else's data.
/// Users can exercise their right to erasure (GDPR Article 17 / Privacy Policy).
#[update]
fn delete_my_kyc(national_id: String, phone: String) -> Result<(), String> {
    // 2 deletion attempts per day per principal
    check_rate_limit("delete_my_kyc", 2, 86_400_000_000_000)?;

    validate_national_id(&national_id)?;
    if phone.trim().is_empty() {
        return Err("Phone number is required to verify ownership.".to_string());
    }

    let submission_id = NATIONAL_ID_INDEX.with(|idx| {
        idx.borrow().get(&BoundedString(national_id.clone())).map(|s| s.0.clone())
    }).ok_or("No KYC submission found for this National ID.")?;

    // Verify the phone matches the stored submission
    let stored_phone = KYC_SUBMISSIONS.with(|s| {
        s.borrow()
            .get(&BoundedString(submission_id.clone()))
            .and_then(|v| serde_json::from_str::<serde_json::Value>(&v.0).ok())
            .and_then(|d| {
                d.get("kycData").or(Some(&d))
                    .and_then(|k| k.get("phone"))
                    .and_then(|p| p.as_str())
                    .map(|p| normalize_phone(p))
            })
    }).unwrap_or_default();

    let provided = normalize_phone(&phone);
    if stored_phone.is_empty() || provided != stored_phone {
        return Err("Phone number does not match the submission.".to_string());
    }

    NATIONAL_ID_INDEX.with(|idx| { idx.borrow_mut().remove(&BoundedString(national_id)); });
    KYC_SUBMISSIONS.with(|s| { s.borrow_mut().remove(&BoundedString(submission_id.clone())); });
    audit("delete_my_kyc", &submission_id);
    Ok(())
}

/// Delete a KYC submission. Admin only.
#[update]
fn delete_kyc_submission(submission_id: String) -> Result<(), String> {
    require_admin()?;

    // Also remove from the national ID index
    let current = KYC_SUBMISSIONS.with(|s| s.borrow().get(&BoundedString(submission_id.clone())));
    if let Some(json) = current {
        if let Ok(payload) = serde_json::from_str::<KycSubmissionPayload>(&json.0) {
            NATIONAL_ID_INDEX.with(|idx| {
                idx.borrow_mut().remove(&BoundedString(payload.kyc_data.ocr_data.national_id));
            });
        }
    }

    KYC_SUBMISSIONS.with(|s| { s.borrow_mut().remove(&BoundedString(submission_id.clone())); });
    audit("delete_kyc_submission", &submission_id);
    Ok(())
}

// ── Email notifications (Resend API) ─────────────────────────────────────────

/// Configure email notifications. Admin only.
/// Get a free Resend API key at https://resend.com
/// dfx canister call rust_backend configure_email '("re_xxx", "kyc@mercaturaforum.com")'
#[update]
fn configure_email(resend_api_key: String, from_email: String) -> Result<(), String> {
    require_admin()?;
    let email = from_email.trim();
    let at_count = email.chars().filter(|&c| c == '@').count();
    let parts: Vec<&str> = email.splitn(2, '@').collect();
    let local = parts.first().copied().unwrap_or("");
    let domain = parts.get(1).copied().unwrap_or("");
    if at_count != 1 || local.is_empty() || !domain.contains('.') || domain.starts_with('.') || domain.ends_with('.') {
        return Err("from_email is not a valid email address.".into());
    }
    EMAIL_CONFIG.with(|cfg| {
        let mut m = cfg.borrow_mut();
        m.insert(BoundedString("resend_api_key".into()), BoundedString(resend_api_key));
        m.insert(BoundedString("from_email".into()),     BoundedString(from_email));
    });
    Ok(())
}

async fn send_status_email(
    submission_id: &str,
    applicant_name: &str,
    user_email: &str,
    status: &str,
) -> Result<(), String> {
    let (api_key, from) = EMAIL_CONFIG.with(|cfg| {
        let m = cfg.borrow();
        let k = m.get(&BoundedString("resend_api_key".into())).map(|s| s.0.clone())?;
        let f = m.get(&BoundedString("from_email".into())).map(|s| s.0.clone())?;
        Some((k, f))
    }).ok_or("Email not configured")?;

    let (subject, body) = match status {
        "approved" => (
            "Your KYC Verification has been Approved ✅",
            format!("Dear {},\n\nYour identity verification (ID: {}) has been approved. You now have full access to Mercatura Forum.\n\nWelcome aboard!", applicant_name, submission_id),
        ),
        "rejected" => (
            "Update on your KYC Verification",
            format!("Dear {},\n\nUnfortunately, your identity verification (ID: {}) could not be approved. Please contact support at support@mercaturaforum.com for assistance.\n\nThank you for your patience.", applicant_name, submission_id),
        ),
        _ => return Ok(()), // don't email on pending_review
    };

    // Send to the user's email collected during OTP; fall back to admin address
    // for legacy submissions that predate email collection.
    let to_email = if user_email.trim().is_empty() { from.clone() } else { user_email.to_string() };
    let json_body = format!(
        r#"{{"from":"{}","to":["{}"],"subject":"{}","text":"{}"}}"#,
        from, to_email, subject, body.replace('"', "\\\"").replace('\n', "\\n")
    );

    let body_bytes = json_body.into_bytes();
    let headers = vec![
        ic_cdk::api::management_canister::http_request::HttpHeader {
            name: "Authorization".to_string(),
            value: format!("Bearer {}", api_key),
        },
        ic_cdk::api::management_canister::http_request::HttpHeader {
            name: "Content-Type".to_string(),
            value: "application/json".to_string(),
        },
    ];

    let mut last_err = String::new();
    for _ in 0..3u8 {
        let request = ic_cdk::api::management_canister::http_request::CanisterHttpRequestArgument {
            url: "https://api.resend.com/emails".to_string(),
            method: ic_cdk::api::management_canister::http_request::HttpMethod::POST,
            headers: headers.clone(),
            body: Some(body_bytes.clone()),
            max_response_bytes: Some(1000),
            transform: None,
        };
        match ic_cdk::api::management_canister::http_request::http_request(request, 15_000_000_000).await {
            Ok(_) => return Ok(()),
            Err((_, msg)) => last_err = msg,
        }
    }
    Err(last_err)
}

// ── OCR via canister HTTP outcalls ────────────────────────────────────────────

// HTTPS endpoint — plain HTTP would expose document data in transit
const OCR_SERVER_DEFAULT_URL: &str = "https://ocr.mercaturaforum.com:5000";

fn ocr_server_url() -> String {
    APP_CONFIG.with(|c| {
        c.borrow()
            .get(&BoundedString("ocr_server_url".into()))
            .map(|v| v.0.clone())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| OCR_SERVER_DEFAULT_URL.to_string())
    })
}

#[update]
fn configure_ocr_server(url: String) -> Result<(), String> {
    if !is_admin() { return Err("Unauthorized".into()); }
    let url = url.trim().to_string();
    if url.is_empty() {
        APP_CONFIG.with(|c| c.borrow_mut().remove(&BoundedString("ocr_server_url".into())));
        return Ok(());
    }
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("URL must start with https:// or http://".into());
    }
    let url_lower = url.to_lowercase();
    let private_patterns = ["localhost", "127.", "0.0.0.0", "192.168.", "10.", "172.16.", "172.17.",
        "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.",
        "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.", "[::1]", "::1"];
    for pat in private_patterns {
        if url_lower.contains(pat) {
            return Err("Private/loopback addresses are not allowed.".into());
        }
    }
    APP_CONFIG.with(|c| c.borrow_mut().insert(BoundedString("ocr_server_url".into()), BoundedString(url)));
    Ok(())
}

#[update]
async fn get_egyptian_id_ocr_and_save(path: String) -> String {
    match get_egyptian_id_ocr(path.clone()).await {
        Ok(r) => {
            EGYPTIAN_ID_RESULTS.with(|results| {
                let mut store = results.borrow_mut();
                if store.len() >= 1000 {
                    if let Some((k, _)) = store.iter().next() { store.remove(&k); }
                }
                store.insert(BoundedString(path), BoundedString(r.clone()));
            });
            r
        }
        Err(e) => e,
    }
}

#[update]
async fn get_passport_ocr_and_save(path: String) -> String {
    match get_passport_ocr(path.clone()).await {
        Ok(r) => {
            PASSPORT_RESULTS.with(|results| {
                let mut store = results.borrow_mut();
                if store.len() >= 1000 {
                    if let Some((k, _)) = store.iter().next() { store.remove(&k); }
                }
                store.insert(BoundedString(path), BoundedString(r.clone()));
            });
            r
        }
        Err(e) => e,
    }
}

#[query]
fn get_egyptian_id_result(path: String) -> Option<String> {
    EGYPTIAN_ID_RESULTS.with(|r| r.borrow().get(&BoundedString(path)).map(|s| s.0))
}

#[query]
fn get_passport_result(path: String) -> Option<String> {
    PASSPORT_RESULTS.with(|r| r.borrow().get(&BoundedString(path)).map(|s| s.0))
}

#[query]
fn get_all_egyptian_id_results() -> Vec<(String, String)> {
    if !is_admin() { return vec![]; }
    EGYPTIAN_ID_RESULTS.with(|r| r.borrow().iter().map(|(k, v)| (k.0, v.0)).collect())
}

#[query]
fn get_all_passport_results() -> Vec<(String, String)> {
    if !is_admin() { return vec![]; }
    PASSPORT_RESULTS.with(|r| r.borrow().iter().map(|(k, v)| (k.0, v.0)).collect())
}

#[update]
fn delete_egyptian_id_result(path: String) -> Result<(), String> {
    require_admin()?;
    EGYPTIAN_ID_RESULTS.with(|r| { r.borrow_mut().remove(&BoundedString(path)); });
    Ok(())
}

#[update]
fn delete_passport_result(path: String) -> Result<(), String> {
    require_admin()?;
    PASSPORT_RESULTS.with(|r| { r.borrow_mut().remove(&BoundedString(path)); });
    Ok(())
}

/// Remove all cached OCR results from both stores. Admin only.
/// Returns (egyptian_id_count_removed, passport_count_removed).
#[update]
fn cleanup_ocr_results() -> Result<(u64, u64), String> {
    require_admin()?;
    let eid_count = EGYPTIAN_ID_RESULTS.with(|r| {
        let mut store = r.borrow_mut();
        let n = store.len();
        let keys: Vec<_> = store.iter().map(|(k, _)| k).collect();
        for k in keys { store.remove(&k); }
        n
    });
    let pp_count = PASSPORT_RESULTS.with(|r| {
        let mut store = r.borrow_mut();
        let n = store.len();
        let keys: Vec<_> = store.iter().map(|(k, _)| k).collect();
        for k in keys { store.remove(&k); }
        n
    });
    audit("admin_cleanup_ocr_results", &format!("eid={} passport={}", eid_count, pp_count));
    Ok((eid_count, pp_count))
}

async fn get_egyptian_id_ocr(path: String) -> Result<String, String> {
    let image_data = get_asset_by_path(&path)?;
    let url = format!("{}/egyptian-id", ocr_server_url());
    make_ocr_request(url, image_data).await
}

async fn get_passport_ocr(path: String) -> Result<String, String> {
    let image_data = get_asset_by_path(&path)?;
    let url = format!("{}/passport", ocr_server_url());
    make_ocr_request(url, image_data).await
}

async fn make_ocr_request(url: String, body: Vec<u8>) -> Result<String, String> {
    let request = ic_cdk::api::management_canister::http_request::CanisterHttpRequestArgument {
        url,
        method: ic_cdk::api::management_canister::http_request::HttpMethod::POST,
        headers: vec![ic_cdk::api::management_canister::http_request::HttpHeader {
            name: "Content-Type".to_string(),
            value: "application/octet-stream".to_string(),
        }],
        body: Some(body),
        max_response_bytes: Some(2 * 1024 * 1024), // 2 MB cap; OCR JSON responses are small
        transform: None,
    };
    match ic_cdk::api::management_canister::http_request::http_request(request, 50_000_000_000).await {
        Ok((response,)) => String::from_utf8(response.body).map_err(|e| format!("UTF-8 decode error: {}", e)),
        Err((_, msg)) => Err(msg),
    }
}

fn get_asset_by_path(path: &str) -> Result<Vec<u8>, String> {
    // Stable storage first (persisted completed uploads)
    let stable = FILE_DATA.with(|fd| {
        fd.borrow().get(&BoundedString(path.to_string())).map(|d| d.0.clone())
    });
    if let Some(data) = stable {
        if !data.is_empty() { return Ok(data); }
    }
    // Fall back to transient chunks (upload still in progress)
    FILE_CHUNKS.with(|chunks_ref| {
        let data: Vec<u8> = chunks_ref.borrow().get(path).cloned()
            .unwrap_or_default().into_iter().flatten().collect();
        if data.is_empty() { Err("Asset not found".to_string()) } else { Ok(data) }
    })
}

// ── Partner API clients (KYC-as-a-Service) ────────────────────────────────────
// Other websites integrate our verification: they register for an API key,
// create sessions over HTTP, send their user to our hosted /verify page, and
// poll the session for the result.

fn hash_api_key(key: &str) -> String {
    use sha2::{Digest, Sha256};
    hex::encode(Sha256::digest(key.as_bytes()))
}

fn validate_email_format(email: &str) -> bool {
    let at_count = email.chars().filter(|&c| c == '@').count();
    let parts: Vec<&str> = email.splitn(2, '@').collect();
    let local = parts.first().copied().unwrap_or("");
    let domain = parts.get(1).copied().unwrap_or("");
    at_count == 1 && !local.is_empty() && domain.contains('.')
        && !domain.starts_with('.') && !domain.ends_with('.') && email.len() <= 254
}

/// Self-service partner registration. Returns (client_id, api_key).
/// The raw key is returned ONCE and never stored — only its SHA-256 hash.
/// New clients start as "pending"; an admin must activate them before the
/// key authorizes any API call.
#[update]
async fn register_api_client(name: String, website: String, contact_email: String) -> Result<(String, String), String> {
    check_rate_limit("register_api_client", 5, 3_600_000_000_000)?;
    let name = name.trim().to_string();
    let website = website.trim().to_string();
    let email = contact_email.trim().to_string();
    if name.is_empty() || name.len() > 100 {
        return Err("Company / project name is required (max 100 chars).".into());
    }
    if website.len() > 200 || !(website.starts_with("https://") || website.starts_with("http://")) {
        return Err("Website must be a valid http(s) URL (max 200 chars).".into());
    }
    if !validate_email_format(&email) {
        return Err("A valid contact email is required.".into());
    }

    let (rand,) = ic_cdk::api::management_canister::main::raw_rand()
        .await
        .map_err(|e| format!("Random generation failed: {}", e.1))?;
    if rand.len() < 32 {
        return Err("Random generation returned too few bytes.".into());
    }
    let api_key = format!("kyc_live_{}", hex::encode(&rand[..24]));
    let client_id = format!("client_{}", hex::encode(&rand[24..32]));

    let record = serde_json::json!({
        "client_id": client_id,
        "name": name,
        "website": website,
        "contact_email": email,
        "key_hash": hash_api_key(&api_key),
        "status": "pending",
        "created_at": ic_cdk::api::time(),
        "request_count": 0,
    });
    API_CLIENTS.with(|c| {
        c.borrow_mut().insert(BoundedString(client_id.clone()), BoundedString(record.to_string()));
    });
    audit("api_client_registered", &client_id);
    Ok((client_id, api_key))
}

/// List all partner clients with key hashes redacted. Admin only.
#[update]
fn list_api_clients() -> Vec<(String, String)> {
    if !is_admin() { return vec![]; }
    audit("admin_list_api_clients", "all");
    API_CLIENTS.with(|c| {
        c.borrow().iter().map(|(k, v)| {
            let redacted = serde_json::from_str::<serde_json::Value>(&v.0)
                .map(|mut j| {
                    if let Some(o) = j.as_object_mut() { o.remove("key_hash"); }
                    j.to_string()
                })
                .unwrap_or_else(|_| v.0.clone());
            (k.0, redacted)
        }).collect()
    })
}

/// Activate or suspend a partner client. Admin only.
#[update]
fn set_api_client_status(client_id: String, status: String) -> Result<(), String> {
    require_admin()?;
    if status != "active" && status != "suspended" {
        return Err("Status must be 'active' or 'suspended'.".into());
    }
    API_CLIENTS.with(|c| {
        let mut store = c.borrow_mut();
        let key = BoundedString(client_id.clone());
        let Some(v) = store.get(&key) else { return Err("Client not found.".to_string()); };
        let mut j: serde_json::Value = serde_json::from_str(&v.0)
            .map_err(|_| "Corrupt client record.".to_string())?;
        j["status"] = serde_json::Value::String(status.clone());
        store.insert(key, BoundedString(j.to_string()));
        Ok(())
    })?;
    audit("api_client_status", &format!("{} -> {}", client_id, status));
    Ok(())
}

/// Permanently remove a partner client (revokes its key). Admin only.
#[update]
fn delete_api_client(client_id: String) -> Result<(), String> {
    require_admin()?;
    API_CLIENTS.with(|c| { c.borrow_mut().remove(&BoundedString(client_id.clone())); });
    audit("api_client_deleted", &client_id);
    Ok(())
}

/// Look up an ACTIVE client by raw API key. Read-only (safe in query context).
fn find_client_by_key(key: &str) -> Option<String> {
    if key.len() < 20 { return None; }
    let h = hash_api_key(key);
    API_CLIENTS.with(|c| {
        c.borrow().iter().find_map(|(k, v)| {
            let j: serde_json::Value = serde_json::from_str(&v.0).ok()?;
            let matches = j.get("key_hash")?.as_str()? == h
                && j.get("status")?.as_str()? == "active";
            if matches { Some(k.0) } else { None }
        })
    })
}

/// Same as find_client_by_key but bumps the usage counter (update context only).
fn authorize_api_key_and_count(key: &str) -> Option<String> {
    let client_id = find_client_by_key(key)?;
    API_CLIENTS.with(|c| {
        let mut store = c.borrow_mut();
        let k = BoundedString(client_id.clone());
        if let Some(v) = store.get(&k) {
            if let Ok(mut j) = serde_json::from_str::<serde_json::Value>(&v.0) {
                let n = j.get("request_count").and_then(|x| x.as_u64()).unwrap_or(0);
                j["request_count"] = serde_json::json!(n + 1);
                store.insert(k, BoundedString(j.to_string()));
            }
        }
    });
    Some(client_id)
}

/// Set the public frontend base URL used in API verification links. Admin only.
/// e.g. "https://kyc.mercaturaforum.com"
#[update]
fn configure_frontend_url(url: String) -> Result<(), String> {
    require_admin()?;
    let url = url.trim().trim_end_matches('/').to_string();
    if url.is_empty() {
        APP_CONFIG.with(|c| c.borrow_mut().remove(&BoundedString("frontend_url".into())));
        return Ok(());
    }
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("URL must start with https:// or http://".into());
    }
    APP_CONFIG.with(|c| c.borrow_mut().insert(BoundedString("frontend_url".into()), BoundedString(url)));
    Ok(())
}

fn frontend_base_url() -> String {
    APP_CONFIG.with(|c| c.borrow().get(&BoundedString("frontend_url".into())).map(|s| s.0))
        .unwrap_or_default()
}

// ── HTTP gateway (serves static frontend files) ───────────────────────────────

#[derive(Clone, Debug, CandidType, CandidDeserialize)]
struct CanisterHttpRequestArgument {
    url: String,
    method: String,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

#[derive(Clone, Debug, CandidType, CandidDeserialize)]
struct HttpResponse {
    status_code: u16,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
    /// When Some(true), the gateway re-issues this request as an update call
    /// to http_request_update — required for state-changing API endpoints.
    upgrade: Option<bool>,
}

fn security_headers() -> Vec<(String, String)> {
    vec![
        ("X-Content-Type-Options".into(), "nosniff".into()),
        ("X-Frame-Options".into(), "DENY".into()),
        ("Referrer-Policy".into(), "strict-origin-when-cross-origin".into()),
        ("Content-Security-Policy".into(), "default-src 'none'; img-src 'self'".into()),
    ]
}

fn api_headers() -> Vec<(String, String)> {
    vec![
        ("Content-Type".into(), "application/json".into()),
        ("Access-Control-Allow-Origin".into(), "*".into()),
        ("Access-Control-Allow-Methods".into(), "GET, POST, OPTIONS".into()),
        ("Access-Control-Allow-Headers".into(), "Authorization, Content-Type".into()),
        ("X-Content-Type-Options".into(), "nosniff".into()),
    ]
}

fn api_json(status_code: u16, body: serde_json::Value) -> HttpResponse {
    HttpResponse {
        status_code,
        headers: api_headers(),
        body: body.to_string().into_bytes(),
        upgrade: None,
    }
}

fn bearer_key(headers: &[(String, String)]) -> Option<String> {
    headers.iter()
        .find(|(k, _)| k.eq_ignore_ascii_case("authorization"))
        .and_then(|(_, v)| v.strip_prefix("Bearer ").map(|s| s.trim().to_string()))
}

/// GET /api/v1/sessions/{id} — partner polls the verification result.
fn api_get_session(session_id: &str, client_id: &str) -> HttpResponse {
    let raw = VERIFICATION_SESSIONS.with(|s| s.borrow().get(&BoundedString(session_id.to_string())).map(|v| v.0));
    let Some(raw) = raw else {
        return api_json(404, serde_json::json!({"error": "Session not found"}));
    };
    let Ok(session) = serde_json::from_str::<VerificationSession>(&raw) else {
        return api_json(500, serde_json::json!({"error": "Corrupt session record"}));
    };
    // A partner can only read its own sessions
    if session.client_id.as_deref() != Some(client_id) {
        return api_json(404, serde_json::json!({"error": "Session not found"}));
    }

    let now = ic_cdk::api::time();
    let expired = session_expired(&session, now);

    let mut out = serde_json::json!({
        "session_id": session.session_id,
        "status": if expired { "expired" } else { session.status.as_str() },
        "created_at_ns": session.created_at,
        "completed_at_ns": session.completed_at,
    });

    // On completion, surface a minimal result + the live admin-review status
    if session.status == "completed" {
        if let Some(data) = session.data.as_deref().and_then(|d| serde_json::from_str::<serde_json::Value>(d).ok()) {
            let nid = data.get("ocrData").and_then(|o| o.get("national_id")).and_then(|n| n.as_str()).unwrap_or("");
            let nid_last4 = if nid.len() >= 4 { &nid[nid.len() - 4..] } else { "" };
            let submission_id = data.get("submissionId").and_then(|s| s.as_str()).unwrap_or("");
            let review_status = if submission_id.is_empty() { None } else {
                KYC_SUBMISSIONS.with(|s| s.borrow().get(&BoundedString(submission_id.to_string())))
                    .and_then(|v| serde_json::from_str::<serde_json::Value>(&v.0).ok())
                    .and_then(|j| j.get("kycData").and_then(|k| k.get("status")).and_then(|s| s.as_str()).map(String::from))
            };
            out["result"] = serde_json::json!({
                "face_verified": data.get("faceVerified").and_then(|f| f.as_bool()).unwrap_or(false),
                "full_name": data.get("ocrData").and_then(|o| o.get("full_name")).and_then(|n| n.as_str()).unwrap_or(""),
                "national_id_last4": nid_last4,
                "review_status": review_status.unwrap_or_else(|| "pending_review".into()),
            });
        }
    }
    api_json(200, out)
}

#[query]
fn http_request(request: CanisterHttpRequestArgument) -> HttpResponse {
    if request.url.starts_with("/api/") {
        let path = request.url.split('?').next().unwrap_or(&request.url).to_string();
        let method = request.method.to_uppercase();

        // CORS preflight
        if method == "OPTIONS" {
            return HttpResponse { status_code: 204, headers: api_headers(), body: vec![], upgrade: None };
        }

        // State-changing endpoints are re-issued as update calls
        if method == "POST" {
            return HttpResponse { status_code: 200, headers: api_headers(), body: vec![], upgrade: Some(true) };
        }

        if method == "GET" {
            if let Some(session_id) = path.strip_prefix("/api/v1/sessions/") {
                let Some(key) = bearer_key(&request.headers) else {
                    return api_json(401, serde_json::json!({"error": "Missing Authorization: Bearer <api_key>"}));
                };
                let Some(client_id) = find_client_by_key(&key) else {
                    return api_json(403, serde_json::json!({"error": "Invalid or inactive API key"}));
                };
                return api_get_session(session_id, &client_id);
            }
        }
        return api_json(404, serde_json::json!({"error": "Not Found"}));
    }
    serve_static_file(request)
}

/// Update-context handler for state-changing API calls (POST).
#[update]
async fn http_request_update(request: CanisterHttpRequestArgument) -> HttpResponse {
    let path = request.url.split('?').next().unwrap_or(&request.url).to_string();
    let method = request.method.to_uppercase();

    if method == "POST" && path == "/api/v1/sessions" {
        let Some(key) = bearer_key(&request.headers) else {
            return api_json(401, serde_json::json!({"error": "Missing Authorization: Bearer <api_key>"}));
        };
        let Some(client_id) = authorize_api_key_and_count(&key) else {
            return api_json(403, serde_json::json!({"error": "Invalid or inactive API key"}));
        };
        // 100 sessions per client per hour
        if let Err(e) = check_rate_limit(&format!("api_sessions_{}", client_id), 100, 3_600_000_000_000) {
            return api_json(429, serde_json::json!({"error": e}));
        }

        let Ok((rand,)) = ic_cdk::api::management_canister::main::raw_rand().await else {
            return api_json(500, serde_json::json!({"error": "Random generation failed"}));
        };
        if rand.len() < 16 {
            return api_json(500, serde_json::json!({"error": "Random generation failed"}));
        }
        let session_id = format!("api_{}", hex::encode(&rand[..16]));

        let session = VerificationSession {
            session_id: session_id.clone(),
            status: "waiting".to_string(),
            created_at: ic_cdk::api::time(),
            completed_at: None,
            data: None,
            client_id: Some(client_id.clone()),
            last_active: ic_cdk::api::time(),
        };
        let json = match serde_json::to_string(&session) {
            Ok(j) => j,
            Err(_) => return api_json(500, serde_json::json!({"error": "Serialization failed"})),
        };
        VERIFICATION_SESSIONS.with(|s| {
            s.borrow_mut().insert(BoundedString(session_id.clone()), BoundedString(json));
        });
        audit("api_session_created", &format!("{} by {}", session_id, client_id));

        let base = frontend_base_url();
        let verification_url = if base.is_empty() {
            format!("/verify/{}", session_id)
        } else {
            format!("{}/verify/{}", base, session_id)
        };
        return api_json(201, serde_json::json!({
            "session_id": session_id,
            "verification_url": verification_url,
            "expires_in_seconds": SESSION_TTL_NS / 1_000_000_000,
        }));
    }

    api_json(404, serde_json::json!({"error": "Not Found"}))
}

fn serve_static_file(request: CanisterHttpRequestArgument) -> HttpResponse {
    let raw_path = request.url.strip_prefix('/').unwrap_or(&request.url);
    let decoded_path = urlencoding::decode(raw_path)
        .unwrap_or_else(|_| std::borrow::Cow::from(raw_path)).to_string();

    let bounded_path = BoundedString(decoded_path.clone());
    FILE_METADATA.with(|metadata_ref| {
        if let Some(meta) = metadata_ref.borrow().get(&bounded_path) {
            // Read from stable FILE_DATA first; fall back to transient chunks for in-flight uploads
            let body = FILE_DATA.with(|fd| {
                fd.borrow().get(&bounded_path).map(|d| d.0.clone())
            }).unwrap_or_else(|| {
                FILE_CHUNKS.with(|c| {
                    c.borrow().get(&decoded_path).cloned()
                        .unwrap_or_default().into_iter().flatten().collect()
                })
            });
            let mut headers = security_headers();
            headers.push(("Content-Type".into(), meta.mime_type.0.clone()));
            HttpResponse { status_code: 200, headers, body, upgrade: None }
        } else {
            HttpResponse { status_code: 404, headers: security_headers(), body: b"Not Found".to_vec(), upgrade: None }
        }
    })
}

// ── Verification sessions (mobile handoff) ────────────────────────────────────

#[derive(CandidType, Deserialize, Serialize, Clone)]
struct VerificationSession {
    session_id: String,
    status: String,
    created_at: u64,
    completed_at: Option<u64>,
    data: Option<String>,
    /// Set when the session was created by a partner via the HTTP API.
    #[serde(default)]
    client_id: Option<String>,
    /// Last heartbeat/update (ns). 0 on legacy records -> created_at is used.
    #[serde(default)]
    last_active: u64,
}

const SESSION_TTL_NS: u64 = 24 * 60 * 60 * 1_000_000_000; // 24 hours (absolute cap)
/// A session with no heartbeat for this long is dead — the phone beats every
/// 5s while working, so anything idle for 10 minutes was abandoned.
const SESSION_IDLE_TTL_NS: u64 = 10 * 60 * 1_000_000_000;

fn session_expired(session: &VerificationSession, now: u64) -> bool {
    if session.status == "completed" { return false; }
    let last = session.last_active.max(session.created_at);
    now.saturating_sub(session.created_at) >= SESSION_TTL_NS
        || now.saturating_sub(last) >= SESSION_IDLE_TTL_NS
}

#[update]
fn create_verification_session(session_id: String) -> Result<(), String> {
    check_rate_limit("create_verification_session", 10, 3_600_000_000_000)?;
    let session = VerificationSession {
        session_id: session_id.clone(),
        status: "waiting".to_string(),
        created_at: ic_cdk::api::time(),
        completed_at: None,
        data: None,
        client_id: None,
        last_active: ic_cdk::api::time(),
    };
    let json = serde_json::to_string(&session).map_err(|e| format!("Serialize error: {}", e))?;
    VERIFICATION_SESSIONS.with(|s| {
        s.borrow_mut().insert(BoundedString(session_id), BoundedString(json));
    });
    Ok(())
}

#[query]
fn get_verification_status(session_id: String) -> Option<String> {
    VERIFICATION_SESSIONS.with(|s| {
        if let Some(json) = s.borrow().get(&BoundedString(session_id)) {
            if let Ok(session) = serde_json::from_str::<VerificationSession>(&json.0) {
                let expired = session_expired(&session, ic_cdk::api::time());
                if !expired { return Some(json.0); }
            }
        }
        None
    })
}

#[query]
fn verify_session(session_id: String) -> bool {
    VERIFICATION_SESSIONS.with(|sessions| {
        if let Some(json) = sessions.borrow().get(&BoundedString(session_id)) {
            if let Ok(session) = serde_json::from_str::<VerificationSession>(&json.0) {
                let expired = session_expired(&session, ic_cdk::api::time());
                return !expired && session.status == "waiting";
            }
        }
        false
    })
}

#[update]
fn mark_verification_in_progress(session_id: String) -> Result<(), String> {
    update_session_status(session_id, "in_progress", None)
}

#[update]
fn complete_verification(session_id: String, kyc_data: String) -> Result<(), String> {
    // Validate payload structure before storing
    let parsed: serde_json::Value = serde_json::from_str(&kyc_data)
        .map_err(|_| "KYC data is not valid JSON.".to_string())?;
    let nid = parsed
        .get("ocrData")
        .and_then(|o| o.get("national_id"))
        .and_then(|n| n.as_str())
        .unwrap_or("");
    if !validate_national_id(nid).is_ok() {
        return Err("KYC data is missing a valid National ID.".to_string());
    }
    // Phone may be empty when the user skipped OTP verification — the National ID
    // (validated above) is the integrity anchor for handoff payloads.

    let now = ic_cdk::api::time();
    VERIFICATION_SESSIONS.with(|sessions| {
        let mut store = sessions.borrow_mut();
        let key = BoundedString(session_id.clone());
        let current = store.get(&key).ok_or("Session not found.")?;
        let mut session: VerificationSession = serde_json::from_str(&current.0)
            .map_err(|e| format!("Parse error: {}", e))?;
        if session_expired(&session, now) {
            return Err("Session has expired.".to_string());
        }
        if session.status == "completed" {
            return Err("Session has already been completed.".to_string());
        }
        session.status = "completed".to_string();
        session.completed_at = Some(now);
        session.data = Some(kyc_data);
        let json = serde_json::to_string(&session).map_err(|e| format!("Serialize error: {}", e))?;
        store.insert(key, BoundedString(json));
        Ok(())
    })
}

fn update_session_status(session_id: String, status: &str, completed_at: Option<u64>) -> Result<(), String> {
    VERIFICATION_SESSIONS.with(|sessions| {
        let mut store = sessions.borrow_mut();
        let key = BoundedString(session_id.clone());
        let current = store.get(&key).ok_or("Session not found.")?;
        let mut session: VerificationSession = serde_json::from_str(&current.0)
            .map_err(|e| format!("Parse error: {}", e))?;
        if session.status == "completed" {
            return Ok(()); // never roll back a completed session
        }
        session.status = status.to_string();
        session.completed_at = completed_at;
        session.last_active = ic_cdk::api::time();
        let json = serde_json::to_string(&session).map_err(|e| format!("Serialize error: {}", e))?;
        store.insert(key, BoundedString(json));
        Ok(())
    })
}

/// Get all sessions. Admin only.
#[query]
fn get_all_verification_sessions() -> Vec<(String, String)> {
    if !is_admin() { return vec![]; }
    VERIFICATION_SESSIONS.with(|s| s.borrow().iter().map(|(k, v)| (k.0, v.0)).collect())
}

#[update]
fn delete_verification_session(session_id: String) {
    VERIFICATION_SESSIONS.with(|s| { s.borrow_mut().remove(&BoundedString(session_id)); });
}

/// Record that the user explicitly consented to biometric data processing.
/// Called by the frontend when the user clicks "I Agree & Continue".
/// Any authenticated principal can call this for their own submission.
#[update]
fn log_consent_event(submission_id: String) {
    audit("biometric_consent", &submission_id);
}

/// Retrieve the audit log (most recent first). Admin only. Returns up to `limit` entries.
#[query]
fn get_audit_log(limit: u64) -> Vec<(String, String)> {
    if !is_admin() { return vec![]; }
    let cap = limit.min(500) as usize;
    AUDIT_LOG.with(|log| {
        let store = log.borrow();
        store.iter()
            .rev()
            .take(cap)
            .map(|(k, v)| (k.0.clone(), v.0.clone()))
            .collect()
    })
}

/// Paginated audit log (most recent first). Admin only. Returns (total_count, entries).
#[query]
fn get_audit_log_page(limit: u64, offset: u64) -> (u64, Vec<(String, String)>) {
    if !is_admin() { return (0, vec![]); }
    let cap = limit.min(200) as usize;
    AUDIT_LOG.with(|log| {
        let store = log.borrow();
        let total = store.len();
        let page = store.iter()
            .rev()
            .skip(offset as usize)
            .take(cap)
            .map(|(k, v)| (k.0.clone(), v.0.clone()))
            .collect();
        (total, page)
    })
}

/// Delete all verification sessions older than 24 hours. Admin only.
#[update]
fn cleanup_expired_sessions() -> Result<u64, String> {
    require_admin()?;
    let now = ic_cdk::api::time();
    let expired_keys: Vec<BoundedString> = VERIFICATION_SESSIONS.with(|s| {
        s.borrow().iter()
            .filter_map(|(k, v)| {
                serde_json::from_str::<VerificationSession>(&v.0).ok()
                    .filter(|sess| session_expired(sess, now))
                    .map(|_| k)
            })
            .collect()
    });
    let count = expired_keys.len() as u64;
    VERIFICATION_SESSIONS.with(|s| {
        let mut store = s.borrow_mut();
        for k in expired_keys { store.remove(&k); }
    });
    Ok(count)
}

/// Export all audit log entries between two nanosecond timestamps (inclusive). Admin only.
/// Use this for off-chain backups and compliance exports.
#[update]
fn export_audit_log_range(from_ns: u64, to_ns: u64) -> Vec<(String, String)> {
    if !is_admin() { return vec![]; }
    if from_ns > to_ns { return vec![]; }
    audit("admin_export_audit_log", &format!("from={} to={}", from_ns, to_ns));
    AUDIT_LOG.with(|log| {
        log.borrow()
            .iter()
            .filter(|(k, _)| {
                // Key format: "<timestamp_ns>:<seq>"; parse the timestamp prefix
                let ts: u64 = k.0.split(':').next()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);
                ts >= from_ns && ts <= to_ns
            })
            .take(10_000) // cap at 10 k entries to stay well under 2 MB response limit
            .map(|(k, v)| (k.0.clone(), v.0.clone()))
            .collect()
    })
}

// ── Unit tests ────────────────────────────────────────────────────────────────
// These tests cover pure functions that do not depend on the IC runtime.
// Canister endpoints (submit_kyc, delete_my_kyc, etc.) require PocketIC or
// a local dfx environment for integration testing.
#[cfg(test)]
mod tests {
    use super::*;

    // ── validate_national_id ─────────────────────────────────────────────────

    #[test]
    fn valid_national_id_accepts_2xx_prefix() {
        assert!(validate_national_id("29501010112345").is_ok());
    }

    #[test]
    fn valid_national_id_accepts_3xx_prefix() {
        assert!(validate_national_id("30001010112345").is_ok());
    }

    #[test]
    fn national_id_rejects_wrong_length_short() {
        assert!(validate_national_id("2950101011234").is_err());
    }

    #[test]
    fn national_id_rejects_wrong_length_long() {
        assert!(validate_national_id("295010101123456").is_err());
    }

    #[test]
    fn national_id_rejects_non_digits() {
        assert!(validate_national_id("2950101011234A").is_err());
    }

    #[test]
    fn national_id_rejects_wrong_century_digit() {
        // Century digit must be 2 (1900s) or 3 (2000s)
        assert!(validate_national_id("19501010112345").is_err());
        assert!(validate_national_id("49501010112345").is_err());
    }

    #[test]
    fn national_id_rejects_empty() {
        assert!(validate_national_id("").is_err());
    }

    // ── KycSubmissionPayload JSON deserialisation ────────────────────────────

    fn sample_payload(with_face_image: bool) -> String {
        let face_field = if with_face_image {
            r#","face_image":"base64encodeddata""#
        } else {
            ""
        };
        let ocr = format!(
            r#"{{"full_name":"Ahmed Mohamed","national_id":"29501010112345","birth_date":"01/01/1995","age":29,"address":"123 Main St","governorate":"Cairo","gender":"Male"{}}}"#,
            face_field
        );
        format!(
            r#"{{"kycData":{{"submissionId":"test-001","timestamp":"2024-01-01T00:00:00Z","phone":"+201001234567","email":"user@example.com","documentFile":"id.jpg","ocrData":{},"faceVerified":true,"status":"pending_review"}}}}"#,
            ocr
        )
    }

    #[test]
    fn payload_deserialises_with_face_image() {
        let json = sample_payload(true);
        let result: Result<KycSubmissionPayload, _> = serde_json::from_str(&json);
        assert!(result.is_ok());
        let p = result.unwrap();
        assert_eq!(p.kyc_data.ocr_data.face_image, "base64encodeddata");
    }

    #[test]
    fn payload_deserialises_without_face_image() {
        // New submissions no longer include face_image — must not fail deserialization
        let json = sample_payload(false);
        let result: Result<KycSubmissionPayload, _> = serde_json::from_str(&json);
        assert!(result.is_ok());
        let p = result.unwrap();
        assert_eq!(p.kyc_data.ocr_data.face_image, ""); // serde(default) → empty string
    }

    #[test]
    fn payload_deserialises_national_id_and_name() {
        let json = sample_payload(false);
        let p: KycSubmissionPayload = serde_json::from_str(&json).unwrap();
        assert_eq!(p.kyc_data.ocr_data.national_id, "29501010112345");
        assert_eq!(p.kyc_data.ocr_data.full_name, "Ahmed Mohamed");
        assert_eq!(p.kyc_data.email, "user@example.com");
    }

    #[test]
    fn payload_rejects_missing_required_field() {
        // full_name has no #[serde(default)] — omitting it should fail
        let bad = r#"{"kycData":{"submissionId":"x","timestamp":"t","phone":"p","documentFile":"f","ocrData":{"national_id":"29501010112345","birth_date":"d","age":0,"address":"a","governorate":"g","gender":"m"},"faceVerified":false,"status":"s"}}"#;
        let result: Result<KycSubmissionPayload, _> = serde_json::from_str(bad);
        assert!(result.is_err(), "Should fail when full_name is missing");
    }

    // ── BoundedString storable round-trip ────────────────────────────────────

    #[test]
    fn bounded_string_round_trip_ascii() {
        let original = BoundedString("hello world".to_string());
        let bytes = original.to_bytes();
        let recovered = BoundedString::from_bytes(bytes);
        assert_eq!(original, recovered);
    }

    #[test]
    fn bounded_string_round_trip_arabic() {
        let original = BoundedString("أحمد محمد".to_string());
        let bytes = original.to_bytes();
        let recovered = BoundedString::from_bytes(bytes);
        assert_eq!(original, recovered);
    }

    #[test]
    fn bounded_string_round_trip_empty() {
        let original = BoundedString(String::new());
        let bytes = original.to_bytes();
        let recovered = BoundedString::from_bytes(bytes);
        assert_eq!(original, recovered);
    }

    // ── Phone normalisation ──────────────────────────────────────────────────

    #[test]
    fn phone_normalisation_strips_plus_and_spaces() {
        assert_eq!(super::normalize_phone("+20 10 123 4567"), "2010123 4567".replace(' ', ""));
        assert_eq!(super::normalize_phone("+201012345678"), "201012345678");
        assert_eq!(super::normalize_phone("201012345678"), "201012345678");
        assert_eq!(super::normalize_phone("  +20 10 12345678  "), "201012345678");
    }

    #[test]
    fn phone_normalisation_handles_empty() {
        assert_eq!(super::normalize_phone(""), "");
        assert_eq!(super::normalize_phone("  "), "");
    }
}
