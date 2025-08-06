from flask import Flask, request, jsonify
from flask_cors import CORS
import easyocr
import cv2
import numpy as np
import logging

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize EasyOCR with Arabic and English
try:
    reader = easyocr.Reader(['en', 'ar'], gpu=False)  # Set gpu=True if available
    logger.info("✅ EasyOCR initialized with Arabic and English support")
except Exception as e:
    logger.error(f"Failed to initialize EasyOCR: {e}")
    reader = None

@app.route('/easyocr', methods=['POST'])
def easy_ocr():
    try:
        if reader is None:
            return jsonify({"error": "EasyOCR not available"}), 503
            
        if not request.data:
            return jsonify({"error": "No image data provided"}), 400
        
        # Decode image
        image_np = np.frombuffer(request.data, np.uint8)
        image_cv = cv2.imdecode(image_np, cv2.IMREAD_COLOR)
        
        if image_cv is None:
            return jsonify({"error": "Could not decode image"}), 400
        
        # EasyOCR processing
        results = reader.readtext(image_cv, detail=1, paragraph=False)
        
        # Process results
        processed_results = []
        for (bbox, text, confidence) in results:
            if confidence > 0.3:  # Filter low confidence
                processed_results.append({
                    "text": text.strip(),
                    "confidence": float(confidence),
                    "field_type": detect_field_type(text.strip()),
                    "bbox": bbox
                })
        
        return jsonify({
            "results": processed_results,
            "method": "EasyOCR Arabic+English"
        })
        
    except Exception as e:
        logger.error(f"EasyOCR error: {e}")
        return jsonify({"error": str(e)}), 500

def detect_field_type(text):
    """Detect field types for document analysis"""
    import re
    
    text_upper = text.upper()
    
    if re.search(r'\b\d{8,}\b', text):
        return "document_number"
    elif re.search(r'\b\d{2}[/-]\d{2}[/-]\d{4}\b', text):
        return "date"
    elif re.search(r'\b[A-Z][a-z]+\s+[A-Z][a-z]+\b', text) and len(text) > 5:
        return "name"
    elif any(keyword in text_upper for keyword in ['PASSPORT', 'ID', 'CARD']):
        return "document_type"
    elif re.search(r'JU\d+', text):
        return "id_number"
    else:
        return "general"

@app.route('/health', methods=['GET'])
def health_check():
    status = "healthy" if reader is not None else "unhealthy"
    return jsonify({"status": status, "easyocr_available": reader is not None})

if __name__ == '__main__':
    print("📖 Starting EasyOCR Server for Arabic/English Documents")
    app.run(host='0.0.0.0', port=5002, debug=False)