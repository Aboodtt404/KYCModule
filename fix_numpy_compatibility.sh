#!/bin/bash

echo "🔧 Fixing NumPy compatibility issue..."

# Downgrade NumPy to compatible version
echo "📦 Downgrading NumPy to version < 2.0.0..."
pip install "numpy<2.0.0" --force-reinstall

# Reinstall face recognition dependencies
echo "📦 Installing face recognition dependencies..."
pip install torch==2.0.1 torchvision==0.15.2 --index-url https://download.pytorch.org/whl/cpu
pip install facenet-pytorch==2.5.3

# Reinstall other dependencies that might be affected
echo "📦 Reinstalling other dependencies..."
pip install -r requirements.txt --force-reinstall

echo "✅ NumPy compatibility fix complete!"
echo "🚀 You can now restart the OCR server with face recognition support."
