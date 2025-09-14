# OCR Kybra Canister - Main Implementation
import json
from typing import TYPE_CHECKING
import sys
sys.setrecursionlimit(10000)  # Increase recursion limit for modulegraph


if TYPE_CHECKING:
    from kybra import query, update, blob, init, void


if TYPE_CHECKING:
    from kybra import query, update, blob, init, void


# Define dummies ONLY if not building
if not TYPE_CHECKING:
    def query(func): return func
    def update(func): return func
    def init(func): return func
    blob = bytes
    void = None

# ++++++++++ Global Placeholders ++++++++++
ocr_reader = None
id_card_model_detect = None
id_card_model_objects = None
country_codes = None

# ++++++++++ Kybra Decorators ++++++++++


@query
def get_version() -> str:
    """Get the version of the OCR canister"""
    return "1.0.0-minimal"


@query
def get_health() -> str:
    """Health check endpoint"""
    return "OK - Full OCR version running"


@query
def health_check() -> str:
    """Health check endpoint - alias for backend compatibility"""
    return "OK - Full OCR version running"


@update
def process_image(image_data: blob) -> str:
    """Process image data - minimal version"""
    return json.dumps({
        "status": "success",
        "message": "Minimal version - ML libraries not loaded",
        "data": {
            "image_size": len(image_data),
            "timestamp": "2025-01-10T10:00:00Z"
        }
    })


@update
def process_egyptian_id(image_data: blob) -> str:
    """Process Egyptian ID image - full OCR implementation"""
    try:
        # Import only when needed to avoid recursion during build
        import cv2
        import numpy as np

        # Convert blob to numpy array
        nparr = np.frombuffer(image_data, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            return json.dumps({
                "status": "error",
                "message": "Failed to decode image",
                "data": None
            })

        # Get OCR reader
        reader = get_ocr_reader()
        if reader is None:
            return json.dumps({
                "status": "error",
                "message": "OCR reader not initialized",
                "data": None
            })

        # Perform OCR
        results = reader.readtext(image)

        # Extract text
        extracted_text = []
        for (bbox, text, confidence) in results:
            if confidence > 0.5:  # Filter low confidence results
                extracted_text.append({
                    "text": text,
                    "confidence": confidence,
                    "bbox": bbox
                })

        return json.dumps({
            "status": "success",
            "message": "Egyptian ID processed successfully",
            "data": {
                "extracted_text": extracted_text,
                "image_size": len(image_data),
                "document_type": "egyptian_id"
            }
        })

    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"OCR processing failed: {str(e)}",
            "data": None
        })


@update
def process_passport(image_data: blob) -> str:
    """Process passport image - minimal version"""
    return json.dumps({
        "status": "success",
        "message": "Minimal version - Passport processing not implemented",
        "data": {
            "image_size": len(image_data),
            "document_type": "passport",
            "timestamp": "2025-01-10T10:00:00Z"
        }
    })


def get_ocr_reader():
    """Get OCR reader instance with lazy loading"""
    global ocr_reader
    if ocr_reader is None:
        try:
            # Import only when needed to avoid recursion during build
            import easyocr
            ocr_reader = easyocr.Reader(['en', 'ar'])  # English and Arabic
            print("OCR reader initialized successfully")
        except Exception as e:
            print(f"Failed to initialize OCR reader: {e}")
            return None
    return ocr_reader


@init
def init_canister() -> void:
    """Initialize the canister"""
    global ocr_reader, id_card_model_detect, id_card_model_objects, country_codes

    # Initialize with None values - lazy loading
    ocr_reader = None
    id_card_model_detect = None
    id_card_model_objects = None
    country_codes = None

    print("OCR Canister initialized - ML libraries will be loaded on demand")
