from flask import Flask, request, jsonify
from flask_cors import CORS
import easyocr
import requests
import numpy as np
import cv2

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize EasyOCR reader
# This is done once when the server starts
try:
    reader = easyocr.Reader(['en', 'ar'])  # Add other languages if needed
except Exception as e:
    print(f"❌ Error initializing EasyOCR: {e}")
    reader = None

@app.route('/ocr', methods=['POST'])
def ocr_from_body():
    if reader is None:
        return jsonify({"error": "EasyOCR is not initialized"}), 500

    if not request.data:
        return jsonify({"error": "Request body is empty"}), 400

    # Convert image content from request body to a format that OpenCV can read
    try:
        image_np = np.frombuffer(request.data, np.uint8)
        image_cv = cv2.imdecode(image_np, cv2.IMREAD_COLOR)
    except Exception as e:
        return jsonify({"error": f"Failed to decode image data: {e}"}), 400

    if image_cv is None:
        return jsonify({"error": "Could not decode image from request body"}), 400
    
    # --- Preprocessing Steps to improve OCR accuracy ---
    # 1. Convert the image to grayscale
    gray_image = cv2.cvtColor(image_cv, cv2.COLOR_BGR2GRAY)

    # 2. Apply a binary threshold to get a black and white image
    _, binary_image = cv2.threshold(gray_image, 127, 255, cv2.THRESH_BINARY)
    
    # Run OCR on the preprocessed image
    try:
        results = reader.readtext(binary_image)
    except Exception as e:
        return jsonify({"error": f"OCR processing failed: {e}"}), 500


    # Format results for the response
    ocr_output = [{"text": text, "confidence": float(prob)} for (_, text, prob) in results]

    print("\n📄 OCR Results:")
    for item in ocr_output:
        print(f"- {item['text']}  (confidence: {item['confidence']:.2f})")

    return jsonify(ocr_output)

if __name__ == '__main__':
    print("🚀 Starting Flask OCR server...")
    print("👉 Ready to accept POST requests at http://127.0.0.1:5000/ocr")
    app.run(host='0.0.0.0', port=5000)