#!/usr/bin/env python3
"""pp_service.py — PaddleOCR sidecar (port 5001).

Paddle must live in its own process: loading it next to TensorFlow (deepface) and
torch (EasyOCR) inside server.py mixes three bundled CUDA/OpenMP runtimes — GPU init
segfaults and even CPU init deadlocks. Alone in this process it runs cleanly on GPU.

API:
  GET  /health          → {"ok": true, "device": "gpu:0"}
  POST /read            → {"text": "..."}   body: {"field": "firstName|lastName|address",
                                                   "image": "<base64 JPEG/PNG>"}
"""
from __future__ import annotations

import base64
import logging

import cv2
import numpy as np
from flask import Flask, jsonify, request

import pp_reader

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = Flask(__name__)


@app.get("/health")
def health():
    return jsonify({"ok": pp_reader.available(), "device": getattr(pp_reader, "_device", None)})


@app.post("/read")
def read():
    data = request.get_json(silent=True) or {}
    field = data.get("field", "address")
    b64 = data.get("image")
    if not b64:
        return jsonify({"error": "image required"}), 400
    arr = np.frombuffer(base64.b64decode(b64), np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return jsonify({"error": "bad image"}), 400
    try:
        return jsonify({"text": pp_reader.read_field(img, field)})
    except Exception as e:
        log.exception("read failed")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    ok = pp_reader.init()
    log.info("pp_service starting — reader %s", "ACTIVE" if ok else "UNAVAILABLE")
    app.run(host="127.0.0.1", port=5001, debug=False, threaded=True)
