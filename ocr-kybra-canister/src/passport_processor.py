# Passport Processing
import os
import string
import json
import cv2
import numpy as np
from dateutil import parser
import matplotlib.image as mpimg
from passporteye import read_mrz
import easyocr
import warnings

warnings.filterwarnings('ignore')


class PassportOCR:
    def __init__(self, country_codes_path: str = None):
        self.country_codes_path = country_codes_path or 'models/country_codes.json'
        self.country_codes = self._load_country_codes()
        self.reader = easyocr.Reader(lang_list=['en'], gpu=False)

    def _load_country_codes(self) -> dict:
        try:
            with open(self.country_codes_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            return {}
        except Exception as e:
            return {}

    def _parse_date(self, date_string: str) -> str:
        try:
            if len(date_string) == 6:
                full_date = "20" + date_string
            else:
                full_date = date_string

            date_obj = parser.parse(full_date, yearfirst=True).date()
            return date_obj.strftime('%d/%m/%Y')
        except Exception as e:
            return date_string

    def _clean_string(self, text: str) -> str:
        return ''.join(char for char in text if char.isalnum()).upper()

    def _get_country_name(self, country_code: str) -> str:
        if not self.country_codes:
            return country_code

        for country in self.country_codes:
            if country.get('code') == country_code:
                return country.get('name', country_code)
        return country_code

    def _extract_mrz_data(self, mrz_lines: list) -> dict:
        result = {
            'surname': '',
            'given_name': '',
            'passport_number': '',
            'date_of_birth': '',
            'expiration_date': '',
            'sex': '',
            'nationality': '',
            'issuing_country': '',
            'personal_number': ''
        }

        if len(mrz_lines) < 2:
            return result

        line1 = mrz_lines[0]
        line2 = mrz_lines[1]

        # Extract surname and given name from line 1
        if len(line1) > 5:
            # Find the position where names start (after passport type and issuing country)
            name_start = 5
            name_part = line1[name_start:].replace('<', ' ').strip()
            names = name_part.split()

            if len(names) >= 2:
                result['surname'] = names[0]
                result['given_name'] = ' '.join(names[1:])
            elif len(names) == 1:
                result['surname'] = names[0]

        # Extract other data from line 2
        if len(line2) > 44:
            result['passport_number'] = self._clean_string(line2[0:9])
            result['nationality'] = line2[10:13]
            result['date_of_birth'] = self._parse_date(line2[13:19])
            result['sex'] = line2[20]
            result['expiration_date'] = self._parse_date(line2[21:27])
            result['issuing_country'] = line2[2:5]

            # Extract personal number if available
            if len(line2) > 28:
                personal_number = line2[28:42].replace('<', '').strip()
                if personal_number:
                    result['personal_number'] = personal_number

        # Get country names
        result['issuing_country'] = self._get_country_name(
            result['issuing_country'])
        result['nationality'] = self._get_country_name(result['nationality'])

        return result

    def process_passport_image(self, image_data: bytes) -> dict:
        try:
            # Convert bytes to image
            nparr = np.frombuffer(image_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if image is None:
                return {
                    'success': False,
                    'error': 'Could not decode image',
                    'data': None
                }

            # Try to read MRZ using PassportEye
            mrz = read_mrz(image, save_roi=True)

            if not mrz:
                return {
                    'success': False,
                    'error': 'Could not detect Machine Readable Zone (MRZ) in the image',
                    'data': None
                }

            # Save MRZ region for OCR
            temp_mrz_path = 'temp_mrz.png'
            mpimg.imsave(temp_mrz_path, mrz.aux['roi'], cmap='gray')

            try:
                mrz_img = cv2.imread(temp_mrz_path)
                if mrz_img is None:
                    raise ValueError("Could not load MRZ image")

                mrz_img = cv2.resize(mrz_img, (1110, 140))

                allowlist = string.ascii_letters + string.digits + '< '
                ocr_results = self.reader.readtext(
                    mrz_img,
                    paragraph=False,
                    detail=0,
                    allowlist=allowlist
                )

                if len(ocr_results) < 2:
                    raise ValueError(
                        "Insufficient OCR results: Expected 2 MRZ lines")

                passport_data = self._extract_mrz_data(ocr_results)

                return {
                    'success': True,
                    'error': None,
                    'data': passport_data
                }

            finally:
                if os.path.exists(temp_mrz_path):
                    os.remove(temp_mrz_path)

        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'data': None
            }


# Global instance
passport_ocr = PassportOCR()


def process_passport_image(image_data: bytes) -> dict:
    """Main function to process passport image"""
    return passport_ocr.process_passport_image(image_data)
