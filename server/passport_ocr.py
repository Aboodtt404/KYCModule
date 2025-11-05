#!/usr/bin/env python3
"""
Minimal passport_ocr module stub.
This module provides placeholder functions for passport OCR processing.
Replace with actual implementation if passport OCR is needed.
"""

import logging

logger = logging.getLogger(__name__)


def process_passport(image_path):
    """
    Process passport image and extract data.
    
    Args:
        image_path: Path to the passport image file
        
    Returns:
        dict: Result dictionary with 'success', 'data', and 'error' keys
    """
    logger.warning("⚠️ passport_ocr.process_passport called but not implemented")
    return {
        "success": False,
        "error": "Passport OCR functionality not yet implemented",
        "data": None
    }


def get_passport_debug_info(image_path):
    """
    Get debug information for passport processing.
    
    Args:
        image_path: Path to the passport image file
        
    Returns:
        dict: Debug information dictionary, or None
    """
    logger.warning("⚠️ passport_ocr.get_passport_debug_info called but not implemented")
    return None

