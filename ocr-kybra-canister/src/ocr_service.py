# Main OCR Service Interface
from kybra import ic, query, update
import json
from typing import Dict, Any


@query
def health_check() -> str:
    """Health check for OCR service"""
    return json.dumps({
        "status": "healthy",
        "service": "OCR Canister",
        "version": "1.0.0",
        "canister_id": str(ic.id())
    })


@update
def process_egyptian_id(image_data: bytes) -> str:
    """Process Egyptian ID card image"""
    try:
        from .egyptian_id_processor import process_egyptian_id_card
        result = process_egyptian_id_card(image_data)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e),
            "data": None
        })


@update
def process_passport(image_data: bytes) -> str:
    """Process passport image"""
    try:
        from .passport_processor import process_passport_image
        result = process_passport_image(image_data)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": str(e),
            "data": None
        })


@query
def get_service_info() -> str:
    """Get OCR service information"""
    return json.dumps({
        "service": "OCR Canister",
        "version": "1.0.0",
        "supported_documents": ["egyptian_id", "passport"],
        "libraries": {
            "opencv": "4.12.0",
            "numpy": "2.2.6",
            "easyocr": "1.7.2",
            "yolo": "8.3.192"
        },
        "status": "ready"
    })
