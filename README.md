# KYC Module - Document Verification System

A comprehensive Know Your Customer (KYC) document verification system that uses advanced OCR (Optical Character Recognition) technology to extract and validate information from identity documents.

## Features

### 🔍 Document Processing
- **Egyptian ID Card OCR**: AI-powered extraction using YOLO object detection and EasyOCR
- **Passport OCR**: Machine Readable Zone (MRZ) extraction with international country code mapping
- **Image Preprocessing**: Auto-rotation, contrast enhancement, and noise reduction
- **Debug Visualization**: Comprehensive debug images and processing logs

### 📋 Extracted Information

#### Egyptian ID Cards
- Full Name (First Name, Second Name)
- National ID Number
- Date of Birth
- Gender
- Address
- Governorate
- Serial Number

#### Passports
- Surname and Given Name
- Passport Number and Type
- Date of Birth and Expiration Date
- Sex and Nationality
- Issuing Country
- Personal Number (when available)

### 🛠️ Technology Stack

#### Backend
- **Python Flask**: RESTful API server
- **YOLO**: Object detection for field localization
- **EasyOCR**: Text extraction and recognition
- **PassportEye**: MRZ detection and parsing
- **OpenCV**: Image processing and enhancement
- **SciPy**: Advanced image transformations

#### Frontend
- **React**: Modern user interface
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Professional styling
- **Lucide Icons**: Clean iconography

## Project Structure

```
KYCModule/
├── backend/                 # Python Flask API server
│   ├── egyptian_ocr_id.py  # Egyptian ID processing
│   ├── passport_ocr.py     # Passport processing
│   ├── ocr_server.py       # Flask API endpoints
│   ├── models/             # AI models and data
│   │   ├── detect_odjects.pt    # YOLO field detection
│   │   ├── detect_id_card.pt    # YOLO ID card detection
│   │   └── country_codes.json   # International country codes
│   └── debug_images/       # Processing debug outputs
├── frontend/               # React TypeScript application
│   ├── OCRProcessor.tsx    # Main OCR interface
│   ├── Structureddisplay.tsx # Results display
│   └── DocumentUploadPlusProcessing.tsx # Document upload
└── passport_ocr/          # Original passport OCR reference
```

## API Endpoints

- `POST /egyptian-id` - Process Egyptian ID card images
- `POST /passport` - Process passport images
- `GET /debug-image/<filename>` - Serve debug images
- `GET /health` - Health check
- `GET /info` - Server information

## Getting Started

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python3 ocr_server.py
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Usage
1. Start the backend server (default: http://localhost:5000)
2. Start the frontend development server (default: http://localhost:3000)
3. Upload document images through the web interface
4. View extracted information and debug data

## Advanced Features

### Image Preprocessing
- **Auto-rotation**: Tests 0°, 90°, 180°, 270° orientations and selects the best
- **Field Detection Scoring**: Uses YOLO confidence scores to determine optimal orientation
- **Padding Optimization**: Intelligent cropping with padding to ensure all fields are captured

### Debug Capabilities
- Preprocessed image visualization
- Field detection bounding boxes
- Confidence scores for each detected field
- MRZ region of interest extraction
- Processing time metrics

## Contributing

This project uses modern development practices with comprehensive error handling, logging, and debugging capabilities. The OCR processing pipeline is designed for production use with robust validation and fallback mechanisms.

## License

This project is designed for KYC compliance and document verification applications.
