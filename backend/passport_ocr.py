"""
Passport OCR Module
Extract personal information from passport images using MRZ (Machine Readable Zone) processing.
"""

import os
import string as st
import json
import cv2
import numpy as np
from dateutil import parser
import matplotlib.image as mpimg
from passporteye import read_mrz
import easyocr
import warnings
from typing import Dict, Optional, Tuple
import logging

warnings.filterwarnings('ignore')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PassportOCR:
    """Passport OCR processor using MRZ extraction and EasyOCR."""

    def __init__(self, country_codes_path: str = None):
        """
        Initialize the Passport OCR processor.

        Args:
            country_codes_path: Path to country codes JSON file
        """
        self.country_codes_path = country_codes_path or os.path.join(
            os.path.dirname(__file__), 'models', 'country_codes.json'
        )
        self.country_codes = self._load_country_codes()
        self.reader = easyocr.Reader(lang_list=['en'], gpu=False)
        logger.info("Passport OCR initialized successfully")

    def _load_country_codes(self) -> Dict:
        """Load country codes from JSON file."""
        try:
            with open(self.country_codes_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            logger.warning(
                f"Country codes file not found at {self.country_codes_path}")
            return []
        except Exception as e:
            logger.error(f"Error loading country codes: {e}")
            return []

    def _parse_date(self, date_string: str) -> str:
        """
        Parse date string from MRZ format to DD/MM/YYYY.

        Args:
            date_string: Date string in YYMMDD format

        Returns:
            Formatted date string in DD/MM/YYYY format
        """
        try:
            # Add century prefix (20 for 2000s)
            if len(date_string) == 6:
                full_date = "20" + date_string
            else:
                full_date = date_string

            date_obj = parser.parse(full_date, yearfirst=True).date()
            return date_obj.strftime('%d/%m/%Y')
        except Exception as e:
            logger.warning(f"Error parsing date '{date_string}': {e}")
            return date_string

    def _clean_string(self, text: str) -> str:
        """
        Clean string by keeping only alphanumeric characters and converting to uppercase.

        Args:
            text: Input text string

        Returns:
            Cleaned uppercase string
        """
        return ''.join(char for char in text if char.isalnum()).upper()

    def _get_country_name(self, country_code: str) -> str:
        """
        Get full country name from ISO country code.

        Args:
            country_code: ISO alpha-3 country code

        Returns:
            Full country name in uppercase
        """
        if not self.country_codes:
            return country_code

        for country in self.country_codes:
            if country.get('alpha-3') == country_code:
                return country.get('name', country_code).upper()
        return country_code

    def _get_sex(self, sex_code: str) -> str:
        """
        Convert sex code to standardized format.

        Args:
            sex_code: Sex code from MRZ

        Returns:
            Standardized sex code (M/F)
        """
        if sex_code in ['M', 'm']:
            return 'M'
        elif sex_code in ['F', 'f']:
            return 'F'
        elif sex_code == '0':
            return 'M'
        else:
            return 'F'

    def _extract_mrz_data(self, mrz_lines: list) -> Dict[str, str]:
        """
        Extract passport data from MRZ lines.

        Args:
            mrz_lines: List of two MRZ lines (44 characters each)

        Returns:
            Dictionary containing extracted passport data
        """
        if len(mrz_lines) < 2:
            raise ValueError("Invalid MRZ format: Expected 2 lines")

        line1, line2 = mrz_lines[0], mrz_lines[1]

        # Ensure lines are 44 characters long
        if len(line1) < 44:
            line1 = line1 + '<' * (44 - len(line1))
        if len(line2) < 44:
            line2 = line2 + '<' * (44 - len(line2))

        # Extract surname and names from line 1
        surname_names = line1[5:44].split('<<', 1)
        if len(surname_names) < 2:
            surname_names += ['']
        surname, names = surname_names

        # Build result dictionary
        result = {
            'surname': surname.replace('<', ' ').strip().upper(),
            'name': names.replace('<', ' ').strip().upper(),
            'sex': self._get_sex(self._clean_string(line2[20])),
            'date_of_birth': self._parse_date(line2[13:19]),
            'nationality': self._get_country_name(self._clean_string(line2[10:13])),
            'passport_type': self._clean_string(line1[0:2]),
            'passport_number': self._clean_string(line2[0:9]),
            'issuing_country': self._get_country_name(self._clean_string(line1[2:5])),
            'expiration_date': self._parse_date(line2[21:27])
        }

        return result

    def process_passport_image(self, image_path: str) -> Dict[str, any]:
        """
        Process passport image and extract personal information.

        Args:
            image_path: Path to passport image file

        Returns:
            Dictionary containing extracted data and processing status
        """
        try:
            logger.info(f"Processing passport image: {image_path}")

            # Extract MRZ using passporteye
            mrz = read_mrz(image_path, save_roi=True)

            if not mrz:
                return {
                    'success': False,
                    'error': 'Could not detect Machine Readable Zone (MRZ) in the image',
                    'data': None
                }

            # Save MRZ region as temporary image
            temp_mrz_path = 'temp_mrz.png'
            mpimg.imsave(temp_mrz_path, mrz.aux['roi'], cmap='gray')

            try:
                # Load and resize MRZ image
                mrz_img = cv2.imread(temp_mrz_path)
                if mrz_img is None:
                    raise ValueError("Could not load MRZ image")

                mrz_img = cv2.resize(mrz_img, (1110, 140))

                # OCR processing with allowlist
                allowlist = st.ascii_letters + st.digits + '< '
                ocr_results = self.reader.readtext(
                    mrz_img,
                    paragraph=False,
                    detail=0,
                    allowlist=allowlist
                )

                if len(ocr_results) < 2:
                    raise ValueError(
                        "Insufficient OCR results: Expected 2 MRZ lines")

                # Extract data from MRZ lines
                passport_data = self._extract_mrz_data(ocr_results)

                logger.info("Passport data extracted successfully")

                return {
                    'success': True,
                    'error': None,
                    'data': passport_data
                }

            finally:
                # Clean up temporary file
                if os.path.exists(temp_mrz_path):
                    os.remove(temp_mrz_path)

        except Exception as e:
            logger.error(f"Error processing passport image: {e}")
            return {
                'success': False,
                'error': str(e),
                'data': None
            }

    def get_debug_info(self, image_path: str) -> Dict[str, any]:
        """
        Get debug information for passport processing.

        Args:
            image_path: Path to passport image file

        Returns:
            Dictionary containing debug information
        """
        try:
            # Extract MRZ for debug visualization
            mrz = read_mrz(image_path, save_roi=True)

            if not mrz:
                return {
                    'mrz_detected': False,
                    'mrz_roi_path': None,
                    'error': 'No MRZ detected'
                }

            # Save MRZ ROI for debugging
            debug_mrz_path = 'debug_images/mrz_roi.jpg'
            os.makedirs('debug_images', exist_ok=True)
            mpimg.imsave(debug_mrz_path, mrz.aux['roi'], cmap='gray')

            return {
                'mrz_detected': True,
                'mrz_roi_path': debug_mrz_path,
                'error': None
            }

        except Exception as e:
            logger.error(f"Error getting debug info: {e}")
            return {
                'mrz_detected': False,
                'mrz_roi_path': None,
                'error': str(e)
            }


def process_passport(image_path: str) -> Dict[str, any]:
    """
    Convenience function to process passport image.

    Args:
        image_path: Path to passport image file

    Returns:
        Dictionary containing processing results
    """
    ocr_processor = PassportOCR()
    return ocr_processor.process_passport_image(image_path)


def get_passport_debug_info(image_path: str) -> Dict[str, any]:
    """
    Convenience function to get passport debug information.

    Args:
        image_path: Path to passport image file

    Returns:
        Dictionary containing debug information
    """
    ocr_processor = PassportOCR()
    return ocr_processor.get_debug_info(image_path)


if __name__ == "__main__":
    # Test the passport OCR functionality
    test_image = "test_passport.jpg"
    if os.path.exists(test_image):
        result = process_passport(test_image)
        print("Passport OCR Result:")
        print(json.dumps(result, indent=2))
    else:
        print("No test image found. Please provide a passport image for testing.")
