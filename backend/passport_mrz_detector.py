#!/usr/bin/env python3
"""
Passport MRZ (Machine Readable Zone) Detector
Based on PyImageSearch tutorial - localize and extract MRZ from passport images
"""

import cv2
import numpy as np
import pytesseract
from PIL import Image
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PassportMRZDetector:
    def __init__(self):
        """Initialize the passport information detector"""
        # Kernels for different text types
        self.rect_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 7))   # For MRZ characters
        self.sq_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (21, 21))    # For MRZ lines
        self.text_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 3))   # For general text
        self.small_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))   # For fine details
        
        # Define regions of interest for different passport sections
        self.passport_regions = {
            'upper_left': (0.05, 0.05, 0.45, 0.35),      # Personal info area
            'upper_right': (0.55, 0.05, 0.40, 0.35),     # Photo area + passport number
            'middle_section': (0.05, 0.35, 0.90, 0.25),  # Additional info, dates
            'lower_section': (0.05, 0.60, 0.90, 0.15),   # Above MRZ
            'mrz_section': (0.05, 0.75, 0.90, 0.20)      # MRZ area
        }
        
    def detect_mrz_region(self, image):
        """
        Detect and extract the MRZ region from a passport image
        
        Args:
            image: Input passport image (BGR format)
            
        Returns:
            tuple: (mrz_image, mrz_box) or (None, None) if not found
        """
        try:
            # Convert to grayscale and get dimensions
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            height, width = gray.shape
            
            logger.info(f"Processing passport image: {width}x{height}")
            
            # Step 1: Preprocessing - smooth and apply blackhat
            gray_blurred = cv2.GaussianBlur(gray, (3, 3), 0)
            blackhat = cv2.morphologyEx(gray_blurred, cv2.MORPH_BLACKHAT, self.rect_kernel)
            
            logger.debug("Applied Gaussian blur and blackhat operation")
            
            # Step 2: Compute gradient magnitude (Scharr operator)
            grad = cv2.Sobel(blackhat, ddepth=cv2.CV_32F, dx=1, dy=0, ksize=-1)
            grad = np.absolute(grad)
            
            # Scale gradient to [0, 255]
            min_val, max_val = np.min(grad), np.max(grad)
            if max_val > min_val:  # Avoid division by zero
                grad = (grad - min_val) / (max_val - min_val)
                grad = (grad * 255).astype("uint8")
            else:
                grad = grad.astype("uint8")
            
            logger.debug("Computed gradient magnitude")
            
            # Step 3: Morphological operations to detect MRZ lines
            # Close gaps between characters using rectangular kernel
            grad_closed = cv2.morphologyEx(grad, cv2.MORPH_CLOSE, self.rect_kernel)
            
            # Apply Otsu's thresholding
            _, thresh = cv2.threshold(grad_closed, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
            
            # Close gaps between lines using square kernel
            thresh_closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, self.sq_kernel)
            
            # Perform erosions to break apart connected components
            thresh_eroded = cv2.erode(thresh_closed, None, iterations=2)
            
            logger.debug("Applied morphological operations")
            
            # Step 4: Find and filter contours
            contours, _ = cv2.findContours(thresh_eroded, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if not contours:
                logger.warning("No contours found in image")
                return None, None
            
            # Sort contours from bottom to top (MRZ is at bottom)
            contours = sorted(contours, key=lambda c: cv2.boundingRect(c)[1], reverse=True)
            
            logger.debug(f"Found {len(contours)} contours")
            
            # Step 5: Find the MRZ box
            mrz_box = None
            for contour in contours:
                x, y, w, h = cv2.boundingRect(contour)
                
                # Calculate what percentage of image this contour occupies
                percent_width = w / float(width)
                percent_height = h / float(height)
                
                logger.debug(f"Contour: {w}x{h} at ({x},{y}) - {percent_width:.3f}w x {percent_height:.3f}h")
                
                # MRZ should span most of the width (>80%) and reasonable height (>4%)
                if percent_width > 0.8 and percent_height > 0.04:
                    mrz_box = (x, y, w, h)
                    logger.info(f"✅ Found MRZ region: {w}x{h} at ({x},{y})")
                    break
            
            if mrz_box is None:
                logger.warning("❌ No MRZ region found matching size criteria")
                return None, None
            
            # Step 6: Pad the bounding box (erosions made it smaller)
            x, y, w, h = mrz_box
            pad_x = int((x + w) * 0.03)  # 3% padding
            pad_y = int((y + h) * 0.03)
            
            # Apply padding
            x = max(0, x - pad_x)
            y = max(0, y - pad_y)
            w = min(width - x, w + (pad_x * 2))
            h = min(height - y, h + (pad_y * 2))
            
            # Extract the MRZ region
            mrz_image = image[y:y + h, x:x + w]
            
            logger.info(f"🎯 Extracted MRZ region: {w}x{h} (padded)")
            
            return mrz_image, (x, y, w, h)
            
        except Exception as e:
            logger.error(f"Error detecting MRZ region: {e}")
            return None, None
    
    def ocr_mrz(self, mrz_image, lang='eng'):
        """
        OCR the extracted MRZ region
        
        Args:
            mrz_image: Extracted MRZ region image
            lang: Tesseract language (default: 'eng')
            
        Returns:
            str: OCR'd MRZ text (cleaned)
        """
        try:
            if mrz_image is None:
                return ""
            
            # Convert to PIL Image for Tesseract
            if len(mrz_image.shape) == 3:
                rgb_image = cv2.cvtColor(mrz_image, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(rgb_image)
            else:
                pil_image = Image.fromarray(mrz_image)
            
            # OCR configuration optimized for MRZ
            # PSM 6: Uniform block of text
            # Whitelist only characters typically found in MRZ
            config = r'--oem 1 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<'
            
            # Extract text
            mrz_text = pytesseract.image_to_string(pil_image, lang=lang, config=config)
            
            # Clean the text - remove spaces and newlines, keep only valid MRZ characters
            mrz_text = mrz_text.replace(" ", "").replace("\n", "").replace("\r", "")
            mrz_text = ''.join(c for c in mrz_text if c.isalnum() or c == '<')
            
            logger.info(f"📄 OCR'd MRZ text ({len(mrz_text)} chars): {mrz_text[:50]}...")
            
            return mrz_text
            
        except Exception as e:
            logger.error(f"Error OCR'ing MRZ: {e}")
            return ""
    
    def detect_all_text_regions(self, image):
        """
        Detect all text regions in the passport using computer vision
        
        Args:
            image: Input passport image (BGR format)
            
        Returns:
            list: List of detected text regions with their locations and types
        """
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            height, width = gray.shape
            
            logger.info(f"🔍 Detecting all text regions in {width}x{height} passport")
            
            # Step 1: Multiple preprocessing approaches for different text types
            processed_images = self._create_processed_variants(gray)
            
            all_text_regions = []
            
            # Step 2: Process each region of the passport
            for region_name, (rel_x, rel_y, rel_w, rel_h) in self.passport_regions.items():
                # Convert relative coordinates to absolute
                x = int(rel_x * width)
                y = int(rel_y * height)
                w = int(rel_w * width)
                h = int(rel_h * height)
                
                logger.debug(f"Processing region '{region_name}': {w}x{h} at ({x},{y})")
                
                # Extract region from original image
                region_image = image[y:y+h, x:x+w]
                region_gray = gray[y:y+h, x:x+w]
                
                # Detect text in this region using appropriate method
                region_texts = self._detect_text_in_region(
                    region_image, region_gray, region_name, (x, y, w, h)
                )
                
                all_text_regions.extend(region_texts)
            
            # Step 3: Also do a global text detection for anything we missed
            global_texts = self._detect_global_text_regions(image, gray)
            all_text_regions.extend(global_texts)
            
            # Step 4: Remove duplicates and filter by quality
            filtered_regions = self._filter_and_deduplicate_regions(all_text_regions)
            
            logger.info(f"✅ Found {len(filtered_regions)} text regions total")
            
            return filtered_regions
            
        except Exception as e:
            logger.error(f"Error detecting text regions: {e}")
            return []
    
    def _create_processed_variants(self, gray):
        """Create different processed versions for different text types"""
        variants = {}
        
        # Variant 1: For clear, high-contrast text (passport numbers, etc.)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        variants['high_contrast'] = clahe.apply(gray)
        
        # Variant 2: For small text (dates, place names, etc.)
        blurred = cv2.GaussianBlur(gray, (1, 1), 0)
        variants['small_text'] = cv2.addWeighted(gray, 1.5, blurred, -0.5, 0)
        
        # Variant 3: For embossed/stamped text
        variants['embossed'] = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, self.text_kernel)
        
        # Variant 4: For printed text (names, etc.)
        variants['printed'] = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, self.text_kernel)
        
        return variants
    
    def _detect_text_in_region(self, region_image, region_gray, region_name, region_coords):
        """Detect text in a specific passport region"""
        try:
            x, y, w, h = region_coords
            text_regions = []
            
            if region_name == 'mrz_section':
                # Use specialized MRZ detection
                mrz_image, mrz_box = self.detect_mrz_region(region_image)
                if mrz_image is not None:
                    mrz_text = self.ocr_mrz(mrz_image)
                    if mrz_text:
                        text_regions.append({
                            'text': mrz_text,
                            'type': 'mrz',
                            'region': region_name,
                            'bbox': (x + mrz_box[0], y + mrz_box[1], mrz_box[2], mrz_box[3]),
                            'confidence': 0.9  # MRZ detection is usually reliable
                        })
                return text_regions
            
            # For other regions, use general text detection
            
            # Method 1: Gradient-based text detection (similar to MRZ method)
            gradient_regions = self._detect_gradient_text_regions(region_gray, region_name)
            
            # Method 2: Contour-based text detection
            contour_regions = self._detect_contour_text_regions(region_gray, region_name)
            
            # Method 3: Edge-based text detection
            edge_regions = self._detect_edge_text_regions(region_gray, region_name)
            
            # Combine all detected regions
            all_regions = gradient_regions + contour_regions + edge_regions
            
            # OCR each detected region
            for region_info in all_regions:
                region_x, region_y, region_w, region_h = region_info['bbox']
                
                # Extract the text region
                text_roi = region_image[region_y:region_y+region_h, region_x:region_x+region_w]
                
                if text_roi.size == 0:
                    continue
                
                # OCR the region
                ocr_text = self._ocr_text_region(text_roi, region_name)
                
                if ocr_text and len(ocr_text.strip()) >= 2:  # Minimum text length
                    text_regions.append({
                        'text': ocr_text.strip(),
                        'type': self._classify_text_type(ocr_text, region_name),
                        'region': region_name,
                        'bbox': (x + region_x, y + region_y, region_w, region_h),
                        'confidence': region_info.get('confidence', 0.7)
                    })
            
            return text_regions
            
        except Exception as e:
            logger.error(f"Error detecting text in region {region_name}: {e}")
            return []
    
    def _detect_gradient_text_regions(self, gray, region_name):
        """Detect text using gradient method (similar to MRZ detection)"""
        try:
            # Apply Gaussian blur
            blurred = cv2.GaussianBlur(gray, (3, 3), 0)
            
            # Blackhat to find dark text on light background
            blackhat = cv2.morphologyEx(blurred, cv2.MORPH_BLACKHAT, self.text_kernel)
            
            # Compute gradient
            grad = cv2.Sobel(blackhat, ddepth=cv2.CV_32F, dx=1, dy=0, ksize=-1)
            grad = np.absolute(grad)
            
            # Normalize
            if grad.max() > grad.min():
                grad = (grad - grad.min()) / (grad.max() - grad.min()) * 255
            grad = grad.astype("uint8")
            
            # Close gaps
            closed = cv2.morphologyEx(grad, cv2.MORPH_CLOSE, self.text_kernel)
            
            # Threshold
            _, thresh = cv2.threshold(closed, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
            
            # Find contours
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            regions = []
            for contour in contours:
                x, y, w, h = cv2.boundingRect(contour)
                
                # Filter by size - text regions should be reasonable size
                if w >= 20 and h >= 8 and w <= gray.shape[1] * 0.8 and h <= gray.shape[0] * 0.3:
                    aspect_ratio = w / float(h)
                    if 1.5 <= aspect_ratio <= 15:  # Text has horizontal aspect ratio
                        regions.append({
                            'bbox': (x, y, w, h),
                            'confidence': 0.7,
                            'method': 'gradient'
                        })
            
            return regions
            
        except Exception as e:
            logger.debug(f"Gradient text detection failed for {region_name}: {e}")
            return []
    
    def _detect_contour_text_regions(self, gray, region_name):
        """Detect text using contour-based method"""
        try:
            # Adaptive threshold for varying lighting
            adaptive = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                           cv2.THRESH_BINARY, 11, 2)
            
            # Morphological operations to connect text
            connected = cv2.morphologyEx(adaptive, cv2.MORPH_CLOSE, self.small_kernel)
            
            # Find contours
            contours, _ = cv2.findContours(connected, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            regions = []
            for contour in contours:
                x, y, w, h = cv2.boundingRect(contour)
                
                # Filter contours that look like text
                if w >= 15 and h >= 6 and w <= gray.shape[1] * 0.7:
                    area = cv2.contourArea(contour)
                    bbox_area = w * h
                    
                    # Text contours should fill most of their bounding box
                    if area / bbox_area >= 0.3:
                        regions.append({
                            'bbox': (x, y, w, h),
                            'confidence': 0.6,
                            'method': 'contour'
                        })
            
            return regions
            
        except Exception as e:
            logger.debug(f"Contour text detection failed for {region_name}: {e}")
            return []
    
    def _detect_edge_text_regions(self, gray, region_name):
        """Detect text using edge detection"""
        try:
            # Canny edge detection
            edges = cv2.Canny(gray, 50, 150, apertureSize=3)
            
            # Dilate edges to connect nearby edges
            dilated = cv2.dilate(edges, self.small_kernel, iterations=1)
            
            # Find contours
            contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            regions = []
            for contour in contours:
                x, y, w, h = cv2.boundingRect(contour)
                
                # Text regions from edges should be horizontal and reasonable size
                if w >= 25 and h >= 8 and w <= gray.shape[1] * 0.6:
                    aspect_ratio = w / float(h)
                    if 2 <= aspect_ratio <= 10:
                        regions.append({
                            'bbox': (x, y, w, h),
                            'confidence': 0.5,
                            'method': 'edge'
                        })
            
            return regions
            
        except Exception as e:
            logger.debug(f"Edge text detection failed for {region_name}: {e}")
            return []
    
    def _detect_global_text_regions(self, image, gray):
        """Global text detection to catch anything missed by regional detection"""
        try:
            # Use MSER (Maximally Stable Extremal Regions) for robust text detection
            mser = cv2.MSER_create()
            regions, _ = mser.detectRegions(gray)
            
            text_regions = []
            for region in regions:
                # Get bounding box of MSER region
                x, y, w, h = cv2.boundingRect(region.reshape(-1, 1, 2))
                
                # Filter by size and aspect ratio
                if w >= 20 and h >= 8 and w <= gray.shape[1] * 0.8:
                    aspect_ratio = w / float(h)
                    if 1.2 <= aspect_ratio <= 12:
                        # Extract and OCR the region
                        text_roi = image[y:y+h, x:x+w]
                        ocr_text = self._ocr_text_region(text_roi, 'global')
                        
                        if ocr_text and len(ocr_text.strip()) >= 2:
                            text_regions.append({
                                'text': ocr_text.strip(),
                                'type': self._classify_text_type(ocr_text, 'global'),
                                'region': 'global',
                                'bbox': (x, y, w, h),
                                'confidence': 0.6
                            })
            
            return text_regions
            
        except Exception as e:
            logger.debug(f"Global text detection failed: {e}")
            return []
    
    def _ocr_text_region(self, text_roi, region_name):
        """OCR a specific text region with appropriate configuration"""
        try:
            if text_roi.size == 0:
                return ""
            
            # Convert to PIL Image
            if len(text_roi.shape) == 3:
                rgb_image = cv2.cvtColor(text_roi, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(rgb_image)
            else:
                pil_image = Image.fromarray(text_roi)
            
            # Different OCR configs for different regions
            if region_name in ['upper_right', 'mrz_section']:
                # For passport numbers and MRZ - restrict to alphanumeric and <
                config = r'--oem 1 --psm 8 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<'
            elif region_name in ['middle_section', 'lower_section']:
                # For dates and places - include slashes and common punctuation
                config = r'--oem 1 --psm 8 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/.,- '
            else:
                # For names and general text - allow full character set
                config = r'--oem 1 --psm 8'
            
            # OCR the region
            text = pytesseract.image_to_string(pil_image, config=config)
            
            # Basic cleaning
            text = text.strip().replace('\n', ' ').replace('\r', ' ')
            text = ' '.join(text.split())  # Normalize whitespace
            
            return text
            
        except Exception as e:
            logger.debug(f"OCR failed for region {region_name}: {e}")
            return ""
    
    def _classify_text_type(self, text, region_name):
        """Classify what type of information the text represents"""
        text_upper = text.upper().strip()
        
        # Passport number patterns
        if region_name == 'upper_right' and len(text) >= 6:
            if any(c.isdigit() for c in text) and any(c.isalpha() for c in text):
                return 'passport_number'
        
        # Date patterns
        if any(pattern in text for pattern in ['/', '19', '20', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                                               'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']):
            return 'date'
        
        # Place names
        if region_name in ['middle_section', 'lower_section'] and len(text) >= 3:
            # Common place indicators
            place_indicators = ['PLACE', 'BORN', 'BIRTH', 'ISSUED', 'VALID', 'UNTIL']
            if any(indicator in text_upper for indicator in place_indicators):
                return 'place_info'
        
        # Names (typically in upper left, all caps, letters only)
        if region_name == 'upper_left' and text.isupper() and text.replace(' ', '').isalpha():
            if len(text) >= 3:
                return 'name'
        
        # Country codes
        if len(text) == 3 and text.isupper() and text.isalpha():
            return 'country_code'
        
        # Sex indicators
        if text_upper in ['M', 'F', 'MALE', 'FEMALE']:
            return 'sex'
        
        # MRZ text
        if '<' in text or (len(text) > 20 and text.replace('<', '').replace(' ', '').isalnum()):
            return 'mrz'
        
        return 'general_text'
    
    def _filter_and_deduplicate_regions(self, text_regions):
        """Remove duplicates and filter out low-quality detections"""
        if not text_regions:
            return []
        
        # Sort by confidence
        text_regions.sort(key=lambda x: x['confidence'], reverse=True)
        
        filtered = []
        
        for region in text_regions:
            # Skip very short text
            if len(region['text'].strip()) < 2:
                continue
            
            # Check for duplicates (same text or overlapping regions)
            is_duplicate = False
            for existing in filtered:
                # Same text
                if region['text'].strip() == existing['text'].strip():
                    is_duplicate = True
                    break
                
                # Overlapping bounding boxes
                if self._boxes_overlap(region['bbox'], existing['bbox'], overlap_threshold=0.7):
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                filtered.append(region)
        
        return filtered
    
    def _boxes_overlap(self, box1, box2, overlap_threshold=0.5):
        """Check if two bounding boxes overlap significantly"""
        x1, y1, w1, h1 = box1
        x2, y2, w2, h2 = box2
        
        # Calculate overlap area
        left = max(x1, x2)
        top = max(y1, y2)
        right = min(x1 + w1, x2 + w2)
        bottom = min(y1 + h1, y2 + h2)
        
        if left < right and top < bottom:
            overlap_area = (right - left) * (bottom - top)
            box1_area = w1 * h1
            box2_area = w2 * h2
            
            # Calculate overlap ratio
            min_area = min(box1_area, box2_area)
            overlap_ratio = overlap_area / min_area
            
            return overlap_ratio >= overlap_threshold
        
        return False
    
    def process_passport(self, image, lang='eng'):
        """
        Complete pipeline: detect ALL passport information using computer vision
        
        Args:
            image: Input passport image
            lang: Tesseract language
            
        Returns:
            dict: Results containing all detected passport information
        """
        try:
            logger.info("🛂 Starting comprehensive passport processing")
            
            # Detect ALL text regions in the passport
            all_text_regions = self.detect_all_text_regions(image)
            
            if not all_text_regions:
                return {
                    "success": False,
                    "error": "No text regions found in passport",
                    "all_text": [],
                    "organized_data": {}
                }
            
            # Organize the detected text by type
            organized_data = self._organize_passport_data(all_text_regions)
            
            # Extract MRZ specifically for format analysis
            mrz_info = {}
            mrz_regions = [r for r in all_text_regions if r['type'] == 'mrz']
            if mrz_regions:
                mrz_text = mrz_regions[0]['text']  # Take the first/best MRZ
                mrz_info = self.analyze_mrz_format(mrz_text)
            
            logger.info(f"✅ Extracted {len(all_text_regions)} text regions from passport")
            logger.info(f"📊 Found: {len(organized_data)} different data types")
            
            return {
                "success": True,
                "all_text": all_text_regions,
                "organized_data": organized_data,
                "mrz_info": mrz_info,
                "total_regions": len(all_text_regions),
                "data_types_found": list(organized_data.keys())
            }
            
        except Exception as e:
            logger.error(f"Error processing passport: {e}")
            return {
                "success": False,
                "error": str(e),
                "all_text": [],
                "organized_data": {}
            }
    
    def _organize_passport_data(self, text_regions):
        """
        Organize detected text regions by type for easy access
        
        Args:
            text_regions: List of detected text regions
            
        Returns:
            dict: Organized passport data by type
        """
        organized = {}
        
        for region in text_regions:
            text_type = region['type']
            
            if text_type not in organized:
                organized[text_type] = []
            
            organized[text_type].append({
                'text': region['text'],
                'confidence': region['confidence'],
                'region': region['region'],
                'bbox': region['bbox']
            })
        
        # Sort each type by confidence (highest first)
        for text_type in organized:
            organized[text_type].sort(key=lambda x: x['confidence'], reverse=True)
        
        return organized
    
    def analyze_mrz_format(self, mrz_text):
        """
        Analyze MRZ text to determine passport type and extract info
        
        Args:
            mrz_text: Raw MRZ text string
            
        Returns:
            dict: Analysis results
        """
        try:
            if not mrz_text:
                return {"type": "unknown", "lines": 0}
            
            # Split into lines based on typical MRZ lengths
            lines = []
            
            # Type 3 passport: 2 lines of 44 characters each
            if len(mrz_text) >= 88:
                lines = [mrz_text[0:44], mrz_text[44:88]]
                passport_type = "Type 3 (2 lines x 44 chars)"
            
            # Type 1 passport: 3 lines of 30 characters each  
            elif len(mrz_text) >= 90:
                lines = [mrz_text[0:30], mrz_text[30:60], mrz_text[60:90]]
                passport_type = "Type 1 (3 lines x 30 chars)"
            
            else:
                # Partial or damaged MRZ
                passport_type = f"Partial/Unknown ({len(mrz_text)} chars)"
                # Try to split every 30 or 44 characters
                if len(mrz_text) > 44:
                    lines = [mrz_text[i:i+44] for i in range(0, len(mrz_text), 44)]
                elif len(mrz_text) > 30:
                    lines = [mrz_text[i:i+30] for i in range(0, len(mrz_text), 30)]
                else:
                    lines = [mrz_text]
            
            return {
                "type": passport_type,
                "lines": len(lines),
                "line_data": lines,
                "total_chars": len(mrz_text)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing MRZ format: {e}")
            return {"type": "error", "lines": 0}

# Command line interface for testing
def main():
    """Test the MRZ detector on an image file"""
    import sys
    
    if len(sys.argv) != 2:
        print("Usage: python passport_mrz_detector.py <passport_image>")
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    # Load image
    image = cv2.imread(image_path)
    if image is None:
        print(f"❌ Could not load image: {image_path}")
        sys.exit(1)
    
    print(f"🔍 Processing passport: {image_path}")
    
    # Initialize detector
    detector = PassportMRZDetector()
    
    # Process passport
    result = detector.process_passport(image)
    
    if result["success"]:
        print(f"✅ Success!")
        print(f"📄 MRZ Text: {result['mrz_text']}")
        print(f"📊 Format: {result['mrz_info']['type']}")
        print(f"📏 Length: {result['mrz_length']} characters")
        
        if result['mrz_info']['line_data']:
            print(f"📋 MRZ Lines:")
            for i, line in enumerate(result['mrz_info']['line_data'], 1):
                print(f"   Line {i}: {line}")
                
        # Show the extracted MRZ region
        mrz_region, mrz_box = detector.detect_mrz_region(image)
        if mrz_region is not None:
            cv2.imshow("Original", image)
            cv2.imshow("MRZ Region", mrz_region)
            cv2.waitKey(0)
            cv2.destroyAllWindows()
    else:
        print(f"❌ Failed: {result['error']}")

if __name__ == "__main__":
    main()