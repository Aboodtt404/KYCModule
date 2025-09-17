#!/usr/bin/env python3
"""
Test script for face verification integration
"""

import requests
import base64
import json

# Configuration
OCR_SERVER_URL = "http://194.31.150.154:5000"  # Your cloud server URL
TEST_IMAGE_PATH = "test_id.jpg"  # Path to a test ID image

def test_ocr_with_face_extraction():
    """Test OCR endpoint with face extraction"""
    print("🧪 Testing OCR with face extraction...")
    
    try:
        with open(TEST_IMAGE_PATH, 'rb') as f:
            image_data = f.read()
        
        response = requests.post(
            f"{OCR_SERVER_URL}/egyptian-id",
            data=image_data,
            headers={'Content-Type': 'application/octet-stream'}
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ OCR processing successful!")
            print(f"📊 Processing time: {result.get('processing_time', 'N/A')}s")
            
            # Check if face was detected
            face_verification = result.get('face_verification', {})
            if face_verification.get('face_detected'):
                print("✅ Face detected and extracted!")
                print(f"📸 Face image size: {len(face_verification.get('face_image', ''))} characters")
            else:
                print("❌ No face detected")
                print(f"🔍 Error: {face_verification.get('face_error', 'Unknown')}")
            
            # Show extracted data
            extracted_data = result.get('extracted_data', {})
            print("\n📋 Extracted Information:")
            for key, value in extracted_data.items():
                print(f"  {key}: {value}")
                
        else:
            print(f"❌ OCR request failed: {response.status_code}")
            print(f"Error: {response.text}")
            
    except FileNotFoundError:
        print(f"❌ Test image not found: {TEST_IMAGE_PATH}")
        print("Please provide a test ID image")
    except Exception as e:
        print(f"❌ Error: {e}")

def test_face_verification():
    """Test face verification endpoint"""
    print("\n🧪 Testing face verification...")
    
    # This would require two images - ID face and selfie
    # For now, just test the endpoint structure
    test_data = {
        "id_image": "dummy_base64_id_face",
        "live_image": "dummy_base64_selfie"
    }
    
    try:
        response = requests.post(
            f"{OCR_SERVER_URL}/verify-face",
            json=test_data,
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code == 200:
            print("✅ Face verification endpoint is working!")
        elif response.status_code == 400:
            print("✅ Face verification endpoint is working (expected error for dummy data)")
        else:
            print(f"❌ Face verification failed: {response.status_code}")
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing face verification: {e}")

def test_health_check():
    """Test server health"""
    print("🧪 Testing server health...")
    
    try:
        response = requests.get(f"{OCR_SERVER_URL}/health")
        
        if response.status_code == 200:
            health = response.json()
            print("✅ Server is healthy!")
            print(f"📊 Services: {health.get('services', {})}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error checking health: {e}")

if __name__ == "__main__":
    print("🚀 Testing Face Verification Integration")
    print("=" * 50)
    
    test_health_check()
    test_ocr_with_face_extraction()
    test_face_verification()
    
    print("\n" + "=" * 50)
    print("✅ Testing complete!")
    print("\n📝 Next steps:")
    print("1. Deploy updated OCR server to cloud")
    print("2. Update frontend OCR_SERVER_URL")
    print("3. Test the complete KYC flow")
