from ultralytics import YOLO
import cv2
import re
import easyocr
import os
import numpy as np
from scipy import ndimage

reader = easyocr.Reader(['ar'], gpu=False)


def preprocess_image(cropped_image):
    """
    Smart preprocessing for OCR that handles high-resolution images better.
    Resizes images to optimal resolution and applies appropriate preprocessing.
    """
    height, width = cropped_image.shape[:2]
    print(f"🔍 Original image size: {width}x{height}")

    # Convert to grayscale first
    gray_image = cv2.cvtColor(cropped_image, cv2.COLOR_BGR2GRAY)

    # Smart resizing based on image dimensions
    if width > 1500 or height > 1500:
        print("📏 High-resolution image detected, applying smart resizing...")

        # Calculate optimal size (target width around 1000-1200px)
        optimal_width = 1000
        if width > height:
            # Landscape orientation
            scale = optimal_width / width
            new_width = optimal_width
            new_height = int(height * scale)
        else:
            # Portrait orientation
            optimal_height = 1000
            scale = optimal_height / height
            new_height = optimal_height
            new_width = int(width * scale)

        # Ensure minimum dimensions for readability
        new_width = max(new_width, 400)
        new_height = max(new_height, 300)

        print(
            f"📐 Resizing from {width}x{height} to {new_width}x{new_height} (scale: {scale:.3f})")

        # Use INTER_AREA for downsampling (better for text)
        gray_image = cv2.resize(gray_image, (new_width, new_height),
                                interpolation=cv2.INTER_AREA)

        # Apply denoising for high-res images
        print("🧹 Applying denoising for high-resolution image...")
        gray_image = cv2.fastNlMeansDenoising(
            gray_image, h=10, templateWindowSize=7, searchWindowSize=21)

        # Enhance contrast for better OCR
        print("🎨 Enhancing contrast...")
        gray_image = cv2.equalizeHist(gray_image)

    elif width < 400 or height < 300:
        print("📏 Low-resolution image detected, upscaling...")

        # Upscale small images
        scale = max(400 / width, 300 / height)
        new_width = int(width * scale)
        new_height = int(height * scale)

        print(
            f"📐 Upscaling from {width}x{height} to {new_width}x{new_height} (scale: {scale:.3f})")

        # Use INTER_CUBIC for upsampling
        gray_image = cv2.resize(gray_image, (new_width, new_height),
                                interpolation=cv2.INTER_CUBIC)

    else:
        print("✅ Image size is optimal for OCR")

    # Final contrast enhancement for all images
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray_image = clahe.apply(gray_image)

    print(
        f"✅ Preprocessing completed. Final size: {gray_image.shape[1]}x{gray_image.shape[0]}")
    return gray_image


