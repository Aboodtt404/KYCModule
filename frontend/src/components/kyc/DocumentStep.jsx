"use client";
import React, { useState, useEffect } from "react";
import GlassCard from "./GlassCard";
import UploadBox from "./UploadBox";
import ThreeHero from "./ThreeHero";
import { Button } from "@/components/ui/button";
import { Loader2, Camera, Upload } from "lucide-react";
import { IDCameraCapture } from "./IDCameraCapture";
import { useCheckDuplicateId } from "../../hooks/useQueries";

export default function DocumentStep({ submissionId, onNext, onUploaded, onReset }) {
  const [type, setType] = useState("id");
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [captureMode, setCaptureMode] = useState(null); // 'camera' or 'upload'
  const [validationError, setValidationError] = useState(null);
  const checkDuplicateId = useCheckDuplicateId();

  // Cleanup effect to ensure camera is off when component unmounts
  useEffect(() => {
    return () => {
      if (showCamera) {
        setShowCamera(false);
      }
    };
  }, [showCamera]);

  function handleFile(f) {
    setFile(f);
    setCaptureMode('upload');
    setValidationError(null); // Clear error on new file
    if (onUploaded) onUploaded(f); // ✅ now always safe
  }

  function handleCameraCapture(capturedFile) {
    setFile(capturedFile);
    setCaptureMode('camera');
    setShowCamera(false);
    setValidationError(null); // Clear error on new capture
    if (onUploaded) onUploaded(capturedFile);
  }

  // Validate extracted data for Unknown fields
  function validateOCRData(ocrData, docType) {
    const criticalFields = docType === "id" 
      ? ["full_name", "national_id", "birth_date"]
      : ["full_name", "birth_date"];
    
    const unknownFields = criticalFields.filter(
      field => !ocrData[field] || ocrData[field] === "Unknown" || ocrData[field].trim() === ""
    );

    return {
      isValid: unknownFields.length === 0,
      unknownFields
    };
  }

  async function handleProcessDocument() {
    if (!file) return;
    setIsProcessing(true);
    setValidationError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const OCR_SERVER_URL = process.env.VITE_OCR_SERVER_URL || 'https://194.31.150.154:5000';
      const ocrEndpoint =
        type === "id"
          ? `${OCR_SERVER_URL}/egyptian-id`
          : `${OCR_SERVER_URL}/passport`;

      const response = await fetch(ocrEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "image/jpeg",
          "X-Submission-ID": submissionId, // Pass submission ID
        },
        body: arrayBuffer,
        signal: AbortSignal.timeout(60000), // 60 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OCR server error ${response.status}: ${errorText || 'Server returned an error'}`);
      }
      
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

        // Validate the extracted data
        const validation = validateOCRData(ocrData, type);
        
        if (!validation.isValid) {
          // Force retry if critical fields are Unknown
          const fieldNames = validation.unknownFields
            .map(f => f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
            .join(', ');
          
          setValidationError(
            `Could not read: ${fieldNames}. Please retake the ${type === "id" ? "ID" : "passport"} photo with better lighting and clarity.`
          );
          setIsProcessing(false);
          return;
        }

        if (ocrData.national_id && ocrData.national_id !== "Unknown") {
          const isDuplicate = await checkDuplicateId.mutateAsync(ocrData.national_id);
          if (isDuplicate) {
            setValidationError(
              "This National ID has already been submitted. Please wait for verification."
            );
            setTimeout(() => {
              onReset();
            }, 3000); // Redirect after 3 seconds
            setIsProcessing(false);
            return;
          }
        }

        // All critical fields are valid, proceed
        onNext(ocrData, file, extractedData.face_image);
      } else {
        throw new Error(result.error || "OCR failed");
      }
    } catch (error) {
      console.error("OCR error:", error);
      
      // Provide specific error messages based on error type
      let errorMessage = `Failed to process ${type === "id" ? "ID" : "passport"}. `;
      
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        errorMessage += "Request timed out. The server may be slow or unresponsive. Please try again.";
      } else if (error.message?.includes('Failed to fetch')) {
        // Check if it's a certificate error
        if (window.location.protocol === 'https:') {
          errorMessage += "SSL Certificate error. Please visit the OCR server URL directly in your browser and accept the security certificate, then try again.";
        } else {
          errorMessage += "Cannot connect to the OCR server. Please check if the server is running and try again.";
        }
      } else if (error.message?.includes('ERR_CONNECTION_RESET') || error.message?.includes('ERR_CONNECTION_REFUSED')) {
        errorMessage += "Cannot connect to the OCR server. Please check if the server is running and try again.";
      } else if (error.message?.includes('network')) {
        errorMessage += "Network error. Please check your internet connection and try again.";
      } else {
        errorMessage += error.message || "Please ensure the image is clear and try again.";
      }
      
      setValidationError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Remove ThreeHero on mobile for better space usage */}
      <div className="hidden sm:block">
        <ThreeHero className="h-36 md:h-52" />
      </div>
      <GlassCard className="p-3 sm:p-6">
        {/* Validation Error Display */}
        {validationError && (
          <div className="mb-3 p-2.5 bg-red-500/20 border border-red-500 rounded-lg text-red-200">
            <p className="font-semibold text-xs">⚠️ Validation Failed</p>
            <p className="text-[11px] mt-0.5">{validationError}</p>
          </div>
        )}

        {/* Document Type Selector */}
        <div className="flex gap-2 justify-center">
          {[
            { key: "id", label: "🪪 National ID" },
            { key: "passport", label: "🛂 Passport" },
          ].map((doc) => (
            <button
              key={doc.key}
              className={`flex-1 p-2.5 sm:p-3 rounded-lg transition text-xs sm:text-sm font-medium touch-manipulation min-h-[40px] flex items-center justify-center ${type === doc.key
                ? "bg-emerald-500 text-black font-semibold shadow-lg active:bg-emerald-600"
                : "bg-white/10 active:bg-white/20 text-white"
                }`}
              onClick={() => setType(doc.key)}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {doc.label}
            </button>
          ))}
        </div>

        {/* Camera Capture Button - Unified */}
        {!file && (
          <div className="mt-4">
            <button
              onClick={() => setShowCamera(true)}
              className={`w-full py-4 sm:py-5 rounded-xl text-sm sm:text-base font-bold bg-gradient-to-br shadow-lg active:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 sm:gap-3 touch-manipulation min-h-[48px] ${
                type === "id"
                  ? "from-blue-500 to-blue-600 active:from-blue-600 active:to-blue-700"
                  : "from-purple-500 to-purple-600 active:from-purple-600 active:to-purple-700"
              } text-white`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Camera className="w-5 h-5 sm:w-6 sm:h-7 flex-shrink-0" />
              <div className="text-left flex-shrink min-w-0">
                <div className="text-xs sm:text-sm md:text-base">Capture {type === "id" ? "ID Card" : "Passport"}</div>
                <div className="text-[10px] sm:text-[11px] font-normal text-white/90">Tap to open camera</div>
              </div>
            </button>
          </div>
        )}

        {/* File details + process button */}
        {file && (
          <div className="mt-4 space-y-3">
            {/* Preview - Compact */}
            <div className="bg-white/5 rounded-lg p-2.5">
              <img
                src={URL.createObjectURL(file)}
                alt="Preview"
                className="w-full h-36 object-contain rounded-lg mb-2"
              />
              <div className="flex items-center justify-between text-[11px] text-gray-200">
                <span className="truncate max-w-[70%]">{file.name}</span>
                <span className="text-gray-400">
                  {(file.size / 1000).toFixed(1)} KB
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-green-400">
                  <Camera className="w-3 h-3" />
                  <span>Captured with camera</span>
                </div>
            </div>

            {/* Actions - Mobile Optimized */}
            <div className="flex gap-2">
              <button
                onClick={handleProcessDocument}
                disabled={isProcessing}
                className="flex-1 py-3 sm:py-4 bg-emerald-500 active:bg-emerald-600 disabled:bg-gray-600 text-white rounded-lg font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-lg touch-manipulation min-h-[44px]"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  "Process Document"
                )}
              </button>
              <button
                onClick={() => {
                  if (file) {
                    URL.revokeObjectURL(URL.createObjectURL(file));
                  }
                  setFile(null);
                  setCaptureMode(null);
                  setShowCamera(false);
                }}
                disabled={isProcessing}
                className="px-4 sm:px-5 py-3 sm:py-4 bg-white/10 active:bg-white/20 disabled:bg-gray-600 text-white rounded-lg font-medium text-xs sm:text-sm transition touch-manipulation min-h-[44px] flex items-center justify-center"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                Retake
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Camera Modal - Simplified to rely on isOpen */}
        <IDCameraCapture
          isOpen={showCamera}
          onCapture={handleCameraCapture}
          onCancel={() => {
            console.log('📵 Closing camera modal');
            setShowCamera(false);
          }}
        />
    </div>
  );
}
