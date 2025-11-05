
use candid::{CandidType, Decode, Deserialize as CandidDeserialize, Encode};
use ic_cdk_macros::*;
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

#[derive(Debug, Deserialize)]
struct KycData {
    #[serde(rename = "submissionId")]
    submission_id: String,
    timestamp: String,
    phone: String,
    #[serde(rename = "documentFile")]
    document_file: String,
    #[serde(rename = "ocrData")]
    ocr_data: OcrData,
    #[serde(rename = "faceVerified")]
    face_verified: bool,
    status: String,
}

#[derive(Debug, Deserialize)]
struct OcrData {
    full_name: String,
    national_id: String,
    birth_date: String,
    age: u32,
    address: String,
    governorate: String,
    gender: String,
    face_image: String,
}

#[derive(Debug, Deserialize)]
struct KycSubmissionPayload {
    #[serde(rename = "kycData")]
    kyc_data: KycData,
}

const MAX_STRING_SIZE: u32 = 262144; // 256 KiB - Increased to accommodate base64 images
const MAX_FILE_METADATA_SIZE: u32 = 1024; // 1 KiB

#[derive(
    Clone, Debug, Default, CandidType, Deserialize, Serialize, PartialEq, Eq, PartialOrd, Ord,
)]
struct BoundedString(String);

impl Storable for BoundedString {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Borrowed(self.0.as_bytes())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Self(String::from_utf8(bytes.into_owned()).expect("UTF-8 conversion failed"))
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: MAX_STRING_SIZE,
        is_fixed_size: false,
    };
}

#[derive(Clone, Debug, Default, CandidType, Deserialize, Serialize)]
struct MimeType(String);

#[derive(Clone, Debug, Default, CandidType, Deserialize, Serialize)]
struct FileMetadata {
    path: BoundedString,
    mime_type: MimeType,
    size: u64,
    completed: bool,
}

impl Storable for FileMetadata {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).expect("Serialization failed"))
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).expect("Deserialization failed")
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: MAX_FILE_METADATA_SIZE,
        is_fixed_size: false,
    };
}

type Memory = VirtualMemory<DefaultMemoryImpl>;

type FileChunk = Vec<u8>;

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    static FILE_METADATA: RefCell<StableBTreeMap<BoundedString, FileMetadata, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0))))
    );

    static FILE_CHUNKS: RefCell<HashMap<String, Vec<Vec<u8>>>> = RefCell::new(HashMap::new());

    static EGYPTIAN_ID_RESULTS: RefCell<StableBTreeMap<BoundedString, BoundedString, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(3))),
        )
    );

    static PASSPORT_RESULTS: RefCell<StableBTreeMap<BoundedString, BoundedString, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(4))),
        )
    );

    static KYC_SUBMISSIONS: RefCell<StableBTreeMap<BoundedString, BoundedString, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(5))))
    );
    
    // Verification sessions for mobile handoff
    static VERIFICATION_SESSIONS: RefCell<StableBTreeMap<BoundedString, BoundedString, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(6))))
    );

    static NEXT_DOC_ID: RefCell<u64> = RefCell::new(0);
}

#[update]
fn add_document(path: String, mime_type: String, chunk: Vec<u8>, complete: bool) -> u64 {
    let doc_id = NEXT_DOC_ID.with(|id| {
        let mut id_mut = id.borrow_mut();
        let current_id = *id_mut;
        *id_mut += 1;
        current_id
    });
    upload(path, mime_type, chunk, complete);
    doc_id
}

