# OCR Kybra Canister - Proper Module Structure
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from kybra import query, update, blob, init, void

import json

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
    return "OK - Minimal version running"


@query
def health_check() -> str:
    """Health check endpoint - alias for backend compatibility"""
    return "OK - Minimal version running"


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
    """Process Egyptian ID image - minimal version"""
    return json.dumps({
        "status": "success",
        "message": "Minimal version - Egyptian ID processing not implemented",
        "data": {
            "image_size": len(image_data),
            "document_type": "egyptian_id",
            "timestamp": "2025-01-10T10:00:00Z"
        }
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


@init
def init_canister() -> void:
    """Initialize the canister"""
    global ocr_reader, id_card_model_detect, id_card_model_objects, country_codes

    # Initialize with None values for minimal version
    ocr_reader = None
    id_card_model_detect = None
    id_card_model_objects = None
    country_codes = None

    print("OCR Canister initialized in minimal mode")