def auto_rotate_image(image):
    try:
        print("🔄 Testing all four orientations (0°, 90°, 180°, 270°)...")

        orientations = [0, 90, 180, 270]
        best_image = image
        best_score = 0
        best_angle = 0

        for angle in orientations:
            if angle == 0:
                rotated = image.copy()
            else:
                height, width = image.shape[:2]
                center = (width // 2, height // 2)
                rotation_matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
                rotated = cv2.warpAffine(image, rotation_matrix, (width, height),
                                         flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

            score, detected_fields = score_orientation(rotated)
            fields_str = ", ".join(
                detected_fields) if detected_fields else "none"
            print(
                f"   📊 {angle}° orientation score: {score:.3f} (fields: {fields_str})")

            if score > best_score:
                best_score = score
                best_image = rotated
                best_angle = angle

        if best_angle != 0:
            print(
                f"✅ Best orientation found: {best_angle}° (score: {best_score:.3f})")
        else:
            print(
                f"✅ Original orientation (0°) is best (score: {best_score:.3f})")

        return best_image

    except Exception as e:
        print(f"⚠️ Auto-rotation failed: {e}")
        return image


def score_orientation(image):
    try:
        model = YOLO('models/detect_odjects.pt')
        results = model(image, conf=0.3)

        field_count = 0
        total_confidence = 0
        detected_fields = []

        for result in results:
            if result.boxes is not None:
                for box in result.boxes:
                    class_id = int(box.cls[0].item())
                    class_name = result.names[class_id]
                    confidence = float(box.conf[0].item())

                    if class_name == 'firstName':
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        print(
                            f"      🔍 Detected field: {class_name} (conf: {confidence:.3f}) at [{x1}, {y1}, {x2}, {y2}]")
                    else:
                        print(
                            f"      🔍 Detected field: {class_name} (conf: {confidence:.3f})")

                    if class_name in ['firstName', 'lastName', 'nid', 'address', 'serial']:
                        field_count += 1
                        total_confidence += confidence
                        detected_fields.append(class_name)

        if field_count > 0:
            avg_confidence = total_confidence / field_count
            score = field_count + avg_confidence
        else:
            score = 0

        return score, detected_fields

    except Exception as e:
        print(f"⚠️ Orientation scoring failed: {e}")
        return 0, []


def enhance_contrast(image):
    try:
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)

        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        l = clahe.apply(l)

        enhanced = cv2.merge([l, a, b])
        enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)

        print("✅ Contrast enhanced using CLAHE")
        return enhanced

    except Exception as e:
        print(f"⚠️ Contrast enhancement failed: {e}")
        return image


def reduce_noise(image):
    try:
        denoised = cv2.fastNlMeansDenoisingColored(image, None, h=10, hColor=10,
                                                   templateWindowSize=7, searchWindowSize=21)

        print("✅ Noise reduction applied")
        return denoised

    except Exception as e:
        print(f"⚠️ Noise reduction failed: {e}")
        return image


def preprocess_id_image(image):
    print("🔧 Starting image preprocessing pipeline...")

    print("1️⃣ Testing orientations...")
    processed = auto_rotate_image(image)

    debug_folder = 'debug_images'
    os.makedirs(debug_folder, exist_ok=True)
    preprocessed_path = os.path.join(debug_folder, 'preprocessed_image.jpg')
    cv2.imwrite(preprocessed_path, processed)
    print(f"💾 Preprocessed image saved to: {preprocessed_path}")

    print("✅ Image preprocessing completed")
    return processed


def extract_text(image, bbox, lang='ara'):
    x1, y1, x2, y2 = bbox
    cropped_image = image[y1:y2, x1:x2]
    preprocessed_image = preprocess_image(cropped_image)
    results = reader.readtext(preprocessed_image, detail=0, paragraph=True)
    text = ' '.join(results)
    return text.strip()