#[update]
fn submit_kyc(submission_id: String, kyc_data_json: String) -> Result<(), String> {
    let parsed_payload: KycSubmissionPayload =
        serde_json::from_str(&kyc_data_json).map_err(|e| format!("Failed to parse KYC data: {}", e))?;

    let ocr_data = &parsed_payload.kyc_data.ocr_data;

    // Backend validation
    if ocr_data.full_name.is_empty() {
        return Err("Full name is required.".to_string());
    }
    if ocr_data.address.is_empty() {
        return Err("Address is required.".to_string());
    }
    if ocr_data.governorate.is_empty() {
        return Err("Governorate is required.".to_string());
    }
    if ocr_data.gender.is_empty() {
        return Err("Gender is required.".to_string());
    }

    // Check for duplicate National ID
    if national_id_exists(ocr_data.national_id.clone()) {
        return Err("This National ID has already been submitted.".to_string());
    }

    KYC_SUBMISSIONS.with(|p| {
        p.borrow_mut().insert(
            BoundedString(submission_id),
            BoundedString(kyc_data_json),
        )
    });
    Ok(())
}

#[query]
fn national_id_exists(national_id: String) -> bool {
    KYC_SUBMISSIONS.with(|submissions_ref| {
        let submissions = submissions_ref.borrow();
        for (_, kyc_data_json) in submissions.iter() {
            if let Ok(payload) = serde_json::from_str::<KycSubmissionPayload>(&kyc_data_json.0) {
                if payload.kyc_data.ocr_data.national_id == national_id {
                    return true;
                }
            }
        }
        false
    })
}

#[query]
fn get_kyc_submission(submission_id: String) -> Option<String> {
    KYC_SUBMISSIONS.with(|submissions| {
        submissions.borrow().get(&BoundedString(submission_id)).map(|s| s.0)
    })
}

#[query]
fn get_all_kyc_submissions() -> Vec<(String, String)> {
    KYC_SUBMISSIONS.with(|submissions| {
        submissions.borrow().iter().map(|(k, v)| (k.0, v.0)).collect()
    })
}

#[update]
fn delete_kyc_submission(submission_id: String) {
    KYC_SUBMISSIONS.with(|submissions| {
        submissions.borrow_mut().remove(&BoundedString(submission_id));
    });
}

#[update]
async fn get_egyptian_id_ocr_and_save(path: String) -> String {
    let result = get_egyptian_id_ocr(path.clone()).await;
    match result {
        Ok(ocr_result) => {
            EGYPTIAN_ID_RESULTS.with(|results| {
                results.borrow_mut().insert(BoundedString(path), BoundedString(ocr_result.clone()));
            });
            ocr_result
        }
        Err(e) => e,
    }
}

#[update]
async fn get_passport_ocr_and_save(path: String) -> String {
    let result = get_passport_ocr(path.clone()).await;
    match result {
        Ok(ocr_result) => {
            PASSPORT_RESULTS.with(|results| {
                results.borrow_mut().insert(BoundedString(path), BoundedString(ocr_result.clone()));
            });
            ocr_result
        }
        Err(e) => e,
    }
}

#[query]
fn get_egyptian_id_result(path: String) -> Option<String> {
    EGYPTIAN_ID_RESULTS.with(|results| {
        results.borrow().get(&BoundedString(path)).map(|s| s.0)
    })
}

#[query]
fn get_passport_result(path: String) -> Option<String> {
    PASSPORT_RESULTS.with(|results| {
        results.borrow().get(&BoundedString(path)).map(|s| s.0)
    })
}

#[query]
fn get_all_egyptian_id_results() -> Vec<(String, String)> {
    EGYPTIAN_ID_RESULTS.with(|results| {
        results.borrow().iter().map(|(k, v)| (k.0, v.0)).collect()
    })
}

#[query]
fn get_all_passport_results() -> Vec<(String, String)> {
    PASSPORT_RESULTS.with(|results| {
        results.borrow().iter().map(|(k, v)| (k.0, v.0)).collect()
    })
}

#[update]
fn delete_egyptian_id_result(path: String) {
    EGYPTIAN_ID_RESULTS.with(|results| {
        results.borrow_mut().remove(&BoundedString(path));
    });
}

#[update]
fn delete_passport_result(path: String) {
    PASSPORT_RESULTS.with(|results| {
        results.borrow_mut().remove(&BoundedString(path));
    });
}

