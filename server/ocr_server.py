#!/usr/bin/env python3

from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
from utils import detect_and_process_id_card, detect_id_card_quick, extract_face_from_id_yolo

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import passport_ocr with fallback
try:
    from passport_ocr import process_passport, get_passport_debug_info
    PASSPORT_OCR_AVAILABLE = True
    logger.info("✅ passport_ocr module loaded successfully")
except ImportError:
    PASSPORT_OCR_AVAILABLE = False
    logger.warning("⚠️ passport_ocr module not available, passport OCR will be disabled")
    # Create stub functions
    def process_passport(path):
        return {"success": False, "error": "Passport OCR module not available"}
    def get_passport_debug_info(path):
        return None
import time
import tempfile
import os
import base64
import io
from PIL import Image
import cv2
import numpy as np

# face_recognition library for face verification (comparing ID photo with live selfie)
# Note: Face EXTRACTION from ID cards is now done using YOLO (extract_face_from_id_yolo in utils.py)
#       This is more accurate as it's specifically trained on Egyptian ID cards
try:
    import face_recognition
    FACE_VERIFICATION_AVAILABLE = True
    logger = logging.getLogger(__name__)
    logger.info("✅ face_recognition loaded successfully for verification!")
except ImportError:
    FACE_VERIFICATION_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("⚠️ face_recognition not available, face verification will be disabled")

# Legacy MTCNN-based face extraction (kept for backwards compatibility, but YOLO is preferred)
try:
    from facenet_pytorch import MTCNN
    import torch
    from torch.nn.functional import cosine_similarity
    
    mtcnn = MTCNN(image_size=160, margin=0, keep_all=False, device='cpu')
    logger.info("✅ MTCNN loaded (legacy fallback)")
    FACE_EXTRACTION_AVAILABLE = True
except Exception as e:
    logger.info(f"ℹ️ MTCNN not available (using YOLO for face extraction): {e}")
    FACE_EXTRACTION_AVAILABLE = False

import uuid

# A simple in-memory cache for session data.
# In a production environment, this should be replaced with a more robust solution like Redis.
SESSION_CACHE = {}


def preprocess_for_face_verification(pil_image, is_id_card=False):
    """Applies preprocessing to enhance images for face verification."""
    logger.info(f"Preprocessing image, is_id_card={is_id_card}")
    
    image_np = np.array(pil_image.convert('RGB'))
    image_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)

    # 1. Convert to LAB color space for luminance-independent contrast enhancement
    lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    
    # 2. Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cl = clahe.apply(l)
    limg = cv2.merge((cl, a, b))
    
    # 3. Convert back to BGR
    enhanced_bgr = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
    
    final_image_bgr = enhanced_bgr
    
    if is_id_card:
        # 4. For ID cards, apply a sharpening filter to accentuate features
        kernel = np.array([[0, -1, 0],
                           [-1, 5,-1],
                           [0, -1, 0]])
        sharpened_bgr = cv2.filter2D(enhanced_bgr, -1, kernel)
        final_image_bgr = sharpened_bgr

    # Convert back to RGB for facenet and return as a PIL Image
    final_image_rgb = cv2.cvtColor(final_image_bgr, cv2.COLOR_BGR2RGB)
    
    return Image.fromarray(final_image_rgb)


def extract_face_from_id(image_path):
    """Extracts a padded face from an ID card image to provide a better visual crop."""
    if not FACE_EXTRACTION_AVAILABLE:
        return None, "MTCNN model not available for face extraction."
    
    try:
        image = Image.open(image_path).convert('RGB')
        image_np = np.array(image)

        # Detect face using MTCNN
        boxes, _ = mtcnn.detect(image)

        if boxes is None or len(boxes) == 0:
            return None, "No face detected in the ID image for cropping."

        # Get the bounding box of the first detected face
        box = boxes[0]
        x1, y1, x2, y2 = [int(c) for c in box]

        # Add 30% padding to each side to include hair, ears, etc.
        width = x2 - x1
        height = y2 - y1
        padding_x = int(width * 0.30)
        padding_y = int(height * 0.30)

        x1_padded = max(0, x1 - padding_x)
        y1_padded = max(0, y1 - padding_y)
        x2_padded = min(image_np.shape[1], x2 + padding_x)
        y2_padded = min(image_np.shape[0], y2 + padding_y)
        
        face_crop_np = image_np[y1_padded:y2_padded, x1_padded:x2_padded]

        # Convert the cropped face back to a Base64 string for the frontend
        _, buffer = cv2.imencode('.jpg', cv2.cvtColor(face_crop_np, cv2.COLOR_RGB2BGR))
        face_base64 = base64.b64encode(buffer).decode('utf-8')

        logger.info("Successfully extracted padded face from ID.")
        return face_base64, None

    except Exception as e:
        logger.error(f"Error extracting face from ID: {e}")
        return None, f"Error during face extraction: {str(e)}"


app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "X-Session-ID", "X-Submission-ID"]
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
        from utils import detect_and_process_id_card
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
    health_status["services"]["passport"] = PASSPORT_OCR_AVAILABLE
    if not PASSPORT_OCR_AVAILABLE:
        health_status["errors"].append("Passport OCR module not available")
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
    if not PASSPORT_OCR_AVAILABLE:
        return jsonify({"error": "Passport OCR module not available"}), 503
    
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


