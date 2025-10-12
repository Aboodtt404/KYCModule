
use candid::{CandidType, Decode, Deserialize, Encode};
use ic_cdk_macros::{query, update};
use std::borrow::Cow;
use std::cell::RefCell;
use std::collections::HashMap;
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    storable::Storable,
    DefaultMemoryImpl, StableBTreeMap, BoundedStorable,
};

const MAX_STRING_SIZE: u32 = 256;

#[derive(Clone, Debug, CandidType, Deserialize, PartialEq, PartialOrd, Eq, Ord)]
struct BoundedString(String);

impl Storable for BoundedString {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(self.0.as_bytes().to_vec())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        BoundedString(String::from_utf8(bytes.to_vec()).unwrap())
    }
}

impl BoundedStorable for BoundedString {
    const MAX_SIZE: u32 = MAX_STRING_SIZE;
    const IS_FIXED_SIZE: bool = false;
}

type Memory = VirtualMemory<DefaultMemoryImpl>;

#[derive(Clone, Debug, CandidType, Deserialize)]
struct FileMetadata {
    path: BoundedString,
    mime_type: BoundedString,
    size: u64,
    completed: bool,
}

impl Storable for FileMetadata {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }
}

impl BoundedStorable for FileMetadata {
    const MAX_SIZE: u32 = 2 * MAX_STRING_SIZE + 8 + 1;
    const IS_FIXED_SIZE: bool = false;
}

type FileChunk = Vec<u8>;

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    static FILE_METADATA: RefCell<StableBTreeMap<BoundedString, FileMetadata, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0))),
        )
    );

    static FILE_CHUNKS: RefCell<HashMap<String, Vec<Vec<u8>>>> = RefCell::new(HashMap::new());

    static OCR_RATINGS: RefCell<StableBTreeMap<u64, u64, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(2))),
        )
    );

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
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(5))),
        )
    );

    static NEXT_DOC_ID: RefCell<u64> = RefCell::new(0);
}

#[update]
fn rate_ocr_quality(doc_id: u64, rating: u64) {
    OCR_RATINGS.with(|ratings| {
        ratings.borrow_mut().insert(doc_id, rating);
    });
}

#[query]
fn get_ocr_rating(doc_id: u64) -> Option<u64> {
    OCR_RATINGS.with(|ratings| {
        ratings.borrow().get(&doc_id)
    })
}

#[query]
fn get_all_ocr_ratings() -> Vec<(u64, u64)> {
    OCR_RATINGS.with(|ratings| {
        ratings.borrow().iter().collect()
    })
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
fn submit_kyc(submission_id: String, kyc_data: String) {
    KYC_SUBMISSIONS.with(|submissions| {
        submissions.borrow_mut().insert(BoundedString(submission_id), BoundedString(kyc_data));
    });
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
    FILE_CHUNKS.with(|chunks_ref| {
        let mut chunks = chunks_ref.borrow_mut();
        chunks.entry(path.clone()).or_default().push(chunk);
    });

    if complete {
        let bounded_path = BoundedString(path.clone());
        let size = FILE_CHUNKS.with(|chunks_ref| {
            chunks_ref.borrow().get(&path).map_or(0, |c| c.iter().map(|v| v.len() as u64).sum())
        });
        FILE_METADATA.with(|metadata_ref| {
            let mut metadata = metadata_ref.borrow_mut();
            metadata.insert(bounded_path.clone(), FileMetadata {
                path: bounded_path,
                mime_type: BoundedString(mime_type),
                size,
                completed: true,
            });
        });
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

#[derive(Clone, Debug, CandidType, Deserialize)]
struct HttpRequest {
    method: String,
    url: String,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct HttpResponse {
    status_code: u16,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
    streaming_strategy: Option<StreamingStrategy>,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
enum StreamingStrategy {
    Callback {
        callback: candid::Func,
        token: StreamingToken,
    },
}

#[derive(Clone, Debug, CandidType, Deserialize)]
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
fn http_request(request: HttpRequest) -> HttpResponse {
    let path = request.url.clone();
    if path.starts_with("/api/") {
        handle_api_request(request)
    } else {
        serve_static_file(request)
    }
}

fn serve_static_file(request: HttpRequest) -> HttpResponse {
    let path = request.url;
    let bounded_path = BoundedString(path.clone());
    
    FILE_METADATA.with(|metadata_ref| {
        let metadata = metadata_ref.borrow();
        if let Some(meta) = metadata.get(&bounded_path) {
            let chunks: Vec<u8> = FILE_CHUNKS.with(|chunks_ref| {
                chunks_ref.borrow().get(&path).cloned().unwrap_or_default().into_iter().flatten().collect()
            });

            HttpResponse {
                status_code: 200,
                headers: vec![("Content-Type".to_string(), meta.mime_type.0.clone())],
                body: chunks,
                streaming_strategy: None,
            }
        } else {
            HttpResponse {
                status_code: 404,
                headers: vec![],
                body: "Not Found".as_bytes().to_vec(),
                streaming_strategy: None,
            }
        }
    })
}

fn handle_api_request(request: HttpRequest) -> HttpResponse {
    if request.url == "/api/process-document" {
        handle_process_document()
    } else {
        HttpResponse {
            status_code: 404,
            headers: vec![("Content-Type".to_string(), "application/json".to_string())],
            body: "{\"error\":\"Not Found\"}".as_bytes().to_vec(),
            streaming_strategy: None,
        }
    }
}

fn handle_process_document() -> HttpResponse {
    HttpResponse {
        status_code: 200,
        headers: vec![("Content-Type".to_string(), "application/json".to_string())],
        body: "{\"success\":true,\"data\":{\"name\":\"Sample Name\",\"idNumber\":\"123456789\",\"birthDate\":\"1990-01-01\"}}".as_bytes().to_vec(),
        streaming_strategy: None,
    }
}
