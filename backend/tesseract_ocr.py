from flask import Flask, request, jsonify
from flask_cors import CORS
import pytesseract
from PIL import Image
import cv2
import numpy as np
import io
import logging

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def preprocess_for_tesseract(image):
    """Advanced preprocessing for Arabic/English documents"""
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Enhance contrast
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
    enhanced = clahe.apply(gray)
    
    # Denoise
    denoised = cv2.bilateralFilter(enhanced, 9, 75, 75)
    
    # Threshold
    _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    return thresh

@app.route('/tesseract-ocr', methods=['POST'])
def tesseract_ocr():
    try:
        if not request.data:
            return jsonify({"error": "No image data provided"}), 400
        
        # Decode image
        image_np = np.frombuffer(request.data, np.uint8)
        image_cv = cv2.imdecode(image_np, cv2.IMREAD_COLOR)
        
        if image_cv is None:
            return jsonify({"error": "Could not decode image"}), 400
        
        # Preprocess image
        processed = preprocess_for_tesseract(image_cv)
        
        # Convert to PIL Image
        pil_image = Image.fromarray(processed)
        
        # OCR with Arabic + English
        # Configure Tesseract for better accuracy
        custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
        
        # Extract text with Arabic and English
        text_ara_eng = pytesseract.image_to_string(pil_image, lang='ara+eng', config=custom_config)
        
        # Also try English only for comparison
        text_eng = pytesseract.image_to_string(pil_image, lang='eng', config=custom_config)
        
        # Get detailed data with confidence scores
        detailed_data = pytesseract.image_to_data(pil_image, lang='ara+eng', output_type=pytesseract.Output.DICT)
        
        # Process results
        results = []
        for i in range(len(detailed_data['text'])):
            text = detailed_data['text'][i].strip()
            conf = int(detailed_data['conf'][i])
            
            if text and conf > 30:  # Filter low confidence
                results.append({
                    "text": text,
                    "confidence": conf / 100.0,
                    "field_type": detect_field_type(text)
                })
        
        return jsonify({
            "results": results,
            "full_text_ara_eng": text_ara_eng.strip(),
            "full_text_eng": text_eng.strip(),
            "method": "Tesseract Arabic+English"
        })
        
    except Exception as e:
        logger.error(f"Tesseract OCR error: {e}")
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
    try:
        # Test Tesseract installation
        version = pytesseract.get_tesseract_version()
        return jsonify({
            "status": "healthy", 
            "tesseract_version": str(version),
            "languages": pytesseract.get_languages()
        })
    except:
        return jsonify({"status": "unhealthy", "error": "Tesseract not available"}), 503

if __name__ == '__main__':
    print("🔤 Starting Tesseract OCR Server for Arabic/English Documents")
    app.run(host='0.0.0.0', port=5001, debug=False)