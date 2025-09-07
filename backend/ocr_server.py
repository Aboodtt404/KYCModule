#!/usr/bin/env python3

from flask import Flask, request, jsonify
from flask_cors import CORS
from egyptian_ocr_id import detect_and_process_id_card
from passport_ocr import process_passport, get_passport_debug_info
import logging
import time
import tempfile
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})


@app.route('/health', methods=['GET'])
def health_check():
    health_status = {
        "status": "healthy",
        "services": {},
        "errors": [],
        "timestamp": time.time()
    }

    # Test Egyptian ID service
    try:
        from egyptian_ocr_id import detect_and_process_id_card
        health_status["services"]["egyptian_id"] = True
    except ImportError as e:
        health_status["services"]["egyptian_id"] = False
        health_status["errors"].append(f"Egyptian ID import error: {str(e)}")
        health_status["status"] = "degraded"
    except Exception as e:
        health_status["services"]["egyptian_id"] = False
        health_status["errors"].append(f"Egyptian ID service error: {str(e)}")
        health_status["status"] = "degraded"

    # Test Passport service
    try:
        from passport_ocr import process_passport, get_passport_debug_info
        health_status["services"]["passport"] = True
    except ImportError as e:
        health_status["services"]["passport"] = False
        health_status["errors"].append(f"Passport import error: {str(e)}")
        health_status["status"] = "degraded"
    except Exception as e:
        health_status["services"]["passport"] = False
        health_status["errors"].append(f"Passport service error: {str(e)}")
        health_status["status"] = "degraded"

    # Check if any service is down
    if not all(health_status["services"].values()):
        health_status["status"] = "degraded"

    return jsonify(health_status)


@app.route('/ocr', methods=['POST'])
def process_ocr():
    try:
        if not request.data:
            return jsonify({"error": "No image data provided"}), 400

        logger.info(f"Received OCR request: {len(request.data)} bytes")

        return process_egyptian_id()

    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/passport', methods=['POST'])
def process_passport_ocr():
    try:
        start_time = time.time()

        if not request.data:
            return jsonify({"error": "No image data provided"}), 400

        logger.info(f"Passport OCR request: {len(request.data)} bytes")

        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
            tmp_file.write(request.data)
            tmp_file_path = tmp_file.name

        try:
            result = process_passport(tmp_file_path)

            debug_info = get_passport_debug_info(tmp_file_path)

            processing_time = time.time() - start_time

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
            if os.path.exists(tmp_file_path):
                os.remove(tmp_file_path)

    except Exception as e:
        logger.error(f"Passport OCR error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/info', methods=['GET'])
def server_info():
    return jsonify({
        "server": "OCR Server",
        "version": "1.0.0",
        "services": {
            "egyptian_id": "Egyptian ID card processing with YOLO + EasyOCR",
            "passport": "Passport OCR using MRZ extraction and EasyOCR"
        },
        "endpoints": {
            "/health": "Health check",
            "/ocr": "Egyptian ID OCR processing",
            "/egyptian-id": "Egyptian ID card processing",
            "/passport": "Passport OCR using MRZ extraction and EasyOCR",
            "/debug-image/<filename>": "Serve debug images",
            "/info": "Server information"
        }
    })


@app.route('/egyptian-id', methods=['POST'])
def process_egyptian_id():
    try:
        start_time = time.time()

        if not request.data:
            return jsonify({"error": "No image data provided"}), 400

        logger.info(f"Egyptian ID request: {len(request.data)} bytes")
        logger.info(f"Request content type: {request.content_type}")

        if len(request.data) < 100:
            logger.error(
                f"Data too small to be a valid image: {len(request.data)} bytes")
            return jsonify({"error": f"Data too small to be a valid image: {len(request.data)} bytes"}), 400

        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp_file:
            temp_file.write(request.data)
            temp_file_path = temp_file.name

        try:
            first_name, second_name, full_name, national_id, address, birth_date, governorate, gender, detected_fields, debug_image_path = detect_and_process_id_card(
                temp_file_path)

            processing_time = time.time() - start_time

            # Extract just the filename from the debug image path
            debug_image_filename = os.path.basename(
                debug_image_path) if debug_image_path else "egyptian_id_debug.jpg"

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
                    "debug_image_path": debug_image_filename,
                    "cropped_image_path": "cropped_id_card.jpg",
                    "yolo_output_path": "d2.jpg",
                    "preprocessed_image_path": "preprocessed_image.jpg"
                },
                "total_fields": 8
            }

            logger.info(
                f"Egyptian ID processing completed in {processing_time:.2f}s")
            logger.info(
                f"Extracted: {full_name} - ID: {national_id} - {governorate}")

            return jsonify(result)

        finally:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)

    except Exception as e:
        logger.error(f"Egyptian ID processing error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/debug-image/<filename>', methods=['GET'])
def get_debug_image(filename):
    import os
    from flask import send_file

    allowed_files = ['egyptian_id_debug.jpg',
                     'cropped_id_card.jpg', 'd2.jpg', 'preprocessed_image.jpg', 'mrz_roi.jpg']

    if filename not in allowed_files:
        return jsonify({"error": "File not allowed"}), 403

    debug_folder = 'debug_images'
    file_path = os.path.join(debug_folder, filename)

    if not os.path.exists(file_path):
        logger.warning(f"Debug image not found: {file_path}")
        return jsonify({"error": f"Debug image not found: {filename}"}), 404

    try:
        return send_file(file_path, mimetype='image/jpeg')
    except Exception as e:
        logger.error(f"Error serving debug image {filename}: {e}")
        return jsonify({"error": f"Error serving debug image: {str(e)}"}), 500


@app.route('/', methods=['GET'])
def index():
    return jsonify({
        "message": "OCR Server is running",
        "endpoints": ["/health", "/ocr", "/egyptian-id", "/passport", "/debug-image/<filename>", "/info"],
        "status": "ready"
    })


if __name__ == '__main__':
    print("🔤 OCR Server")
    print("=" * 40)
    print("✅ Services: Egyptian ID OCR, Passport OCR")

    print("\n🌐 Server Endpoints:")
    print("  📊 Health: http://localhost:5000/health")
    print("  🔍 OCR: http://localhost:5000/ocr (redirects to Egyptian ID)")
    print("  🇪🇬 Egyptian ID: http://localhost:5000/egyptian-id")
    print("  🛂 Passport OCR: http://localhost:5000/passport")
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
