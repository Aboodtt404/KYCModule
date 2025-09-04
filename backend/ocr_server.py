#!/usr/bin/env python3
"""
Simple OCR Server
Basic Flask server for Tesseract OCR processing
Local, lightweight implementation
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from passport_mrz_detector import PassportMRZDetector
from egyptian_ocr_id import detect_and_process_id_card
from passport_ocr import process_passport, get_passport_debug_info
import logging
import time
import tempfile
import os

# Basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Initialize OCR engines
mrz_detector = PassportMRZDetector()


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "services": {
            "passport_mrz": True,
            "egyptian_id": True
        }
    })


@app.route('/ocr', methods=['POST'])
def process_ocr():
    """Process OCR request - redirects to Egyptian ID processing"""
    try:
        # Check if request has data
        if not request.data:
            return jsonify({"error": "No image data provided"}), 400

        logger.info(f"Received OCR request: {len(request.data)} bytes")

        # Redirect to Egyptian ID processing
        return process_egyptian_id()

    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/passport-mrz', methods=['POST'])
def process_passport_mrz():
    """Passport MRZ detection and OCR using PyImageSearch method"""
    try:
        start_time = time.time()

        if not request.data:
            return jsonify({"error": "No image data provided"}), 400

        logger.info(f"Passport MRZ request: {len(request.data)} bytes")

        # Decode image
        import numpy as np
        import cv2

        image_np = np.frombuffer(request.data, np.uint8)
        image = cv2.imdecode(image_np, cv2.IMREAD_COLOR)

        if image is None:
            return jsonify({"error": "Could not decode image"}), 400

        # Process passport using MRZ detector
        result = mrz_detector.process_passport(image, lang='eng')

        processing_time = time.time() - start_time
        result["processing_time"] = round(processing_time, 2)

        logger.info(f"Passport MRZ completed in {processing_time:.2f}s")

        if result["success"]:
            logger.info("📋 Comprehensive Passport Results:")
            logger.info(
                f"   📊 Total regions detected: {result['total_regions']}")
            logger.info(
                f"   🏷️ Data types found: {', '.join(result['data_types_found'])}")

            # Show organized data by type
            organized = result.get('organized_data', {})
            for data_type, items in organized.items():
                logger.info(f"   📝 {data_type.replace('_', ' ').title()}:")
                # Show top 3 of each type
                for i, item in enumerate(items[:3], 1):
                    confidence_icon = "🟢" if item['confidence'] > 0.8 else "🟡" if item['confidence'] > 0.5 else "🔴"
                    logger.info(
                        f"      {i}. {confidence_icon} '{item['text'][:40]}...' (conf: {item['confidence']:.3f}) [{item['region']}]")

                if len(items) > 3:
                    logger.info(
                        f"      ... and {len(items) - 3} more {data_type} items")

            # Show MRZ info if available
            if result.get('mrz_info') and result['mrz_info'].get('type'):
                logger.info(f"   🛂 MRZ Format: {result['mrz_info']['type']}")
                if result['mrz_info'].get('line_data'):
                    for i, line in enumerate(result['mrz_info']['line_data'], 1):
                        logger.info(f"      Line {i}: {line}")
        else:
            logger.warning(
                f"   ❌ Passport processing failed: {result['error']}")

        return jsonify(result)

    except Exception as e:
        logger.error(f"Passport MRZ error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/passport', methods=['POST'])
def process_passport_ocr():
    """Passport OCR processing using MRZ extraction and EasyOCR"""
    try:
        start_time = time.time()

        if not request.data:
            return jsonify({"error": "No image data provided"}), 400

        logger.info(f"Passport OCR request: {len(request.data)} bytes")

        # Save uploaded image to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
            tmp_file.write(request.data)
            tmp_file_path = tmp_file.name

        try:
            # Process passport using the new OCR module
            result = process_passport(tmp_file_path)

            # Get debug information
            debug_info = get_passport_debug_info(tmp_file_path)

            processing_time = time.time() - start_time

            # Prepare response
            response = {
                "success": result["success"],
                "processing_time": round(processing_time, 2),
                "data": result["data"] if result["success"] else None,
                "error": result["error"] if not result["success"] else None,
                "debug_info": debug_info
            }

            if result["success"]:
                logger.info(
                    f"Passport OCR completed in {processing_time:.2f}s")
                logger.info("📋 Passport Data Extracted:")
                data = result["data"]
                for key, value in data.items():
                    logger.info(f"   {key.replace('_', ' ').title()}: {value}")
            else:
                logger.warning(f"Passport OCR failed: {result['error']}")

            return jsonify(response)

        finally:
            # Clean up temporary file
            if os.path.exists(tmp_file_path):
                os.remove(tmp_file_path)

    except Exception as e:
        logger.error(f"Passport OCR error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/info', methods=['GET'])
def server_info():
    """Get server information"""
    return jsonify({
        "server": "OCR Server",
        "version": "1.0.0",
        "services": {
            "egyptian_id": "Egyptian ID card processing with YOLO + EasyOCR",
            "passport_mrz": "Passport MRZ detection and OCR",
            "passport": "Passport OCR using MRZ extraction and EasyOCR"
        },
        "endpoints": {
            "/health": "Health check",
            "/ocr": "Egyptian ID OCR processing",
            "/egyptian-id": "Egyptian ID card processing",
            "/passport-mrz": "Passport MRZ detection and OCR",
            "/passport": "Passport OCR using MRZ extraction and EasyOCR",
            "/debug-image/<filename>": "Serve debug images",
            "/info": "Server information"
        }
    })


@app.route('/egyptian-id', methods=['POST'])
def process_egyptian_id():
    """Process Egyptian ID card using specialized models"""
    try:
        start_time = time.time()

        if not request.data:
            return jsonify({"error": "No image data provided"}), 400

        logger.info(f"Egyptian ID request: {len(request.data)} bytes")
        logger.info(f"Request content type: {request.content_type}")

        # Check if data looks like valid image data
        if len(request.data) < 100:
            logger.error(
                f"Data too small to be a valid image: {len(request.data)} bytes")
            return jsonify({"error": f"Data too small to be a valid image: {len(request.data)} bytes"}), 400

        # Save image data to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp_file:
            temp_file.write(request.data)
            temp_file_path = temp_file.name

        try:
            # Process the Egyptian ID card
            first_name, second_name, full_name, national_id, address, birth_date, governorate, gender, detected_fields, debug_image_path = detect_and_process_id_card(
                temp_file_path)

            processing_time = time.time() - start_time

            result = {
                "success": True,
                "processing_time": round(processing_time, 2),
                "method": "egyptian_id",
                "extracted_data": {
                    "first_name": first_name,
                    "second_name": second_name,
                    "full_name": full_name,
                    "national_id": national_id,
                    "address": address,
                    "birth_date": birth_date,
                    "governorate": governorate,
                    "gender": gender
                },
                "debug_info": {
                    "detected_fields": detected_fields,
                    "debug_image_path": debug_image_path,
                    "cropped_image_path": "debug_images/cropped_id_card.jpg",
                    "yolo_output_path": "debug_images/d2.jpg",
                    "preprocessed_image_path": "debug_images/preprocessed_image.jpg"
                },
                "total_fields": 8
            }

            logger.info(
                f"Egyptian ID processing completed in {processing_time:.2f}s")
            logger.info(
                f"Extracted: {full_name} - ID: {national_id} - {governorate}")

            return jsonify(result)

        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)

    except Exception as e:
        logger.error(f"Egyptian ID processing error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/debug-image/<filename>', methods=['GET'])
def get_debug_image(filename):
    """Serve debug images"""
    import os
    from flask import send_file

    # Security: only allow specific debug image files
    allowed_files = ['egyptian_id_debug.jpg',
                     'cropped_id_card.jpg', 'd2.jpg', 'preprocessed_image.jpg']

    if filename not in allowed_files:
        return jsonify({"error": "File not allowed"}), 403

    # Look for file in debug_images folder
    debug_folder = 'debug_images'
    file_path = os.path.join(debug_folder, filename)

    if not os.path.exists(file_path):
        return jsonify({"error": "Debug image not found"}), 404

    return send_file(file_path, mimetype='image/jpeg')


@app.route('/', methods=['GET'])
def index():
    """Root endpoint"""
    return jsonify({
        "message": "OCR Server is running",
        "endpoints": ["/health", "/ocr", "/egyptian-id", "/passport-mrz", "/debug-image/<filename>", "/info"],
        "status": "ready"
    })


if __name__ == '__main__':
    print("🔤 OCR Server")
    print("=" * 40)
    print("✅ Services: Egyptian ID OCR, Passport MRZ")

    print("\n🌐 Server Endpoints:")
    print("  📊 Health: http://localhost:5000/health")
    print("  🔍 OCR: http://localhost:5000/ocr (redirects to Egyptian ID)")
    print("  🇪🇬 Egyptian ID: http://localhost:5000/egyptian-id")
    print("  🛂 Passport MRZ: http://localhost:5000/passport-mrz")
    print("  🖼️ Debug Images: http://localhost:5000/debug-image/<filename>")
    print("  ℹ️ Info: http://localhost:5000/info")

    print("\n🚀 Starting server on http://localhost:5000")
    print("=" * 40)

    app.run(
        host='0.0.0.0',
        port=5000,
        debug=False,
        threaded=True
    )