@app.route('/detect-id-card', methods=['POST'])
def detect_id_card():
    """
    Quick ID card detection endpoint for real-time camera feedback.
    Returns detection status, bounding box, and quality metrics without full OCR.
    """
    try:
        if not request.data:
            return jsonify({"error": "No image data provided"}), 400

        session_id = request.headers.get('X-Session-ID')
        if not session_id:
            session_id = str(uuid.uuid4())

        session_data = SESSION_CACHE.get(session_id, {})
        
        logger.info(f"ID detection request: {len(request.data)} bytes, Session: {session_id}")

        if len(request.data) < 100:
            return jsonify({"error": "Data too small to be a valid image"}), 400

        # Save image temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp_file:
            temp_file.write(request.data)
            temp_file_path = temp_file.name

        try:
            # Run quick detection
            result = detect_id_card_quick(temp_file_path, session_data)

            # Update session cache
            if 'fields' in result:
                SESSION_CACHE[session_id] = result

            logger.info(
                f"Detection: {result['detected']}, "
                f"Confidence: {result.get('confidence', 0):.2f}, "
                f"Quality: {result.get('quality', {}).get('quality_level', 'unknown')}"
            )

            # Add session ID to response for the client
            result['session_id'] = session_id
            return jsonify(result)

        finally:
            # Clean up temp file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)

    except Exception as e:
        logger.error(f"Detection error: {e}")
        return jsonify({"error": str(e), "detected": False}), 500


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
            first_name, second_name, full_name, national_id, address, birth_date, governorate, gender, detected_fields, debug_image_path, serial = detect_and_process_id_card(
                temp_file_path)

            processing_time = time.time() - start_time

            # Extract face from the ID card using YOLO detection (more accurate for Egyptian IDs)
            face_image_base64, face_error = extract_face_from_id_yolo(temp_file_path)

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
                    "gender": gender,
                    "serial": serial,
                    "face_image": face_image_base64
                },
                "face_verification": {
                    "face_detected": face_image_base64 is not None,
                    "face_image": face_image_base64,
                    "face_error": face_error
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


@app.route('/verify-face', methods=['POST'])
def verify_face():
    """
    Verifies face similarity between an ID image and a live selfie.
    This implementation uses the 'face_recognition' library.
    """
    try:
        if not FACE_VERIFICATION_AVAILABLE:
            return jsonify({"error": "Face verification not available (install face_recognition)"}), 503

        data = request.get_json()
        if not data or 'id_image' not in data or 'live_image' not in data:
            return jsonify({"error": "Both id_image and live_image are required"}), 400

        # Add timestamp for debugging
        import time
        request_timestamp = time.time()
        logger.info(f"Face verification request at {request_timestamp}")

        # Decode base64 images
        try:
            id_image_data = base64.b64decode(data['id_image'])
            live_image_data = base64.b64decode(data['live_image'])
            
            id_np_arr = np.frombuffer(id_image_data, np.uint8)
            live_np_arr = np.frombuffer(live_image_data, np.uint8)

            id_image = cv2.imdecode(id_np_arr, cv2.IMREAD_COLOR)
            live_image = cv2.imdecode(live_np_arr, cv2.IMREAD_COLOR)

            if id_image is None or live_image is None:
                raise ValueError("Could not decode one or both images.")
        except Exception as e:
            logger.error(f"Image decoding error: {e}")
            return jsonify({"error": f"Invalid image data: {str(e)}"}), 400

        # Find face locations and encodings
        id_face_locations = face_recognition.face_locations(id_image)
        live_face_locations = face_recognition.face_locations(live_image)

        if not id_face_locations:
            return jsonify({"error": "No face found in the ID image."}), 400
        if not live_face_locations:
            return jsonify({"error": "No face found in the live selfie."}), 400

        id_face_encoding = face_recognition.face_encodings(id_image, known_face_locations=id_face_locations)[0]
        live_face_encoding = face_recognition.face_encodings(live_image, known_face_locations=live_face_locations)[0]

        # Compare faces and get the distance (lower is better)
        face_distances = face_recognition.face_distance([id_face_encoding], live_face_encoding)
        face_distance = face_distances[0]

        # Convert distance to a similarity score using a non-linear function
        # A typical threshold for face_distance is 0.6.
        # We use a logistic function to map the distance to a 0-100 score
        # where a distance of ~0.6 maps to the threshold.
        # k affects the steepness of the curve. A higher k means a sharper drop-off.
        k = 10 
        midpoint = 0.6
        similarity = 100 / (1 + np.exp(k * (face_distance - midpoint)))
        
        threshold = 60  # Required similarity score
        is_match = similarity >= threshold

        logger.info(f"Face verification complete. Distance: {face_distance:.2f}, Similarity: {similarity:.2f}%, Match: {is_match}")

        return jsonify({
            "success": True,
            "verification_result": {
                "is_match": bool(is_match),
                "similarity_score": float(round(similarity, 2)),
                "distance": float(round(face_distance, 2)),
                "threshold": int(threshold)
            }
        })

    except Exception as e:
        logger.error(f"An unexpected error occurred during face verification: {e}")
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
    print("  📸 ID Detection: http://localhost:5000/detect-id-card (real-time)")
    print("  🇪🇬 Egyptian ID: http://localhost:5000/egyptian-id")
    print("  🛂 Passport OCR: http://localhost:5000/passport")
    print("  🖼️ Debug Images: http://localhost:5000/debug-image/<filename>")
    print("  ℹ️ Info: http://localhost:5000/info")
    print("  📸 Face Extraction: Using YOLO (detect_odjects.pt)")
    if FACE_VERIFICATION_AVAILABLE:
        print("  👤 Face Verification: http://localhost:5000/verify-face")
    else:
        print("  👤 Face Verification: Not available (install face_recognition)")

    print("\n🚀 Starting server on http://localhost:5000")
    print("=" * 40)

    app.run(
        host='0.0.0.0',
        port=5000,
        debug=False,
        threaded=True,
        ssl_context=(
            '/etc/ssl/ocr-server/fullchain.pem',
            '/etc/ssl/ocr-server/privkey.pem'
        )
    )