def detect_national_id(cropped_image):
    model = YOLO('models/detect_id.pt')
    results = model(cropped_image)
    detected_info = []

    for result in results:
        for box in result.boxes:
            cls = int(box.cls)
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            detected_info.append((cls, x1))
            cv2.rectangle(cropped_image, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(cropped_image, str(cls), (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (36, 255, 12), 2)

    detected_info.sort(key=lambda x: x[1])
    id_number = ''.join([str(cls) for cls, _ in detected_info])

    return id_number


def remove_numbers(text):
    return re.sub(r'\d+', '', text)


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


def process_image(cropped_image):
    model = YOLO('models/detect_odjects.pt')
    results = model(cropped_image, conf=0.3)

    print("🔍 DEBUG: All detections with conf >= 0.1:")
    for result in results:
        for box in result.boxes:
            confidence = float(box.conf[0])
            if confidence >= 0.1:
                class_id = int(box.cls[0])
                class_name = model.names[class_id]
                print(f"      🔍 DEBUG: {class_name} (conf: {confidence:.3f})")

    first_name = ''
    second_name = ''
    merged_name = ''
    nid = ''
    address = ''
    serial = ''

    detected_fields = []
    debug_image = cropped_image.copy()

    for result in results:
        debug_folder = 'debug_images'
        os.makedirs(debug_folder, exist_ok=True)
        output_path = os.path.join(debug_folder, 'd2.jpg')
        result.save(output_path)

        print(f"🔍 YOLO Detection Results:")
        print(
            f"   📊 Total detections: {len(result.boxes) if result.boxes is not None else 0}")

        for box in result.boxes:
            bbox = box.xyxy[0].tolist()
            class_id = int(box.cls[0].item())
            class_name = result.names[class_id]
            confidence = float(box.conf[0].item())
            bbox = [int(coord) for coord in bbox]

            detected_fields.append({
                'class': class_name,
                'confidence': confidence,
                'bbox': bbox
            })

            print(
                f"   🎯 Detected: {class_name} (conf: {confidence:.3f}) at {bbox}")

            if class_name == 'firstName':
                print(
                    f"      🎯 FOUND firstName with confidence {confidence:.3f}!")

            if len(detected_fields) == 1:
                print(
                    f"      📋 Available field names: {list(result.names.values())}")

            x1, y1, x2, y2 = bbox
            cv2.rectangle(debug_image, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(debug_image, f"{class_name}: {confidence:.2f}", (x1, y1-10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

            if class_name == 'firstName':
                first_name = extract_text(cropped_image, bbox, lang='ara')
                print(f"   📝 First Name: '{first_name}'")
            elif class_name == 'lastName':
                second_name = extract_text(cropped_image, bbox, lang='ara')
                print(f"   📝 Last Name: '{second_name}'")
            elif class_name == 'serial':
                serial = extract_text(cropped_image, bbox, lang='eng')
                print(f"   📝 Serial: '{serial}'")
            elif class_name == 'address':
                address = extract_text(cropped_image, bbox, lang='ara')
                print(f"   📝 Address: '{address}'")
            elif class_name == 'nid':
                expanded_bbox = expand_bbox_height(
                    bbox, scale=1.5, image_shape=cropped_image.shape)
                cropped_nid = cropped_image[expanded_bbox[1]:expanded_bbox[3], expanded_bbox[0]:expanded_bbox[2]]
                nid = detect_national_id(cropped_nid)
                print(f"   📝 National ID: '{nid}'")

    merged_name = f"{first_name} {second_name}"
    print(f"First Name: {first_name}")
    print(f"Second Name: {second_name}")
    print(f"Full Name: {merged_name}")
    print(f"National ID: {nid}")
    print(f"Address: {address}")
    print(f"Serial: {serial}")

    detected_field_names = [field['class'] for field in detected_fields]
    expected_fields = ['firstName', 'lastName', 'nid', 'address', 'serial']
    missing_fields = [
        field for field in expected_fields if field not in detected_field_names]
    print(f"🔍 Field Detection Summary:")
    print(f"   ✅ Detected: {detected_field_names}")
    print(f"   ❌ Missing: {missing_fields}")

    debug_folder = 'debug_images'
    os.makedirs(debug_folder, exist_ok=True)
    debug_output_path = os.path.join(debug_folder, 'egyptian_id_debug.jpg')
    cv2.imwrite(debug_output_path, debug_image)
    print(f"💾 Debug image saved to: {debug_output_path}")
    print(f"📋 Total fields detected: {len(detected_fields)}")

    decoded_info = decode_egyptian_id(nid)
    return (first_name, second_name, merged_name, nid, address, decoded_info["Birth Date"], decoded_info["Governorate"], decoded_info["Gender"], detected_fields, debug_output_path, serial)


def decode_egyptian_id(id_number):
    if not id_number or len(id_number) < 14:
        print(
            f"⚠️ Invalid ID number length: {len(id_number) if id_number else 0} (expected 14)")
        return {
            'Birth Date': 'Unknown',
            'Governorate': 'Unknown',
            'Gender': 'Unknown'
        }

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

    try:
        century_digit = int(id_number[0])
        year = int(id_number[1:3])
        month = int(id_number[3:5])
        day = int(id_number[5:7])
        governorate_code = id_number[7:9]
        gender_code = int(id_number[12:13])
    except (ValueError, IndexError) as e:
        print(f"⚠️ Error parsing ID number '{id_number}': {e}")
        return {
            'Birth Date': 'Unknown',
            'Governorate': 'Unknown',
            'Gender': 'Unknown'
        }

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


def detect_and_process_id_card(image_path):
    print(f"🖼️ Processing image: {image_path}")

    image = cv2.imread(image_path)

    if image is None:
        raise ValueError(f"Could not load image from {image_path}")

    print("🔧 Applying image preprocessing...")
    preprocessed_image = preprocess_id_image(image)

    id_card_model = YOLO('models/detect_id_card.pt')

    id_card_results = id_card_model(preprocessed_image)

    print(f"🃏 ID Card Detection Results:")
    print(
        f"   📊 Total ID card detections: {len(id_card_results[0].boxes) if id_card_results[0].boxes is not None else 0}")

    for result in id_card_results:
        for box in result.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            confidence = float(box.conf[0].item())
            print(
                f"   🎯 ID Card detected (conf: {confidence:.3f}) at [{x1}, {y1}, {x2}, {y2}]")

            height, width = preprocessed_image.shape[:2]
            padding_top = max(20, int((y2 - y1) * 0.1))
            padding_sides = max(10, int((x2 - x1) * 0.05)
                                )
            padding_bottom = max(50, int((y2 - y1) * 0.15)
                                 )

            x1_padded = max(0, x1 - padding_sides)
            y1_padded = max(0, y1 - padding_top)
            x2_padded = min(width, x2 + padding_sides)
            y2_padded = min(height, y2 + padding_bottom)

            print(
                f"   📐 Cropping with padding: [{x1_padded}, {y1_padded}, {x2_padded}, {y2_padded}]")
            cropped_image = preprocessed_image[y1_padded:y2_padded,
                                               x1_padded:x2_padded]

            debug_folder = 'debug_images'
            os.makedirs(debug_folder, exist_ok=True)
            cropped_path = os.path.join(debug_folder, 'cropped_id_card.jpg')
            cv2.imwrite(cropped_path, cropped_image)
            print(f"💾 Cropped ID card saved to: {cropped_path}")

    return process_image(cropped_image)


def check_image_quality(image):
    """
    Check image quality for ID card detection.
    Returns quality metrics: blur, brightness, size, and overall quality score.
    """
    height, width = image.shape[:2]

    # Convert to grayscale for blur detection
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(
        image.shape) == 3 else image

    # 1. Blur Detection using Laplacian variance
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    blur_score = min(laplacian_var / 100, 1.0)  # Normalize to 0-1
    is_blurry = laplacian_var < 50  # Threshold for blur detection

    # 2. Brightness Check
    brightness = np.mean(gray)
    brightness_score = 1.0 if 50 < brightness < 200 else 0.5
    is_too_dark = brightness < 50
    is_too_bright = brightness > 200

    # 3. Size Check (minimum resolution for good OCR)
    min_width, min_height = 400, 300
    size_ok = width >= min_width and height >= min_height
    size_score = 1.0 if size_ok else 0.5

    # 4. Overall Quality Score (0-100)
    quality_score = int(
        (blur_score * 0.5 + brightness_score * 0.3 + size_score * 0.2) * 100)

    # Determine quality level
    if quality_score >= 70 and not is_blurry:
        quality_level = "good"
        feedback = "Perfect! Hold steady."
    elif quality_score >= 50:
        quality_level = "medium"
        if is_blurry:
            feedback = "Image is blurry. Hold steady."
        elif is_too_dark:
            feedback = "Too dark. Find better lighting."
        elif is_too_bright:
            feedback = "Too bright. Reduce glare."
        else:
            feedback = "Adjust position for better quality."
    else:
        quality_level = "poor"
        if is_blurry:
            feedback = "Too blurry. Hold camera steady."
        elif is_too_dark:
            feedback = "Too dark. Need more light."
        elif is_too_bright:
            feedback = "Too bright. Move away from light."
        elif not size_ok:
            feedback = "Move closer to ID card."
        else:
            feedback = "Poor quality. Adjust position."

    return {
        "quality_score": quality_score,
        "quality_level": quality_level,
        "blur_score": round(blur_score, 2),
        "brightness": round(brightness, 2),
        "is_blurry": bool(is_blurry),
        "is_too_dark": bool(is_too_dark),
        "is_too_bright": bool(is_too_bright),
        "size_ok": bool(size_ok),
        "width": int(width),
        "height": int(height),
        "feedback": feedback
    }


def detect_id_card_quick(image_path):
    """
    Quick ID card detection with field-level detection.
    Detects individual fields (firstName, lastName, nid, address, serial) 
    and individual ID number digits in real-time.
    Returns detection status, field bounding boxes, and quality metrics.
    """
    print(f"🔍 Quick field detection for: {image_path}")

    image = cv2.imread(image_path)

    if image is None:
        return {
            "detected": False,
            "error": "Could not load image",
            "quality": None,
            "fields": [],
            "id_digits": [],
            "field_count": 0
        }

    # Check image quality first
    quality_metrics = check_image_quality(image)

    try:
        height, width = image.shape[:2]

        # Step 1: Detect ID card boundary first
        id_card_model = YOLO('models/detect_id_card.pt')
        card_results = id_card_model(image, conf=0.5, verbose=False)

        card_detected = False
        cropped_image = image
        crop_offset_x = 0
        crop_offset_y = 0

        # If ID card is detected, crop to it for better field detection
        for result in card_results:
            if result.boxes is not None and len(result.boxes) > 0:
                box = result.boxes[0]  # Use first detection
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                card_detected = True

                # Add padding
                padding = 20
                x1 = max(0, x1 - padding)
                y1 = max(0, y1 - padding)
                x2 = min(width, x2 + padding)
                y2 = min(height, y2 + padding)

                cropped_image = image[y1:y2, x1:x2]
                crop_offset_x = x1
                crop_offset_y = y1
                break

        # Step 2: Detect individual fields on the ID card
        fields_model = YOLO('models/detect_odjects.pt')
        field_results = fields_model(cropped_image, conf=0.3, verbose=False)

        detected_fields = []
        field_counts = {
            'firstName': 0,
            'lastName': 0,
            'nid': 0,
            'address': 0,
            'serial': 0
        }

        for result in field_results:
            if result.boxes is not None:
                for box in result.boxes:
                    class_id = int(box.cls[0].item())
                    class_name = result.names[class_id]
                    confidence = float(box.conf[0].item())
                    x1, y1, x2, y2 = map(int, box.xyxy[0])

                    # Adjust coordinates back to original image if cropped
                    x1_orig = x1 + crop_offset_x
                    y1_orig = y1 + crop_offset_y
                    x2_orig = x2 + crop_offset_x
                    y2_orig = y2 + crop_offset_y

                    # Track field counts
                    if class_name in field_counts:
                        field_counts[class_name] += 1

                    detected_fields.append({
                        "field": class_name,
                        "confidence": round(confidence, 3),
                        "bbox": {
                            "x1": int(x1_orig),
                            "y1": int(y1_orig),
                            "x2": int(x2_orig),
                            "y2": int(y2_orig),
                            "x1_norm": round(float(x1_orig / width), 3),
                            "y1_norm": round(float(y1_orig / height), 3),
                            "x2_norm": round(float(x2_orig / width), 3),
                            "y2_norm": round(float(y2_orig / height), 3),
                            "width": int(x2_orig - x1_orig),
                            "height": int(y2_orig - y1_orig)
                        }
                    })

        # Step 3: Detect photo region on Egyptian ID (on the LEFT side)
        photo_detected = False
        photo_bbox = None

        if card_detected:
            # Egyptian ID photos are on the LEFT side (left 30% of the card)
            photo_region_x_end = int(
                cropped_image.shape[1] * 0.30)  # Left 30%
            photo_region = cropped_image[:, :photo_region_x_end]

            # Check if there's enough contrast/complexity in photo region (indicating a photo)
            photo_gray = cv2.cvtColor(photo_region, cv2.COLOR_BGR2GRAY)
            photo_variance = np.var(photo_gray)

            # If variance is high, likely contains a photo
            if photo_variance > 100:  # Threshold for detecting photo presence
                photo_detected = True

                # Calculate photo bounding box in original image coordinates (LEFT side)
                photo_bbox = {
                    "x1": int(crop_offset_x),
                    "y1": int(crop_offset_y),
                    "x2": int(photo_region_x_end + crop_offset_x),
                    "y2": int(cropped_image.shape[0] + crop_offset_y),
                    "x1_norm": round(float(crop_offset_x / width), 3),
                    "y1_norm": round(float(crop_offset_y / height), 3),
                    "x2_norm": round(float((photo_region_x_end + crop_offset_x) / width), 3),
                    "y2_norm": round(float((cropped_image.shape[0] + crop_offset_y) / height), 3),
                    "width": int(photo_region_x_end),
                    "height": int(cropped_image.shape[0]),
                    "variance": float(photo_variance),
                    "is_clear": bool(photo_variance > 200)
                }

                print(
                    f"   📸 Photo detected in LEFT region (variance: {photo_variance:.2f})")
            else:
                print(
                    f"   ⚠️ No clear photo detected (variance: {photo_variance:.2f}, threshold: 100)")

        # Step 4: Detect individual ID number digits (if nid field was detected)
        id_digits = []
        nid_field = next(
            (f for f in detected_fields if f['field'] == 'nid'), None)

        if nid_field:
            nid_bbox = nid_field['bbox']
            expand_y = int((nid_bbox['y2'] - nid_bbox['y1']) * 0.25)
            y1_exp = max(0, nid_bbox['y1'] - expand_y)
            y2_exp = min(height, nid_bbox['y2'] + expand_y)

            nid_region = image[y1_exp:y2_exp, nid_bbox['x1']:nid_bbox['x2']]

            try:
                digits_model = YOLO('models/detect_id.pt')
                digit_results = digits_model(
                    nid_region, conf=0.4, verbose=False)

                for result in digit_results:
                    if result.boxes is not None:
                        for box in result.boxes:
                            digit = int(box.cls[0].item())
                            confidence = float(box.conf[0].item())
                            x1, y1, x2, y2 = map(int, box.xyxy[0])

                            # Adjust to original image coordinates
                            x1_orig = x1 + nid_bbox['x1']
                            y1_orig = y1 + y1_exp
                            x2_orig = x2 + nid_bbox['x1']
                            y2_orig = y2 + y1_exp

                            id_digits.append({
                                "digit": int(digit),
                                "confidence": round(confidence, 3),
                                "bbox": {
                                    "x1": int(x1_orig),
                                    "y1": int(y1_orig),
                                    "x2": int(x2_orig),
                                    "y2": int(y2_orig),
                                    "x1_norm": round(float(x1_orig / width), 3),
                                    "y1_norm": round(float(y1_orig / height), 3),
                                    "x2_norm": round(float(x2_orig / width), 3),
                                    "y2_norm": round(float(y2_orig / height), 3)
                                }
                            })

                # Sort digits by x position (left to right)
                id_digits.sort(key=lambda d: d['bbox']['x1'])
            except Exception as e:
                print(f"⚠️ Digit detection error: {e}")

        # Calculate overall detection quality
        # firstName is optional (model struggles with it), but other 4 fields are required
        required_fields = ['lastName', 'nid', 'address',
                           'serial']  # firstName is optional
        optional_fields = ['firstName']
        detected_field_names = [f['field'] for f in detected_fields]

        required_found = [
            f for f in required_fields if f in detected_field_names]
        optional_found = [
            f for f in optional_fields if f in detected_field_names]

        all_required_present = len(required_found) == len(
            required_fields)  # All 4 required fields
        fields_found = len(required_found) + \
            len(optional_found)  # Total count for display

        # Average confidence of detected fields
        avg_confidence = sum(f['confidence'] for f in detected_fields) / \
            len(detected_fields) if detected_fields else 0

        # Determine if ready for capture
        ready_for_capture = (
            # Must have ALL 4 REQUIRED fields + 14 digits + photo (firstName optional)
            len(detected_fields) > 0 and
            all_required_present and  # lastName, nid, address, serial
            len(id_digits) == 14 and  # National ID must have exactly 14 digits
            photo_detected and  # Photo must be visible
            avg_confidence > 0.4 and
            quality_metrics["quality_level"] in ["good", "medium"] and
            not quality_metrics["is_blurry"]
        )

        # Generate feedback message
        if not detected_fields:
            message = "No ID card detected. Show your ID to camera."
        elif not all_required_present:
            # Missing required fields
            missing_required = [
                f for f in required_fields if f not in detected_field_names]
            field_labels = {
                'lastName': 'Last Name',
                'nid': 'National ID',
                'address': 'Address',
                'serial': 'Serial'
            }
            missing_friendly = [field_labels.get(
                f, f) for f in missing_required]
            missing_str = ", ".join(missing_friendly[:3])
            has_firstname = 'firstName' in detected_field_names
            if has_firstname:
                message = f"{fields_found}/5 fields. Missing: {missing_str}"
            else:
                message = f"{fields_found}/4 required. Missing: {missing_str} (First Name optional)"
        elif len(id_digits) < 14:
            has_firstname = 'firstName' in detected_field_names
            if has_firstname:
                message = f"All 5 fields detected! ID digits: {len(id_digits)}/14. Adjust angle."
            else:
                message = f"4/4 required fields. ID digits: {len(id_digits)}/14. Adjust angle."
        elif not photo_detected:
            message = "All fields + digits detected. Adjust angle to show photo clearly."
        elif quality_metrics["is_blurry"]:
            message = "All required fields detected but image is blurry. Hold steady."
        elif quality_metrics["is_too_dark"]:
            message = "All required fields detected but too dark. Find better lighting."
        elif ready_for_capture:
            has_firstname = 'firstName' in detected_field_names
            if has_firstname:
                message = "Perfect! All 5 fields + photo + 14 digits detected."
            else:
                message = "Perfect! All required fields + photo + 14 digits. Ready!"
        else:
            message = f"All required fields detected. Improve image quality."

        print(f"   📊 Fields detected: {field_counts}")
        print(f"   🔢 ID digits detected: {len(id_digits)}")
        print(f"   📸 Photo detected: {photo_detected}")
        print(f"   ✅ Ready for capture: {ready_for_capture}")

        return {
            "detected": bool(len(detected_fields) > 0),
            "fields": detected_fields,
            "id_digits": id_digits,
            "photo": {
                "detected": bool(photo_detected),
                "bbox": photo_bbox if photo_detected else None
            },
            "field_count": int(fields_found),
            "total_detections": int(len(detected_fields)),
            "confidence": round(float(avg_confidence), 3),
            "quality": quality_metrics,
            "ready_for_capture": bool(ready_for_capture),
            "message": message,
            "field_summary": field_counts
        }

    except Exception as e:
        print(f"⚠️ Quick detection error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "detected": False,
            "error": str(e),
            "quality": quality_metrics,
            "fields": [],
            "id_digits": [],
            "field_count": 0
        }
