# KYC Module

A document verification system that extracts information from Egyptian ID cards and passports using OCR technology.

## Features

- Egyptian ID Card processing
- Passport processing
- Web interface for document upload

## Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
python3 ocr_server.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Usage

1. Start backend server (http://localhost:5000)
2. Start frontend server (http://localhost:3000)
3. Upload documents through the web interface
