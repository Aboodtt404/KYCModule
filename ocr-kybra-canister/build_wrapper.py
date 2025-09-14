#!/usr/bin/env python3
"""
Wrapper script to increase recursion limit before running Kybra build
"""
import sys
import os
import subprocess

# Increase recursion limit significantly
sys.setrecursionlimit(50000)

# Change to the canister directory
os.chdir('/home/tete404/KYCModule/ocr-kybra-canister')

# Run the kybra build command
try:
    result = subprocess.run([
        sys.executable, '-m', 'kybra', 'ocr_canister', 'src/main.py'
    ], capture_output=False, text=True)
    sys.exit(result.returncode)
except Exception as e:
    print(f"Error running kybra build: {e}")
    sys.exit(1)
