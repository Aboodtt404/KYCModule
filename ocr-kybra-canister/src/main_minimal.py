# OCR Kybra Canister - Minimal Implementation (No ML Libraries)
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    # Only import build-time decorators and types here
    from kybra import query, update, blob, init, void

import json

# Define dummies ONLY if not building
if not TYPE_CHECKING:
    def query(func): return func
    def update(func): return func
    def init(func): return func
    blob = bytes
    void = None

# ++++++++++ Global Placeholders for Lazy Loading ++++++++++
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

@update
def process_image(image_data: blob) -> str:
    """Process image data - minimal version"""
    # For now, just return a placeholder response
    return json.dumps({
        "status": "success",
        "message": "Minimal version - ML libraries not loaded",
        "data": {
            "image_size": len(image_data),
            "timestamp": "2025-01-10T10:00:00Z"
        }
    })

@init
def init_canister():
    """Initialize the canister"""
    global ocr_reader, id_card_model_detect, id_card_model_objects, country_codes
    
    # Initialize with None values for minimal version
    ocr_reader = None
    id_card_model_detect = None
    id_card_model_objects = None
    country_codes = None
    
    print("OCR Canister initialized in minimal mode")

# ++++++++++ Helper Functions (Placeholders) ++++++++++
def get_ocr_reader() -> None:
    """Get OCR reader instance - placeholder"""
    return None

def get_id_card_model_detect() -> None:
    """Get ID card detection model - placeholder"""
    return None

def get_id_card_model_objects() -> None:
    """Get ID card objects model - placeholder"""
    return None

def get_country_codes(path: str = 'models/country_codes.json') -> None:
    """Get country codes - placeholder"""
    return None
