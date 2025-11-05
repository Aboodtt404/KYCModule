from ultralytics import YOLO
import cv2
import re
import numpy as np
import easyocr
import base64

# Initialize EasyOCR ONCE with optimizations
reader = easyocr.Reader(
    ['ar'],  # Arabic language
    gpu=False,  # CPU mode (your setup)
    model_storage_directory='./easyocr_models',  # Cache models locally
    user_network_directory='./easyocr_models',
    verbose=False  # Suppress logs
)

# Load models once for efficiency
id_card_model = YOLO('detect_id_card.pt')
objects_model = YOLO('detect_odjects.pt')
id_digits_model = YOLO('detect_id.pt')

# Function to preprocess the cropped image
def preprocess_image(cropped_image):
    gray_image = cv2.cvtColor(cropped_image, cv2.COLOR_BGR2GRAY)   
    return  gray_image

# Helper function to diagnose field extraction
def diagnose_field_extraction(image, bbox_dict):
    """
    Diagnose what's happening with field extraction
    """
    print("\n" + "="*60)
    print("🔍 FIELD EXTRACTION DIAGNOSIS")
    print("="*60)
    
    for field_name, bbox in bbox_dict.items():
        if bbox is None:
            print(f"\n❌ {field_name}: NO BOUNDING BOX DETECTED")
            continue
        
        x1, y1, x2, y2 = bbox
        width = x2 - x1
        height = y2 - y1
        area = width * height
        
        print(f"\n📦 {field_name}:")
        print(f"   Position: x1={x1}, y1={y1}, x2={x2}, y2={y2}")
        print(f"   Size: {width}x{height} pixels (area: {area})")
        
        # Warnings for suspicious sizes
        if width < 80:
            print(f"   ⚠️  WIDTH TOO SMALL ({width}px) - may cause OCR failure")
        if height < 30:
            print(f"   ⚠️  HEIGHT TOO SMALL ({height}px) - may cause OCR failure")
        if area < 2400:
            print(f"   ⚠️  AREA TOO SMALL ({area}px²) - needs aggressive upscaling")

