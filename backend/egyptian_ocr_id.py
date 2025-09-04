from ultralytics import YOLO
import cv2
import re
import easyocr
import os

# Initialize EasyOCR reader (this should be done once for efficiency)
reader = easyocr.Reader(['ar'], gpu=False)

# Function to preprocess the cropped image


def preprocess_image(cropped_image):
    gray_image = cv2.cvtColor(cropped_image, cv2.COLOR_BGR2GRAY)
    return gray_image

# Functions for specific fields with custom OCR configurations


def extract_text(image, bbox, lang='ara'):
    x1, y1, x2, y2 = bbox
    cropped_image = image[y1:y2, x1:x2]
    preprocessed_image = preprocess_image(cropped_image)
    results = reader.readtext(preprocessed_image, detail=0, paragraph=True)
    text = ' '.join(results)
    return text.strip()

# Function to detect national ID numbers in a cropped image


def detect_national_id(cropped_image):
    # Load the model directly in the function
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
    model = YOLO('models/detect_odjects.pt')
    results = model(cropped_image)

    # Variables to store extracted values
    first_name = ''
    second_name = ''
    merged_name = ''
    nid = ''
    address = ''
    serial = ''

    # Debug information
    detected_fields = []
    debug_image = cropped_image.copy()

    # Loop through the results
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

            # Store detection info for debugging
            detected_fields.append({
                'class': class_name,
                'confidence': confidence,
                'bbox': bbox
            })

            print(
                f"   🎯 Detected: {class_name} (conf: {confidence:.3f}) at {bbox}")

            # Draw bounding box on debug image
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
                cropped_nid = cropped_image[expanded_bbox[1]                                            :expanded_bbox[3], expanded_bbox[0]:expanded_bbox[2]]
                nid = detect_national_id(cropped_nid)
                print(f"   📝 National ID: '{nid}'")

    merged_name = f"{first_name} {second_name}"
    print(f"First Name: {first_name}")
    print(f"Second Name: {second_name}")
    print(f"Full Name: {merged_name}")
    print(f"National ID: {nid}")
    print(f"Address: {address}")
    print(f"Serial: {serial}")

    # Save enhanced debug image with all detections in debug folder
    debug_folder = 'debug_images'
    os.makedirs(debug_folder, exist_ok=True)
    debug_output_path = os.path.join(debug_folder, 'egyptian_id_debug.jpg')
    cv2.imwrite(debug_output_path, debug_image)
    print(f"💾 Debug image saved to: {debug_output_path}")
    print(f"📋 Total fields detected: {len(detected_fields)}")

    decoded_info = decode_egyptian_id(nid)
    return (first_name, second_name, merged_name, nid, address, decoded_info["Birth Date"], decoded_info["Governorate"], decoded_info["Gender"], detected_fields, debug_output_path)

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
    print(f"🖼️ Processing image: {image_path}")

    # Load the ID card detection model
    id_card_model = YOLO('models/detect_id_card.pt')

    # Perform inference to detect the ID card
    id_card_results = id_card_model(image_path)

    print(f"🃏 ID Card Detection Results:")
    print(
        f"   📊 Total ID card detections: {len(id_card_results[0].boxes) if id_card_results[0].boxes is not None else 0}")

    # Load the original image using OpenCV
    image = cv2.imread(image_path)

    # Crop the ID card from the image
    for result in id_card_results:
        for box in result.boxes:
            # Get bounding box coordinates
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            confidence = float(box.conf[0].item())
            print(
                f"   🎯 ID Card detected (conf: {confidence:.3f}) at [{x1}, {y1}, {x2}, {y2}]")
            cropped_image = image[y1:y2, x1:x2]

            # Save the cropped ID card for debugging in debug folder
            debug_folder = 'debug_images'
            os.makedirs(debug_folder, exist_ok=True)
            cropped_path = os.path.join(debug_folder, 'cropped_id_card.jpg')
            cv2.imwrite(cropped_path, cropped_image)
            print(f"💾 Cropped ID card saved to: {cropped_path}")

    # Pass the cropped image to the existing processing function
    return process_image(cropped_image)

# print(detect_and_process_id_card("font_ID.jpg"))
