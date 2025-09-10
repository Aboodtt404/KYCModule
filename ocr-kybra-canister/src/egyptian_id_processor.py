# Egyptian ID Card Processing
import cv2
import numpy as np
import re
import easyocr
from ultralytics import YOLO
from .image_processor import preprocess_image, preprocess_id_image

# Initialize EasyOCR reader
reader = easyocr.Reader(['ar'], gpu=False)


def process_egyptian_id_card(image_data: bytes) -> dict:
    """Main function to process Egyptian ID card"""
    try:
        # Convert bytes to image
        nparr = np.frombuffer(image_data, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            return {
                "success": False,
                "error": "Could not decode image",
                "data": None
            }

        # Preprocess image
        preprocessed_image = preprocess_id_image(image)

        # Detect ID card
        id_card_results = detect_id_card(preprocessed_image)

        if not id_card_results:
            return {
                "success": False,
                "error": "Could not detect ID card in image",
                "data": None
            }

        # Process the detected ID card
        result = process_image(id_card_results['cropped_image'])

        return {
            "success": True,
            "error": None,
            "data": result
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "data": None
        }


def detect_id_card(image):
    """Detect and crop ID card from image"""
    try:
        id_card_model = YOLO('models/detect_id_card.pt')
        id_card_results = id_card_model(image)

        for result in id_card_results:
            if result.boxes is not None:
                for box in result.boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    confidence = float(box.conf[0].item())

                    if confidence > 0.5:  # Only process high-confidence detections
                        height, width = image.shape[:2]
                        padding_top = max(20, int((y2 - y1) * 0.1))
                        padding_sides = max(10, int((x2 - x1) * 0.05))
                        padding_bottom = max(50, int((y2 - y1) * 0.15))

                        x1_padded = max(0, x1 - padding_sides)
                        y1_padded = max(0, y1 - padding_top)
                        x2_padded = min(width, x2 + padding_sides)
                        y2_padded = min(height, y2 + padding_bottom)

                        cropped_image = image[y1_padded:y2_padded,
                                              x1_padded:x2_padded]

                        return {
                            'cropped_image': cropped_image,
                            'bbox': [x1, y1, x2, y2],
                            'confidence': confidence
                        }

        return None

    except Exception as e:
        return None


def process_image(cropped_image):
    """Process cropped ID card image to extract data"""
    try:
        model = YOLO('models/detect_odjects.pt')
        results = model(cropped_image, conf=0.3)

        first_name = ''
        second_name = ''
        merged_name = ''
        nid = ''
        address = ''
        serial = ''

        for result in results:
            if result.boxes is not None:
                for box in result.boxes:
                    bbox = box.xyxy[0].tolist()
                    class_id = int(box.cls[0].item())
                    class_name = result.names[class_id]
                    confidence = float(box.conf[0].item())
                    bbox = [int(coord) for coord in bbox]

                    if class_name == 'firstName':
                        x1, y1, x2, y2 = bbox
                        field_image = cropped_image[y1:y2, x1:x2]
                        text = extract_text(field_image)
                        first_name = text.strip()

                    elif class_name == 'secondName':
                        x1, y1, x2, y2 = bbox
                        field_image = cropped_image[y1:y2, x1:x2]
                        text = extract_text(field_image)
                        second_name = text.strip()

                    elif class_name == 'nid':
                        x1, y1, x2, y2 = bbox
                        field_image = cropped_image[y1:y2, x1:x2]
                        text = extract_text(field_image)
                        nid = text.strip()

                    elif class_name == 'address':
                        x1, y1, x2, y2 = bbox
                        field_image = cropped_image[y1:y2, x1:x2]
                        text = extract_text(field_image)
                        address = text.strip()

                    elif class_name == 'serial':
                        x1, y1, x2, y2 = bbox
                        field_image = cropped_image[y1:y2, x1:x2]
                        text = extract_text(field_image)
                        serial = text.strip()

        # Parse additional data from national ID
        parsed_data = parse_egyptian_id_data(nid)

        # Merge names
        if first_name and second_name:
            merged_name = f"{first_name} {second_name}"
        elif first_name:
            merged_name = first_name
        elif second_name:
            merged_name = second_name

        return {
            'first_name': first_name,
            'second_name': second_name,
            'merged_name': merged_name,
            'national_id': nid,
            'address': address,
            'serial_number': serial,
            'date_of_birth': parsed_data.get('date_of_birth', ''),
            'gender': parsed_data.get('gender', ''),
            'governorate': parsed_data.get('governorate', '')
        }

    except Exception as e:
        return {
            'first_name': '',
            'second_name': '',
            'merged_name': '',
            'national_id': '',
            'address': '',
            'serial_number': '',
            'date_of_birth': '',
            'gender': '',
            'governorate': ''
        }


def extract_text(image, lang='ar'):
    """Extract text from image using EasyOCR"""
    try:
        preprocessed_image = preprocess_image(image)
        results = reader.readtext(preprocessed_image, detail=0, paragraph=True)
        text = ' '.join(results)
        return text.strip()
    except Exception as e:
        return ''


def parse_egyptian_id_data(national_id):
    """Parse Egyptian national ID to extract additional data"""
    try:
        if not national_id or len(national_id) < 14:
            return {}

        # Extract date of birth (positions 1-7)
        birth_year = int(national_id[1:3])
        birth_month = int(national_id[3:5])
        birth_day = int(national_id[5:7])

        # Determine century
        if birth_year >= 0 and birth_year <= 30:
            birth_year += 2000
        else:
            birth_year += 1900

        # Format date
        date_of_birth = f"{birth_day:02d}/{birth_month:02d}/{birth_year}"

        # Extract gender (position 12)
        gender_code = int(national_id[12])
        gender = "Male" if gender_code % 2 == 1 else "Female"

        # Extract governorate (positions 7-9)
        governorate_code = int(national_id[7:9])
        governorate_map = {
            1: "Cairo", 2: "Alexandria", 3: "Port Said", 4: "Suez",
            5: "Dakahlia", 6: "Sharkia", 7: "Qalyubia", 8: "Kafr El Sheikh",
            9: "Gharbia", 10: "Monufia", 11: "Beheira", 12: "Ismailia",
            13: "Giza", 14: "Bani Suef", 15: "Fayoum", 16: "Minya",
            17: "Asyut", 18: "Sohag", 19: "Qena", 20: "Aswan",
            21: "Luxor", 22: "Red Sea", 23: "New Valley", 24: "Matrouh",
            25: "North Sinai", 26: "South Sinai", 27: "Damietta"
        }
        governorate = governorate_map.get(governorate_code, "Unknown")

        return {
            'date_of_birth': date_of_birth,
            'gender': gender,
            'governorate': governorate
        }

    except Exception as e:
        return {}