# Field-specific extraction with aggressive handling for firstName
def extract_text(image, bbox, lang='ar', field_type='general'):
    """
    Extract Arabic text with EasyOCR optimized for Egyptian IDs
    Field-specific handling for firstName (smaller fields need more aggressive processing)
    """
    x1, y1, x2, y2 = bbox
    cropped_image = image[y1:y2, x1:x2]
    
    height, width = cropped_image.shape[:2]
    print(f"      📐 Original crop size: {width}x{height}")
    
    # FIELD-SPECIFIC UPSCALING
    if field_type == 'firstName':
        # firstName is ALWAYS small - be VERY aggressive
        min_width = 250
        min_height = 60
        min_scale = 3.0  # At least 3x
        confidence_threshold = 0.10  # Lower threshold
        print(f"      🎯 Processing firstName with aggressive settings")
    else:
        # Other fields (lastName, address, serial)
        min_width = 150
        min_height = 40
        min_scale = 2.0
        confidence_threshold = 0.15
    
    # Upscale if needed
    if width < min_width or height < min_height:
        scale_factor = max(min_width/width, min_height/height, min_scale)
        new_width = int(width * scale_factor)
        new_height = int(height * scale_factor)
        cropped_image = cv2.resize(cropped_image, (new_width, new_height), 
                                   interpolation=cv2.INTER_CUBIC)
        print(f"      📏 Upscaled from {width}x{height} to {new_width}x{new_height} (scale: {scale_factor:.1f}x)")
    
    # AGGRESSIVE PREPROCESSING for firstName
    if field_type == 'firstName':
        # Save original for debugging
        import os
        debug_dir = 'debug_ocr'
        os.makedirs(debug_dir, exist_ok=True)
        
        # 1. Gentle CLAHE first
        lab = cv2.cvtColor(cropped_image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        enhanced = cv2.merge([l, a, b])
        cropped_image = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
        cv2.imwrite(f'{debug_dir}/1_clahe.png', cropped_image)
        
        # 2. Light denoising (don't destroy text)
        cropped_image = cv2.fastNlMeansDenoising(cropped_image, h=7, 
                                                 templateWindowSize=7, 
                                                 searchWindowSize=21)
        cv2.imwrite(f'{debug_dir}/2_denoised.png', cropped_image)
        
        # 3. Try WITHOUT binarization first (it might be destroying text)
        # Convert to grayscale but keep it as color for EasyOCR
        gray = cv2.cvtColor(cropped_image, cv2.COLOR_BGR2GRAY)
        
        # Apply adaptive threshold (better than OTSU for varying lighting)
        adaptive = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                        cv2.THRESH_BINARY, 11, 2)
        cv2.imwrite(f'{debug_dir}/3_adaptive.png', adaptive)
        
        # Convert back to BGR
        cropped_image = cv2.cvtColor(adaptive, cv2.COLOR_GRAY2BGR)
        cv2.imwrite(f'{debug_dir}/4_final.png', cropped_image)
        
        print(f"      💾 Debug images saved to {debug_dir}/")
    else:
        # Standard preprocessing for other fields
        lab = cv2.cvtColor(cropped_image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        enhanced = cv2.merge([l, a, b])
        cropped_image = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
        
        cropped_image = cv2.fastNlMeansDenoising(cropped_image, h=8, 
                                                 templateWindowSize=7, 
                                                 searchWindowSize=21)
        
        gray = cv2.cvtColor(cropped_image, cv2.COLOR_BGR2GRAY)
        clahe_gray = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        gray = clahe_gray.apply(gray)
        cropped_image = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    
    try:
        result = reader.readtext(
            cropped_image,
            detail=1,
            paragraph=False,
            batch_size=1
        )
        
        if result:
            texts = []
            total_confidence = 0
            
            for detection in result:
                text = detection[1]
                confidence = detection[2]
                
                # Use field-specific confidence threshold
                if confidence > confidence_threshold and text.strip():
                    texts.append(text.strip())
                    total_confidence += confidence
                    print(f"      📝 Detected: '{text.strip()}' (confidence: {confidence:.2f})")
                else:
                    if text.strip():
                        print(f"      ⚠️ Low confidence filtered: '{text.strip()}' ({confidence:.2f})")
            
            if texts:
                combined_text = ' '.join(texts)
                avg_confidence = total_confidence / len(texts) if texts else 0
                print(f"      ✅ {field_type} extracted: {combined_text} (avg confidence: {avg_confidence:.2f})")
                return combined_text
            else:
                print(f"      ⚠️ No text passed confidence threshold ({confidence_threshold})")
                
                # FALLBACK for firstName: Try with original (less processed) image
                if field_type == 'firstName' and x1 >= 0 and y1 >= 0 and x2 > x1 and y2 > y1:
                    print(f"      🔄 FALLBACK: Trying with minimal preprocessing...")
                    fallback_crop = image[y1:y2, x1:x2]
                    
                    # Just upscale, no other processing
                    h, w = fallback_crop.shape[:2]
                    if w < 250 or h < 60:
                        scale = max(250/w, 60/h, 3.0)
                        new_w, new_h = int(w * scale), int(h * scale)
                        fallback_crop = cv2.resize(fallback_crop, (new_w, new_h), 
                                                   interpolation=cv2.INTER_CUBIC)
                    
                    # Save fallback attempt
                    import os
                    cv2.imwrite('debug_ocr/5_fallback_raw.png', fallback_crop)
                    
                    fallback_result = reader.readtext(fallback_crop, detail=1, paragraph=False, batch_size=1)
                    if fallback_result:
                        fallback_texts = []
                        for det in fallback_result:
                            txt, conf = det[1], det[2]
                            if conf > 0.05 and txt.strip():  # Very lenient
                                fallback_texts.append(txt.strip())
                                print(f"      📝 FALLBACK detected: '{txt.strip()}' (confidence: {conf:.2f})")
                        
                        if fallback_texts:
                            result_text = ' '.join(fallback_texts)
                            print(f"      ✅ FALLBACK succeeded: {result_text}")
                            return result_text
                
                return ""
        else:
            print(f"      ⚠️ EasyOCR returned no results")
            
            # FALLBACK for firstName: Try with original image
            if field_type == 'firstName' and x1 >= 0 and y1 >= 0 and x2 > x1 and y2 > y1:
                print(f"      🔄 FALLBACK: Trying with original image (no preprocessing)...")
                fallback_crop = image[y1:y2, x1:x2]
                
                # Just upscale
                h, w = fallback_crop.shape[:2]
                if w < 250 or h < 60:
                    scale = max(250/w, 60/h, 3.0)
                    new_w, new_h = int(w * scale), int(h * scale)
                    fallback_crop = cv2.resize(fallback_crop, (new_w, new_h), 
                                               interpolation=cv2.INTER_CUBIC)
                
                import os
                cv2.imwrite('debug_ocr/5_fallback_raw.png', fallback_crop)
                
                fallback_result = reader.readtext(fallback_crop, detail=1, paragraph=False, batch_size=1)
                if fallback_result:
                    fallback_texts = []
                    for det in fallback_result:
                        txt, conf = det[1], det[2]
                        if conf > 0.05 and txt.strip():  # Very lenient
                            fallback_texts.append(txt.strip())
                            print(f"      📝 FALLBACK detected: '{txt.strip()}' (confidence: {conf:.2f})")
                    
                    if fallback_texts:
                        result_text = ' '.join(fallback_texts)
                        print(f"      ✅ FALLBACK succeeded: {result_text}")
                        return result_text
            
            return ""
            
    except Exception as e:
        print(f"      ❌ EasyOCR error: {e}")
        import traceback
        traceback.print_exc()
        return ""

# Function to detect national ID numbers in a cropped image
def detect_national_id(cropped_image):
    model = YOLO('detect_id.pt')  # Load the model directly in the function
    results = model(cropped_image)
    detected_info = []

    for result in results:
        for box in result.boxes:
            cls = int(box.cls)
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            detected_info.append((cls, x1))
            cv2.rectangle(cropped_image, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(cropped_image, str(cls), (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (36, 255, 12), 2)

    detected_info.sort(key=lambda x: x[1])
    id_number = ''.join([str(cls) for cls, _ in detected_info])
    
    return id_number

# Function to remove numbers from a string
def remove_numbers(text):
    return re.sub(r'\d+', '', text)

# Function to expand bounding box height only
def expand_bbox_height(bbox, scale=1.2, image_shape=None):
    x1, y1, x2, y2 = bbox
    width = x2 - x1
    height = y2 - y1
    center_x = x1 + width // 2
    center_y = y1 + height // 2
    new_height = int(height * scale)
    new_y1 = max(center_y - new_height // 2, 0)
    new_y2 = min(center_y + new_height // 2, image_shape[0])
    return [x1, new_y1, x2, new_y2]

# Function to process the cropped image
def process_image(cropped_image):
    # Load the trained YOLO model for objects (fields) detection
    model = YOLO('detect_odjects.pt')
    results = model(cropped_image)

    # Variables to store extracted values
    first_name = ''
    second_name = ''
    merged_name = ''
    nid = ''
    address = ''
    serial = ''
    
    # Collect all bounding boxes for diagnostics
    bbox_dict = {}
    detected_fields = []  # Track which fields were detected

    # Loop through the results
    for result in results:
        output_path = 'd2.jpg'
        result.save(output_path)

        for box in result.boxes:
            bbox = box.xyxy[0].tolist()
            class_id = int(box.cls[0].item())
            class_name = result.names[class_id]
            bbox = [int(coord) for coord in bbox]
            confidence = float(box.conf[0].item())
            
            # Store bbox for diagnostics
            bbox_dict[class_name] = bbox
            detected_fields.append(class_name)  # Track detected field
            
            print(f"\n🔍 Detected: {class_name} (confidence: {confidence:.2f})")

            if class_name == 'firstName':
                print("   📌 Processing firstName with AGGRESSIVE settings...")
                first_name = extract_text(cropped_image, bbox, lang='ar', field_type='firstName')
            elif class_name == 'lastName':
                print("   📌 Processing lastName...")
                second_name = extract_text(cropped_image, bbox, lang='ar', field_type='lastName')
            elif class_name == 'serial':
                print("   📌 Processing serial...")
                serial = extract_text(cropped_image, bbox, lang='ar', field_type='serial')
            elif class_name == 'address':
                print("   📌 Processing address...")
                address = extract_text(cropped_image, bbox, lang='ar', field_type='address')
            elif class_name == 'nid':
                print("   📌 Processing national ID...")
                expanded_bbox = expand_bbox_height(bbox, scale=1.5, image_shape=cropped_image.shape)
                cropped_nid = cropped_image[expanded_bbox[1]:expanded_bbox[3], expanded_bbox[0]:expanded_bbox[2]]
                nid = detect_national_id(cropped_nid)
    
    # Run diagnostics
    diagnose_field_extraction(cropped_image, bbox_dict)

    merged_name = f"{first_name} {second_name}"
    print(f"\n{'='*60}")
    print(f"📋 FINAL RESULTS:")
    print(f"{'='*60}")
    print(f"First Name: {first_name}")
    print(f"Second Name: {second_name}")
    print(f"Full Name: {merged_name}")
    print(f"National ID: {nid}")
    print(f"Address: {address}")
    print(f"Serial: {serial}")
    print(f"{'='*60}\n")

    decoded_info = decode_egyptian_id(nid)
    debug_image_path = 'd2.jpg'  # Path to the debug image with bounding boxes
    
    # Return all expected values for ocr_server.py
    return (first_name, second_name, merged_name, nid, address, 
            decoded_info["Birth Date"], decoded_info["Governorate"], decoded_info["Gender"],
            detected_fields, debug_image_path, serial)

# Function to decode the Egyptian ID number
def decode_egyptian_id(id_number):
    governorates = {
        '01': 'Cairo',
        '02': 'Alexandria',
        '03': 'Port Said',
        '04': 'Suez',
        '11': 'Damietta',
        '12': 'Dakahlia',
        '13': 'Ash Sharqia',
        '14': 'Kaliobeya',
        '15': 'Kafr El - Sheikh',
        '16': 'Gharbia',
        '17': 'Monoufia',
        '18': 'El Beheira',
        '19': 'Ismailia',
        '21': 'Giza',
        '22': 'Beni Suef',
        '23': 'Fayoum',
        '24': 'El Menia',
        '25': 'Assiut',
        '26': 'Sohag',
        '27': 'Qena',
        '28': 'Aswan',
        '29': 'Luxor',
        '31': 'Red Sea',
        '32': 'New Valley',
        '33': 'Matrouh',
        '34': 'North Sinai',
        '35': 'South Sinai',
        '88': 'Foreign'
    }

    century_digit = int(id_number[0])
    year = int(id_number[1:3])
    month = int(id_number[3:5])
    day = int(id_number[5:7])
    governorate_code = id_number[7:9]
    gender_code = int(id_number[12:13])

    if century_digit == 2:
        century = "1900-1999"
        full_year = 1900 + year
    elif century_digit == 3:
        century = "2000-2099"
        full_year = 2000 + year
    else:
        raise ValueError("Invalid century digit")

    gender = "Male" if gender_code % 2 != 0 else "Female"
    governorate = governorates.get(governorate_code, "Unknown")
    birth_date = f"{full_year:04d}-{month:02d}-{day:02d}"

    return {
        'Birth Date': birth_date,
        'Governorate': governorate,
        'Gender': gender
    }

# Function to detect the ID card and pass it to the existing code
def detect_and_process_id_card(image_path):
    # Perform inference to detect the ID card
    id_card_results = id_card_model(image_path)

    # Load the original image using OpenCV
    image = cv2.imread(image_path)

    # Crop the ID card from the image
    for result in id_card_results:
        for box in result.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])  # Get bounding box coordinates
            cropped_image = image[y1:y2, x1:x2]

    # Pass the cropped image to the existing processing function
    return process_image(cropped_image)

# Function to extract face photo from ID card using YOLO
def extract_face_from_id_yolo(image_path):
    """
    Extract the face/photo from an Egyptian ID card using YOLO detection.
    Returns base64-encoded image and error (if any).
    """
    try:
        # Load the ID card image
        image = cv2.imread(image_path)
        if image is None:
            return None, "Could not read image"
        
        # First, detect the ID card
        id_card_results = id_card_model(image, verbose=False)
        
        cropped_id = None
        for result in id_card_results:
            if len(result.boxes) > 0:
                box = result.boxes[0]
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                cropped_id = image[y1:y2, x1:x2]
                break
        
        if cropped_id is None:
            return None, "No ID card detected"
        
        # Now detect the photo field on the cropped ID
        fields_result = objects_model(cropped_id, verbose=False)
        
        for result in fields_result:
            for box in result.boxes:
                class_id = int(box.cls[0].item())
                class_name = result.names[class_id]
                
                # Look for the 'photo' field
                if class_name == 'photo':
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    
                    # Add 10% padding to include more of the photo
                    width = x2 - x1
                    height = y2 - y1
                    padding_x = int(width * 0.10)
                    padding_y = int(height * 0.10)
                    
                    x1_padded = max(0, x1 - padding_x)
                    y1_padded = max(0, y1 - padding_y)
                    x2_padded = min(cropped_id.shape[1], x2 + padding_x)
                    y2_padded = min(cropped_id.shape[0], y2 + padding_y)
                    
                    # Crop the photo
                    photo_crop = cropped_id[y1_padded:y2_padded, x1_padded:x2_padded]
                    
                    # Convert to base64
                    _, buffer = cv2.imencode('.jpg', photo_crop)
                    face_base64 = base64.b64encode(buffer).decode('utf-8')
                    
                    print(f"✅ Successfully extracted face using YOLO (size: {photo_crop.shape[1]}x{photo_crop.shape[0]})")
                    return face_base64, None
        
        # If no photo field detected
        return None, "No photo field detected on ID card"
        
    except Exception as e:
        print(f"❌ Error extracting face with YOLO: {e}")
        import traceback
        traceback.print_exc()
        return None, f"Error during face extraction: {str(e)}"

# Quick ID card detection for real-time feedback (without full OCR)
def detect_id_card_quick(image_path, session_data=None):
    """
    Quick ID card detection for real-time camera feedback.
    Returns detection status, bounding box, and quality metrics without full OCR.
    """
    try:
        # Perform inference to detect the ID card
        id_card_results = id_card_model(image_path, verbose=False)
        
        # Load the original image
        image = cv2.imread(image_path)
        if image is None:
            return {
                "detected": False,
                "error": "Could not read image"
            }
        
        # Check if ID card is detected
        for result in id_card_results:
            if len(result.boxes) > 0:
                box = result.boxes[0]  # Take the first detected ID card
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                confidence = float(box.conf[0])
                
                # Crop the ID card
                cropped_image = image[y1:y2, x1:x2]
                
                # Quick quality assessment
                height, width = cropped_image.shape[:2]
                area = width * height
                
                # Assess image quality
                gray = cv2.cvtColor(cropped_image, cv2.COLOR_BGR2GRAY)
                blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
                
                # Brightness assessment
                brightness = np.mean(gray)
                
                # Determine quality level
                quality_level = "good"
                quality_issues = []
                
                if area < 100000:  # Less than ~316x316 pixels
                    quality_level = "poor"
                    quality_issues.append("Image too small")
                elif area < 200000:  # Less than ~447x447 pixels
                    quality_level = "fair"
                    quality_issues.append("Image could be larger")
                
                if blur_score < 100:
                    quality_level = "poor" if quality_level == "poor" else "fair"
                    quality_issues.append("Image is blurry")
                
                if brightness < 50 or brightness > 200:
                    quality_level = "fair" if quality_level == "good" else quality_level
                    quality_issues.append("Poor lighting")
                
                # Detect fields for progress tracking
                fields_result = objects_model(cropped_image, verbose=False)
                detected_field_names = []
                
                for field_result in fields_result:
                    for field_box in field_result.boxes:
                        class_id = int(field_box.cls[0].item())
                        class_name = field_result.names[class_id]
                        detected_field_names.append(class_name)
                
                return {
                    "detected": True,
                    "confidence": round(confidence, 2),
                    "bbox": {
                        "x1": x1,
                        "y1": y1,
                        "x2": x2,
                        "y2": y2
                    },
                    "quality": {
                        "quality_level": quality_level,
                        "blur_score": round(blur_score, 2),
                        "brightness": round(brightness, 2),
                        "area": area,
                        "issues": quality_issues
                    },
                    "fields": detected_field_names,
                    "field_count": len(detected_field_names)
                }
        
        # No ID card detected
        return {
            "detected": False,
            "confidence": 0.0
        }
        
    except Exception as e:
        print(f"Error in detect_id_card_quick: {e}")
        import traceback
        traceback.print_exc()
        return {
            "detected": False,
            "error": str(e)
        }

# Function to draw text with background for better visibility
def draw_text_with_background(frame, text, position, font=cv2.FONT_HERSHEY_SIMPLEX, 
                              font_scale=0.7, text_color=(255, 255, 255), 
                              bg_color=(0, 100, 0), thickness=2, padding=5):
    """Draw text with a background rectangle for better visibility"""
    x, y = position
    
    # Get text size
    (text_width, text_height), baseline = cv2.getTextSize(text, font, font_scale, thickness)
    
    # Draw background rectangle
    cv2.rectangle(frame, 
                 (x - padding, y - text_height - padding),
                 (x + text_width + padding, y + baseline + padding),
                 bg_color, -1)
    
    # Draw text
    cv2.putText(frame, text, (x, y), font, font_scale, text_color, thickness)
    
    return text_height + baseline + 2 * padding

# Function to draw field overlays on the frame
def draw_field_overlays(frame, field_data, bbox=None):
    """Draw extracted information overlays on the frame"""
    overlay = frame.copy()
    
    # If bbox is provided, draw it
    if bbox is not None:
        x1, y1, x2, y2 = bbox
        cv2.rectangle(overlay, (x1, y1), (x2, y2), (0, 255, 0), 3)
    
    # Prepare overlay text
    height, width = frame.shape[:2]
    
    # Draw semi-transparent panel on the left side
    panel_width = 450
    cv2.rectangle(overlay, (0, 0), (panel_width, height), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)
    
    # Title
    y_offset = 50
    draw_text_with_background(frame, "Egyptian ID Card Scanner", 
                            (20, y_offset), font_scale=0.9, 
                            bg_color=(0, 120, 0), thickness=2)
    
    y_offset += 60
    
    # Draw each field
    if field_data:
        first_name = field_data.get('first_name', '')
        second_name = field_data.get('second_name', '')
        full_name = field_data.get('full_name', '')
        national_id = field_data.get('national_id', '')
        address = field_data.get('address', '')
        birth_date = field_data.get('birth_date', '')
        governorate = field_data.get('governorate', '')
        gender = field_data.get('gender', '')
        
        # Draw fields
        fields = [
            ("First Name:", first_name),
            ("Second Name:", second_name),
            ("Full Name:", full_name),
            ("National ID:", national_id),
            ("Address:", address),
            ("Birth Date:", birth_date),
            ("Governorate:", governorate),
            ("Gender:", gender)
        ]
        
        for label, value in fields:
            if value:  # Only draw if value exists
                # Draw label
                draw_text_with_background(frame, label, 
                                        (20, y_offset), font_scale=0.6,
                                        bg_color=(50, 50, 50), thickness=2)
                y_offset += 35
                
                # Draw value (handle long text by wrapping)
                value_str = str(value)
                if len(value_str) > 30:
                    # Split long text
                    words = value_str.split()
                    current_line = ""
                    for word in words:
                        if len(current_line + word) < 30:
                            current_line += word + " "
                        else:
                            draw_text_with_background(frame, current_line, 
                                                    (30, y_offset), font_scale=0.55,
                                                    bg_color=(0, 80, 0), thickness=1)
                            y_offset += 30
                            current_line = word + " "
                    if current_line:
                        draw_text_with_background(frame, current_line, 
                                                (30, y_offset), font_scale=0.55,
                                                bg_color=(0, 80, 0), thickness=1)
                        y_offset += 30
                else:
                    draw_text_with_background(frame, value_str, 
                                            (30, y_offset), font_scale=0.6,
                                            bg_color=(0, 80, 0), thickness=2)
                    y_offset += 40
    else:
        draw_text_with_background(frame, "No ID Card Detected", 
                                (20, y_offset), font_scale=0.7,
                                bg_color=(0, 0, 150), thickness=2)
    
    return frame

# Real-time processing function for camera feed
def detect_and_process_id_card_realtime(frame):
    """Process a video frame in real-time and return frame with overlays"""
    # Perform inference to detect the ID card
    id_card_results = id_card_model(frame, verbose=False)
    
    # Check if ID card is detected
    id_detected = False
    cropped_image = None
    bbox = None
    
    for result in id_card_results:
        if len(result.boxes) > 0:
            box = result.boxes[0]  # Take the first detected ID card
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            bbox = (x1, y1, x2, y2)
            cropped_image = frame[y1:y2, x1:x2]
            id_detected = True
            break
    
    if not id_detected:
        # No ID card detected, return frame with message
        return draw_field_overlays(frame, None)
    
    # Process the cropped ID card
    try:
        # Detect fields in the ID card
        results = objects_model(cropped_image, verbose=False)
        
        # Variables to store extracted values
        field_data = {
            'first_name': '',
            'second_name': '',
            'full_name': '',
            'national_id': '',
            'address': '',
            'birth_date': '',
            'governorate': '',
            'gender': ''
        }
        
        # Loop through the results
        for result in results:
            for box in result.boxes:
                bbox_field = box.xyxy[0].tolist()
                class_id = int(box.cls[0].item())
                class_name = result.names[class_id]
                bbox_field = [int(coord) for coord in bbox_field]
                
                # Draw bounding boxes on the cropped ID card
                x1_f, y1_f, x2_f, y2_f = bbox_field
                cv2.rectangle(cropped_image, (x1_f, y1_f), (x2_f, y2_f), (0, 255, 255), 2)
                cv2.putText(cropped_image, class_name, (x1_f, y1_f - 5), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
                
                # Extract text based on field type
                if class_name == 'firstName':
                    field_data['first_name'] = extract_text(cropped_image, bbox_field, lang='ara')
                elif class_name == 'lastName':
                    field_data['second_name'] = extract_text(cropped_image, bbox_field, lang='ara')
                elif class_name == 'address':
                    field_data['address'] = extract_text(cropped_image, bbox_field, lang='ara')
                elif class_name == 'nid':
                    expanded_bbox = expand_bbox_height(bbox_field, scale=1.5, image_shape=cropped_image.shape)
                    cropped_nid = cropped_image[expanded_bbox[1]:expanded_bbox[3], expanded_bbox[0]:expanded_bbox[2]]
                    field_data['national_id'] = detect_national_id(cropped_nid)
        
        # Create full name
        if field_data['first_name'] and field_data['second_name']:
            field_data['full_name'] = f"{field_data['first_name']} {field_data['second_name']}"
        
        # Decode national ID if available
        if field_data['national_id']:
            try:
                decoded_info = decode_egyptian_id(field_data['national_id'])
                field_data['birth_date'] = decoded_info['Birth Date']
                field_data['governorate'] = decoded_info['Governorate']
                field_data['gender'] = decoded_info['Gender']
            except:
                pass
        
        # Place the cropped image back on the frame
        frame[bbox[1]:bbox[3], bbox[0]:bbox[2]] = cropped_image
        
        # Draw overlays on the frame
        frame = draw_field_overlays(frame, field_data, bbox)
        
        return frame
        
    except Exception as e:
        # If processing fails, just return the frame with the bbox
        return draw_field_overlays(frame, None, bbox)

# print(detect_and_process_id_card("font_ID.jpg"))