#[update]
fn upload(path: String, mime_type: String, chunk: Vec<u8>, complete: bool) {
    ic_cdk::println!("📤 upload called - path: {}, mime_type: {}, chunk_size: {}, complete: {}", 
        path, mime_type, chunk.len(), complete);
    
    FILE_CHUNKS.with(|chunks_ref| {
        let mut chunks = chunks_ref.borrow_mut();
        chunks.entry(path.clone()).or_default().push(chunk);
    });

    if complete {
        let bounded_path = BoundedString(path.clone());
        let size = FILE_CHUNKS.with(|chunks_ref| {
            chunks_ref.borrow().get(&path).map_or(0, |c| c.iter().map(|v| v.len() as u64).sum())
        });
        
        ic_cdk::println!("💾 Storing file metadata - path: {}, size: {} bytes", path, size);
        
        FILE_METADATA.with(|metadata_ref| {
            let mut metadata = metadata_ref.borrow_mut();
            metadata.insert(bounded_path.clone(), FileMetadata {
                path: bounded_path,
                mime_type: MimeType(mime_type),
                size,
                completed: true,
            });
        });
        
        ic_cdk::println!("✅ File upload complete for: {}", path);
    }
}

#[query]
fn list() -> Vec<FileMetadata> {
    FILE_METADATA.with(|metadata_ref| {
        metadata_ref.borrow().iter().map(|(_, v)| v.clone()).collect()
    })
}

#[update]
fn delete(path: String) {
    let bounded_path = BoundedString(path.clone());
    FILE_METADATA.with(|metadata_ref| {
        metadata_ref.borrow_mut().remove(&bounded_path);
    });
    FILE_CHUNKS.with(|chunks_ref| {
        chunks_ref.borrow_mut().remove(&path);
    });
}

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
}

