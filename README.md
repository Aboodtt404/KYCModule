# KYC Module

A Know Your Customer (KYC) verification system with Egyptian ID and passport OCR processing, face recognition, and identity verification.

## Quick Start

### Prerequisites

- Node.js 18+
- DFX (Internet Computer SDK)

### 1. Frontend Setup

```bash
cd frontend
npm install
npm run build
```

### 2. Deploy to Internet Computer

```bash
dfx start --background
dfx deploy
```

### 3. Access the Application

Open your browser and navigate to the deployed canister URL.

## Project Structure

```
KYCModule/
├── backend/           # Python OCR server
│   ├── ocr_server.py  # Flask API server
│   ├── egyptian_ocr_id.py  # Egyptian ID processing
│   └── passport_ocr.py     # Passport processing
├── frontend/          # React frontend
│   └── src/
│       ├── components/kyc/  # KYC components
│       └── pages/user/      # User pages
└── README.md
```

## Testing

1. Upload an Egyptian ID or passport image
2. Review extracted information
3. Take a selfie for identity verification
4. Edit information if needed
5. Submit for verification

## Troubleshooting

- **Frontend Build Errors**: Run `npm install` and check Node.js version
- **DFX Deployment**: Ensure DFX is properly installed and IC network is accessible
- **OCR Processing**: Ensure the cloud OCR server is accessible and running

## Requirements

### Frontend
- React 18
- TypeScript
- Tailwind CSS
- Framer Motion

### Cloud OCR Server
- Flask
- OpenCV
- EasyOCR
- YOLO
- Face Recognition