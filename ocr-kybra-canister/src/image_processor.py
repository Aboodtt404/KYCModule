# Image Processing Module
import cv2
import numpy as np
from scipy import ndimage


def preprocess_image(cropped_image):
    """
    Smart preprocessing for OCR that handles high-resolution images better.
    Resizes images to optimal resolution and applies appropriate preprocessing.
    """
    height, width = cropped_image.shape[:2]

    # Convert to grayscale first
    gray_image = cv2.cvtColor(cropped_image, cv2.COLOR_BGR2GRAY)

    # Smart resizing based on image dimensions
    if width > 1500 or height > 1500:
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

        # Use INTER_AREA for downsampling (better for text)
        gray_image = cv2.resize(gray_image, (new_width, new_height),
                                interpolation=cv2.INTER_AREA)

        # Apply denoising for high-res images
        gray_image = cv2.fastNlMeansDenoising(
            gray_image, h=10, templateWindowSize=7, searchWindowSize=21)

        # Enhance contrast for better OCR
        gray_image = cv2.equalizeHist(gray_image)

    elif width < 400 or height < 300:
        # Upscale small images
        scale = max(400 / width, 300 / height)
        new_width = int(width * scale)
        new_height = int(height * scale)

        # Use INTER_CUBIC for upsampling
        gray_image = cv2.resize(gray_image, (new_width, new_height),
                                interpolation=cv2.INTER_CUBIC)

    # Final contrast enhancement for all images
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray_image = clahe.apply(gray_image)

    return gray_image


def auto_rotate_image(image):
    """Auto-rotate image to find best orientation"""
    try:
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

            if score > best_score:
                best_score = score
                best_image = rotated
                best_angle = angle

        return best_image

    except Exception as e:
        return image


def score_orientation(image):
    """Score image orientation based on YOLO field detection"""
    try:
        from ultralytics import YOLO
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
        return 0, []


def enhance_contrast(image):
    """Enhance image contrast using CLAHE"""
    try:
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)

        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        l = clahe.apply(l)

        enhanced = cv2.merge([l, a, b])
        enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)

        return enhanced

    except Exception as e:
        return image


def reduce_noise(image):
    """Reduce image noise"""
    try:
        denoised = cv2.fastNlMeansDenoising(
            image, h=10, templateWindowSize=7, searchWindowSize=21)
        return denoised
    except Exception as e:
        return image


def preprocess_id_image(image):
    """Main preprocessing pipeline for ID images"""
    # Test orientations
    processed = auto_rotate_image(image)

    # Enhance contrast
    processed = enhance_contrast(processed)

    return processed
