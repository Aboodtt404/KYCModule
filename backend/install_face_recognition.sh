#!/bin/bash

echo "Installing face recognition dependencies for OCR server..."

# Install PyTorch with CPU support (adjust for your system)
pip install torch==2.0.1 torchvision==0.15.2 --index-url https://download.pytorch.org/whl/cpu

# Install face recognition library
pip install facenet-pytorch==2.5.3

# Install other dependencies
pip install -r requirements.txt

echo "Face recognition dependencies installed successfully!"
echo "You can now run the OCR server with face verification capabilities."
