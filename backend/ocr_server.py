#!/usr/bin/env python3

from flask import Flask, request, jsonify
from flask_cors import CORS
from egyptian_ocr_id import detect_and_process_id_card, detect_id_card_quick
from passport_ocr import process_passport, get_passport_debug_info
import logging
import time
import tempfile
import os
import base64
import io
from PIL import Image
import cv2
import numpy as np

# Face recognition imports
try:
    from facenet_pytorch import MTCNN, InceptionResnetV1
    import torch
    from torch.nn.functional import cosine_similarity
    FACE_RECOGNITION_AVAILABLE = True

    # Initialize face recognition models
    print("🔍 Initializing face recognition models...")
    mtcnn = MTCNN(image_size=160, margin=0)
    face_model = InceptionResnetV1(pretrained='vggface2').eval()
    print("✅ Face recognition models loaded successfully!")

    def get_face_embedding(img):
        """Extract face embedding from image"""
        face = mtcnn(img)
        if face is None:
            return None
        with torch.no_grad():
            return face_model(face.unsqueeze(0))

    def compare_faces(id_image, live_image):
        """Compare two face images and return similarity score"""
        id_embedding = get_face_embedding(id_image)
        live_embedding = get_face_embedding(live_image)

        if id_embedding is None or live_embedding is None:
            return None, "Face not detected in one of the images"

        similarity = cosine_similarity(id_embedding, live_embedding)
        similarity_score = similarity.item()

        threshold = 0.7
        is_match = similarity_score > threshold

        return {
            "similarity_score": similarity_score,
            "is_match": is_match,
            "threshold": threshold,
            "confidence": "high" if similarity_score > 0.8 else "medium" if similarity_score > 0.6 else "low"
        }, None

except ImportError as e:
    print(f"⚠️ Face recognition not available: {e}")
    print("💡 To enable face recognition, run: pip install torch torchvision facenet-pytorch")
    FACE_RECOGNITION_AVAILABLE = False
except Exception as e:
    print(f"⚠️ Face recognition initialization failed: {e}")
    FACE_RECOGNITION_AVAILABLE = False


def extract_face_from_id(image_path):
    """Extract face from ID card image using YOLO face detection"""
    try:
        # Load the image
        image = cv2.imread(image_path)
        if image is None:
            return None, "Could not load image"

        # Load YOLO face detection model (you might need to train this or use a pre-trained one)
        # For now, we'll use MTCNN to detect face
        if FACE_RECOGNITION_AVAILABLE:
            # Convert BGR to RGB for MTCNN
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(rgb_image)

            # Detect face and get bounding box
            face_tensor = mtcnn.detect(pil_image)
            if face_tensor[0] is not None and len(face_tensor[0]) > 0:
                # Get the first detected face
                bbox = face_tensor[0][0]  # [x1, y1, x2, y2]
                x1, y1, x2, y2 = bbox.astype(int)

                # Crop face from image
                face_crop = image[y1:y2, x1:x2]

                # Convert to base64 for transmission
                _, buffer = cv2.imencode('.jpg', face_crop)
                face_base64 = base64.b64encode(buffer).decode('utf-8')

                return face_base64, None
            else:
                return None, "No face detected in ID image"
        else:
            return None, "Face recognition not available"

    except Exception as e:
        return None, f"Error extracting face: {str(e)}"


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


@app.route('/detect-id-card', methods=['POST'])
def detect_id_card():
    """
    Quick ID card detection endpoint for real-time camera feedback.
    Returns detection status, bounding box, and quality metrics without full OCR.
    """
    try:
        if not request.data:
            return jsonify({"error": "No image data provided"}), 400

        logger.info(f"ID detection request: {len(request.data)} bytes")

        if len(request.data) < 100:
            return jsonify({"error": "Data too small to be a valid image"}), 400

        # Save image temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp_file:
            temp_file.write(request.data)
            temp_file_path = temp_file.name

        try:
            # Run quick detection
            result = detect_id_card_quick(temp_file_path)

            logger.info(
                f"Detection: {result['detected']}, "
                f"Confidence: {result.get('confidence', 0):.2f}, "
                f"Quality: {result.get('quality', {}).get('quality_level', 'unknown')}"
            )

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

            # Extract face from ID card for verification
            face_image_base64, face_error = extract_face_from_id(
                temp_file_path)

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
    """Verify face similarity between ID image and live selfie"""
    try:
        if not FACE_RECOGNITION_AVAILABLE:
            return jsonify({"error": "Face recognition not available"}), 503

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

            id_image = Image.open(io.BytesIO(id_image_data)).convert('RGB')
            live_image = Image.open(io.BytesIO(live_image_data)).convert('RGB')

            logger.info(
                f"Images decoded successfully - ID: {id_image.size}, Live: {live_image.size}")

        except Exception as e:
            logger.error(f"Image decoding error: {e}")
            return jsonify({"error": f"Invalid image data: {str(e)}"}), 400

        # Compare faces
        result, error = compare_faces(id_image, live_image)

        if error:
            logger.error(f"Face comparison error: {error}")
            return jsonify({"error": error}), 400

        logger.info(
            f"Face verification completed - Similarity: {result['similarity_score']:.3f}, Match: {result['is_match']}")

        return jsonify({
            "success": True,
            "verification_result": result,
            "request_timestamp": request_timestamp
        })

    except Exception as e:
        logger.error(f"Face verification error: {e}")
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
    if FACE_RECOGNITION_AVAILABLE:
        print("  👤 Face Verification: http://localhost:5000/verify-face")
    else:
        print(
            "  👤 Face Verification: Not available (install face recognition dependencies)")

    print("\n🚀 Starting server on http://localhost:5000")
    print("=" * 40)

    app.run(
        host='0.0.0.0',
        port=5000,
        debug=False,
        threaded=True
    )
