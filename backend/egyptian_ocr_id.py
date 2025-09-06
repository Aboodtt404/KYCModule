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
                cropped_nid = cropped_image[expanded_bbox[1]
                    :expanded_bbox[3], expanded_bbox[0]:expanded_bbox[2]]
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
    return (first_name, second_name, merged_name, nid, address, decoded_info["Birth Date"], decoded_info["Governorate"], decoded_info["Gender"], detected_fields, debug_output_path)


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
