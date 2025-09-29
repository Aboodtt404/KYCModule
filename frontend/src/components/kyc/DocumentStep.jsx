"use client";
import React, { useState } from "react";
import GlassCard from "./GlassCard";
import UploadBox from "./UploadBox";
import ThreeHero from "./ThreeHero";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function DocumentStep({ onNext, onUploaded }) {
  const [type, setType] = useState("id");
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  function handleFile(f) {
    setFile(f);
    if (onUploaded) onUploaded(f); // ✅ now always safe
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
              className={`p-3 rounded-xl w-full sm:w-auto transition ${
                type === doc.key
                  ? "bg-emerald-500 text-black font-semibold"
                  : "bg-white/10 hover:bg-white/20"
              }`}
              onClick={() => setType(doc.key)}
            >
              {doc.label}
            </button>
          ))}
        </div>

        {/* Upload */}
        <div className="mt-6">
          <UploadBox
            label={`Upload ${type === "id" ? "National ID (front)" : "Passport"}`}
            onFile={handleFile}
          />
        </div>

        {/* File details + process button */}
        {file && (
          <div className="mt-6 text-sm text-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="truncate max-w-[70%]">{file.name}</span>
              <span className="text-gray-400">
                {(file.size / 1000).toFixed(1)} KB
              </span>
            </div>
            <Button
              onClick={handleProcessDocument}
              className="w-full"
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
          </div>
        )}
      </GlassCard>
    </div>
  );
}