#[derive(Clone, Debug, CandidType, CandidDeserialize)]
struct OcrRequest {
    path: String,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct OcrResult {
    status: String,
    message: String,
    data: Option<String>,
}

const OCR_SERVER_BASE_URL: &str = "http://194.31.150.154:5000";

async fn get_ocr_health() -> Result<String, String> {
    let url = format!("{}/health", OCR_SERVER_BASE_URL);
    let request = ic_cdk::api::management_canister::http_request::CanisterHttpRequestArgument {
        url,
        method: ic_cdk::api::management_canister::http_request::HttpMethod::GET,
        headers: vec![],
        body: None,
        max_response_bytes: None,
        transform: None,
    };
    match ic_cdk::api::management_canister::http_request::http_request(request, 20_000_000_000).await {
        Ok((response,)) => Ok(String::from_utf8(response.body).unwrap()),
        Err((_, message)) => Err(message),
    }
}

async fn get_egyptian_id_ocr(path: String) -> Result<String, String> {
    let image_data = get_asset_by_path(&path)?;
    let url = format!("{}/egyptian-id", OCR_SERVER_BASE_URL);
    let request_headers = vec![ic_cdk::api::management_canister::http_request::HttpHeader {
        name: "Content-Type".to_string(),
        value: "application/octet-stream".to_string(),
    }];
    let request = ic_cdk::api::management_canister::http_request::CanisterHttpRequestArgument {
        url,
        method: ic_cdk::api::management_canister::http_request::HttpMethod::POST,
        headers: request_headers,
        body: Some(image_data),
        max_response_bytes: None,
        transform: None,
    };
    match ic_cdk::api::management_canister::http_request::http_request(request, 50_000_000_000).await {
        Ok((response,)) => Ok(String::from_utf8(response.body).unwrap()),
        Err((_, message)) => Err(message),
    }
}

async fn get_passport_ocr(path: String) -> Result<String, String> {
    let image_data = get_asset_by_path(&path)?;
    let url = format!("{}/passport", OCR_SERVER_BASE_URL);
    let request_headers = vec![ic_cdk::api::management_canister::http_request::HttpHeader {
        name: "Content-Type".to_string(),
        value: "application/octet-stream".to_string(),
    }];
    let request = ic_cdk::api::management_canister::http_request::CanisterHttpRequestArgument {
        url,
        method: ic_cdk::api::management_canister::http_request::HttpMethod::POST,
        headers: request_headers,
        body: Some(image_data),
        max_response_bytes: None,
        transform: None,
    };
    match ic_cdk::api::management_canister::http_request::http_request(request, 50_000_000_000).await {
        Ok((response,)) => Ok(String::from_utf8(response.body).unwrap()),
        Err((_, message)) => Err(message),
    }
}

fn get_asset_by_path(path: &str) -> Result<Vec<u8>, String> {
    FILE_CHUNKS.with(|chunks_ref| {
        let chunks = chunks_ref.borrow();
        let chunk_data: Vec<u8> = chunks.get(path).cloned().unwrap_or_default().into_iter().flatten().collect();
        if chunk_data.is_empty() {
            Err("Asset not found".to_string())
        } else {
            Ok(chunk_data)
        }
    })
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct StreamingToken {}


#[query]
fn http_request(request: CanisterHttpRequestArgument) -> HttpResponse {
    let path = request.url.clone();
    if path.starts_with("/api/") {
        handle_api_request(request)
    } else {
        serve_static_file(request)
    }
}

fn serve_static_file(request: CanisterHttpRequestArgument) -> HttpResponse {
    let raw_path = request.url.strip_prefix('/').unwrap_or(&request.url);
    let decoded_path = urlencoding::decode(raw_path).unwrap_or_else(|_| std::borrow::Cow::from(raw_path)).to_string();

    ic_cdk::println!("🔍 serve_static_file - raw_path: {}, decoded_path: {}", raw_path, decoded_path);

    let bounded_path = BoundedString(decoded_path.clone());
    
    FILE_METADATA.with(|metadata_ref| {
        let metadata = metadata_ref.borrow();
        
        // Debug: List all stored files
        ic_cdk::println!("📁 Files in storage:");
        for (key, _) in metadata.iter() {
            ic_cdk::println!("  - {}", key.0);
        }
        
        if let Some(meta) = metadata.get(&bounded_path) {
            ic_cdk::println!("✅ File found in metadata");
            let chunks: Vec<u8> = FILE_CHUNKS.with(|chunks_ref| {
                chunks_ref.borrow().get(&decoded_path).cloned().unwrap_or_default().into_iter().flatten().collect()
            });

            ic_cdk::println!("📦 Chunk size: {} bytes", chunks.len());

            HttpResponse {
                status_code: 200,
                headers: vec![("Content-Type".to_string(), meta.mime_type.0.clone())],
                body: chunks,
            }
        } else {
            ic_cdk::println!("❌ File NOT found in metadata for path: {}", decoded_path);
            HttpResponse {
                status_code: 404,
                headers: vec![],
                body: "Not Found".as_bytes().to_vec(),
            }
        }
    })
}

fn handle_api_request(request: CanisterHttpRequestArgument) -> HttpResponse {
    if request.url == "/api/process-document" {
        handle_process_document()
    } else {
        HttpResponse {
            status_code: 404,
            headers: vec![("Content-Type".to_string(), "application/json".to_string())],
            body: "{\"error\":\"Not Found\"}".as_bytes().to_vec(),
        }
    }
}

fn handle_process_document() -> HttpResponse {
    HttpResponse {
        status_code: 200,
        headers: vec![("Content-Type".to_string(), "application/json".to_string())],
        body: "{\"success\":true,\"data\":{\"name\":\"Sample Name\",\"idNumber\":\"123456789\",\"birthDate\":\"1990-01-01\"}}".as_bytes().to_vec(),
    }
}

// ===========================
// Verification Session APIs
// ===========================

#[derive(CandidType, Deserialize, Serialize, Clone)]
struct VerificationSession {
    session_id: String,
    status: String, // "waiting", "in_progress", "completed"
    created_at: u64,
    completed_at: Option<u64>,
    data: Option<String>, // JSON string of KYC data
}

/// Create or update a verification session
#[update]
fn create_verification_session(session_id: String) -> Result<(), String> {
    let session = VerificationSession {
        session_id: session_id.clone(),
        status: "waiting".to_string(),
        created_at: ic_cdk::api::time(),
        completed_at: None,
        data: None,
    };
    
    let session_json = serde_json::to_string(&session)
        .map_err(|e| format!("Failed to serialize session: {}", e))?;
    
    VERIFICATION_SESSIONS.with(|sessions| {
        sessions.borrow_mut().insert(
            BoundedString(session_id),
            BoundedString(session_json),
        );
    });
    
    Ok(())
}

/// Get verification session status
#[query]
fn get_verification_status(session_id: String) -> Option<String> {
    VERIFICATION_SESSIONS.with(|sessions| {
        sessions.borrow().get(&BoundedString(session_id)).map(|s| s.0)
    })
}

/// Validate if session exists and is valid for NEW access
/// Returns false if session is already in use, expired, or doesn't exist
#[query]
fn verify_session(session_id: String) -> bool {
    VERIFICATION_SESSIONS.with(|sessions| {
        if let Some(session_json) = sessions.borrow().get(&BoundedString(session_id)) {
            if let Ok(session) = serde_json::from_str::<VerificationSession>(&session_json.0) {
                // Check if session is expired (24 hours)
                let current_time = ic_cdk::api::time();
                let expiry_time = 24 * 60 * 60 * 1_000_000_000; // 24 hours in nanoseconds
                let is_expired = current_time - session.created_at >= expiry_time;
                
                if is_expired {
                    return false;
                }
                
                // Session is only valid for NEW access if status is "waiting"
                // Reject if already in_progress or completed (prevents multiple users)
                return session.status == "waiting";
            }
        }
        false
    })
}

/// Mark verification as in progress
#[update]
fn mark_verification_in_progress(session_id: String) -> Result<(), String> {
    VERIFICATION_SESSIONS.with(|sessions| {
        let mut sessions_mut = sessions.borrow_mut();
        
        if let Some(session_json) = sessions_mut.get(&BoundedString(session_id.clone())) {
            let mut session: VerificationSession = serde_json::from_str(&session_json.0)
                .map_err(|e| format!("Failed to parse session: {}", e))?;
            
            session.status = "in_progress".to_string();
            
            let updated_json = serde_json::to_string(&session)
                .map_err(|e| format!("Failed to serialize session: {}", e))?;
            
            sessions_mut.insert(
                BoundedString(session_id),
                BoundedString(updated_json),
            );
            
            Ok(())
        } else {
            Err("Session not found".to_string())
        }
    })
}

/// Complete verification with data
#[update]
fn complete_verification(session_id: String, kyc_data: String) -> Result<(), String> {
    VERIFICATION_SESSIONS.with(|sessions| {
        let mut sessions_mut = sessions.borrow_mut();
        
        if let Some(session_json) = sessions_mut.get(&BoundedString(session_id.clone())) {
            let mut session: VerificationSession = serde_json::from_str(&session_json.0)
                .map_err(|e| format!("Failed to parse session: {}", e))?;
            
            session.status = "completed".to_string();
            session.completed_at = Some(ic_cdk::api::time());
            session.data = Some(kyc_data);
            
            let updated_json = serde_json::to_string(&session)
                .map_err(|e| format!("Failed to serialize session: {}", e))?;
            
            sessions_mut.insert(
                BoundedString(session_id),
                BoundedString(updated_json),
            );
            
            Ok(())
        } else {
            Err("Session not found".to_string())
        }
    })
}

/// Get all verification sessions (for debugging)
#[query]
fn get_all_verification_sessions() -> Vec<(String, String)> {
    VERIFICATION_SESSIONS.with(|sessions| {
        sessions
            .borrow()
            .iter()
            .map(|(k, v)| (k.0.clone(), v.0.clone()))
            .collect()
    })
}

/// Delete a verification session
#[update]
fn delete_verification_session(session_id: String) {
    VERIFICATION_SESSIONS.with(|sessions| {
        sessions.borrow_mut().remove(&BoundedString(session_id));
    });
}
