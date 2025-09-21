use candid::{CandidType, Deserialize};
use ic_cdk::api::management_canister::main::raw_rand;
use ic_cdk::api::management_canister::http_request::{
    http_request, CanisterHttpRequestArgument, HttpResponse, HttpMethod, HttpHeader,
};
use ic_cdk_macros::update;
use base64::{engine::general_purpose, Engine as _};
use std::collections::{HashMap, HashSet};
use std::cell::RefCell;

#[derive(CandidType, Deserialize)]
pub struct Response {
    pub success: bool,
    pub message: String,
}

thread_local! {
    static OTP_STORE: RefCell<HashMap<String, (String, u64)>> = RefCell::new(HashMap::new());
    static VERIFIED_PHONES: RefCell<HashSet<String>> = RefCell::new(HashSet::new());
}

// Generate a 6-digit OTP
async fn generate_otp() -> String {
    let (bytes,) = raw_rand().await.unwrap_or((vec![0; 8],));
    let num = u64::from_le_bytes(bytes[..8].try_into().unwrap_or([0; 8]));
    format!("{:06}", num % 1_000_000)
}

#[update]
pub async fn send_sms(to: String) -> Response {
    let now = ic_cdk::api::time();

    // Check if OTP already exists
    let already_exists = OTP_STORE.with(|store| store.borrow().get(&to).cloned());
    if let Some((_otp, expiry)) = already_exists {
        if now < expiry {
            let remaining_secs = (expiry - now) / 1_000_000_000;
            return Response {
                success: false,
                message: format!("OTP already sent. Please wait {} seconds.", remaining_secs),
            };
        }
    }

    // Generate new OTP
    let otp = generate_otp().await;
    let expires_at = now + 30_000_000_000; // 30 seconds

    OTP_STORE.with(|store| {
        store.borrow_mut().insert(to.clone(), (otp.clone(), expires_at));
    });

    // Twilio credentials
    let account_sid = "AC99262ff2dcd2b7e2d54d2e63bc335789";
    let auth_token = "4548b85e5a1b282500fbae5c2ed3943d";
    let from_number = "+17328386631";

    let url = format!(
        "https://api.twilio.com/2010-04-01/Accounts/{}/Messages.json",
        account_sid
    );

    // Ensure phone number starts with + for international format
    let formatted_to = if to.starts_with('+') { to.clone() } else { format!("+{}", to) };
    
    let body_data = format!("To={}&From={}&Body={}", 
        urlencoding::encode(&formatted_to), 
        urlencoding::encode(&from_number), 
        urlencoding::encode(&otp)
    );
    let auth_header = format!(
        "Basic {}",
        general_purpose::STANDARD.encode(format!("{}:{}", account_sid, auth_token))
    );

    let request = CanisterHttpRequestArgument {
        url,
        method: HttpMethod::POST,
        headers: vec![
            HttpHeader { name: "Authorization".to_string(), value: auth_header },
            HttpHeader { name: "Content-Type".to_string(), value: "application/x-www-form-urlencoded".to_string() },
        ],
        body: Some(body_data.into_bytes()),
        max_response_bytes: Some(2000),
        transform: None,
    };

    match http_request(request, 1_000_000_000).await {
        Ok((HttpResponse { status, body, .. },)) => {
            let code: u32 = status.0.try_into().unwrap_or(0);
            if code == 200 || code == 201 {
                Response { success: true, message: "OTP sent successfully!".to_string() }
            } else {
                Response { success: false, message: format!("Twilio error {}: {}", code, String::from_utf8_lossy(&body)) }
            }
        }
        Err(e) => Response { success: false, message: format!("HTTP request failed: {:?}", e) },
    }
}

#[update]
pub fn verify_otp(phone: String, otp: String) -> Response {
    let now = ic_cdk::api::time();

    OTP_STORE.with(|store| {
        let mut map = store.borrow_mut();
        match map.get(&phone) {
            None => Response { success: false, message: "No OTP requested for this phone.".to_string() },
            Some((stored_otp, expiry)) => {
                if now > *expiry {
                    Response { success: false, message: "OTP expired.".to_string() }
                } else if stored_otp != &otp {
                    Response { success: false, message: "Invalid OTP.".to_string() }
                } else {
                    map.remove(&phone);
                    VERIFIED_PHONES.with(|set| set.borrow_mut().insert(phone.clone()));
                    Response { success: true, message: "OTP verified successfully!".to_string() }
                }
            }
        }
    })
}

#[update]
pub fn debug_print_otps() -> Vec<(String, String, u64)> {
    let now = ic_cdk::api::time();
    OTP_STORE.with(|store| {
        store.borrow().iter().map(|(phone, (otp, expiry))| {
            let remaining_secs = if *expiry > now { (*expiry - now) / 1_000_000_000 } else { 0 };
            (phone.clone(), otp.clone(), remaining_secs)
        }).collect()
    })
}

#[update]
pub fn get_verified_phones() -> Vec<String> {
    VERIFIED_PHONES.with(|set| set.borrow().iter().cloned().collect())
}
