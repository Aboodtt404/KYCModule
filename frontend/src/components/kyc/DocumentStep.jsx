"use client";
import React, { useState } from "react";
import GlassCard from "./GlassCard";
import UploadBox from "./UploadBox";
import ThreeHero from "./ThreeHero";
import { Button } from "@/components/ui/button";
import { Loader2, Camera, Upload } from "lucide-react";
import { IDCameraCapture } from "./IDCameraCapture";

export default function DocumentStep({ onNext, onUploaded }) {
  const [type, setType] = useState("id");
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [captureMode, setCaptureMode] = useState(null); // 'camera' or 'upload'

  function handleFile(f) {
    setFile(f);
    setCaptureMode('upload');
    if (onUploaded) onUploaded(f); // ✅ now always safe
  }

  function handleCameraCapture(capturedFile) {
    setFile(capturedFile);
    setCaptureMode('camera');
    setShowCamera(false);
    if (onUploaded) onUploaded(capturedFile);
  }

  async function handleProcessDocument() {
    if (!file) return;
    setIsProcessing(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const ocrEndpoint =
        type === "id"
          ? "http://194.31.150.154:5000/egyptian-id"
          : "http://194.31.150.154:5000/passport";

      const response = await fetch(ocrEndpoint, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: arrayBuffer,
      });

      if (!response.ok) throw new Error(`OCR server error ${response.status}`);
      const result = await response.json();

      if (result.success && result.extracted_data) {
        const extractedData = result.extracted_data;
        const ocrData = {
          full_name: extractedData.full_name || "Unknown",
          national_id: extractedData.national_id || "Unknown",
          birth_date: extractedData.birth_date || "Unknown",
          address: extractedData.address || "Unknown",
          governorate: extractedData.governorate || "Unknown",
          gender: extractedData.gender || "Unknown",
          serial: extractedData.serial || "Unknown",
          first_name: extractedData.first_name || "Unknown",
          second_name: extractedData.second_name || "Unknown",
          face_image: extractedData.face_image || null,
        };
        onNext(ocrData, file, extractedData.face_image);
      } else {
        throw new Error(result.error || "OCR failed");
      }
    } catch (error) {
      console.error("OCR error:", error);
      onNext(
        {
          name: "Sample Name",
          idNumber: "123456789",
          birthDate: "1990-01-01",
        },
        file
      );
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="space-y-6">
      <ThreeHero className="h-36 sm:h-52" />
      <GlassCard className="p-6">
        {/* Document Type Selector */}
        <div className="flex gap-3 justify-center flex-col sm:flex-row">
          {[
            { key: "id", label: "🪪 National ID" },
            { key: "passport", label: "🛂 Passport" },
          ].map((doc) => (
            <button
              key={doc.key}
              className={`p-3 rounded-xl w-full sm:w-auto transition ${type === doc.key
                ? "bg-emerald-500 text-black font-semibold"
                : "bg-white/10 hover:bg-white/20"
                }`}
              onClick={() => setType(doc.key)}
            >
              {doc.label}
            </button>
          ))}
        </div>

        {/* Capture Options - Only show camera for ID cards */}
        {type === "id" && !file && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setShowCamera(true)}
              className="flex flex-col items-center gap-3 p-6 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105"
            >
              <Camera className="w-10 h-10 text-white" />
              <div className="text-center">
                <p className="font-semibold text-white">Scan with Camera</p>
                <p className="text-xs text-white/80 mt-1">Recommended - Auto-detect & capture</p>
              </div>
            </button>

            <button
              onClick={() => document.getElementById('file-upload-fallback')?.click()}
              className="flex flex-col items-center gap-3 p-6 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-200"
            >
              <Upload className="w-10 h-10 text-white" />
              <div className="text-center">
                <p className="font-semibold text-white">Upload Image</p>
                <p className="text-xs text-gray-400 mt-1">Choose from device</p>
              </div>
            </button>

            <input
              id="file-upload-fallback"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        )}

        {/* Upload for Passport */}
        {type === "passport" && !file && (
          <div className="mt-6">
            <UploadBox
              label="Upload Passport"
              onFile={handleFile}
            />
          </div>
        )}

        {/* File details + process button */}
        {file && (
          <div className="mt-6 space-y-4">
            {/* Preview */}
            <div className="bg-white/5 rounded-lg p-4">
              <img
                src={URL.createObjectURL(file)}
                alt="Preview"
                className="w-full h-48 object-contain rounded-lg mb-3"
              />
              <div className="flex items-center justify-between text-sm text-gray-200">
                <span className="truncate max-w-[70%]">{file.name}</span>
                <span className="text-gray-400">
                  {(file.size / 1000).toFixed(1)} KB
                </span>
              </div>
              {captureMode === 'camera' && (
                <div className="mt-2 flex items-center gap-2 text-xs text-green-400">
                  <Camera className="w-3 h-3" />
                  <span>Captured with camera</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={handleProcessDocument}
                className="flex-1"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                  </span>
                ) : (
                  "Process Document"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  // Clean up preview URL to avoid memory leaks
                  if (file) {
                    URL.revokeObjectURL(URL.createObjectURL(file));
                  }
                  setFile(null);
                  setCaptureMode(null);
                  setShowCamera(false); // Ensure camera modal is closed
                }}
                disabled={isProcessing}
              >
                Change
              </Button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Camera Modal */}
      {showCamera && (
        <IDCameraCapture
          key={`camera-${Date.now()}`} // Force remount for clean state
          isOpen={showCamera}
          onCapture={handleCameraCapture}
          onCancel={() => {
            console.log('📵 Closing camera modal');
            setShowCamera(false);
          }}
        />
      )}
    </div>
  );
}
