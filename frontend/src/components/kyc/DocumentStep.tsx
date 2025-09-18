"use client";
import { useState } from "react";
import GlassCard from "./GlassCard";
import UploadBox from "./UploadBox";
import ThreeHero from "./ThreeHero";
import { Button } from "@/components/ui/button";

export default function DocumentStep({
  onNext,
  onUploaded,
}: {
  onNext: (ocrData: Record<string, string>, file: File, faceImage?: string) => void;
  onUploaded?: (file: File) => void;
}) {
  const [type, setType] = useState<"id" | "passport">("id");
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  function handleFile(f: File) {
    setFile(f);
    onUploaded?.(f);
  }

  async function handleProcessDocument() {
    if (!file) return;

    setIsProcessing(true);
    try {
      // Convert file to ArrayBuffer for binary data transmission
      const arrayBuffer = await file.arrayBuffer();

      // Determine the correct OCR endpoint based on document type
      const ocrEndpoint = type === "id"
        ? "http://194.31.150.154:5000/egyptian-id"
        : "http://194.31.150.154:5000/passport";

      // Call the cloud OCR server directly with binary image data
      const response = await fetch(ocrEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: arrayBuffer,
      });

      if (!response.ok) {
        throw new Error(`OCR server responded with status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.extracted_data) {
        // Use the actual OCR data from the server
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

        console.log("OCR Data extracted:", ocrData);
        console.log("Full server response:", result);
        onNext(ocrData, file, extractedData.face_image);
      } else {
        throw new Error(result.error || 'OCR processing failed');
      }
    } catch (error) {
      console.error('OCR processing error:', error);
      // Fallback to mock data if OCR fails
      const ocrData = {
        name: "Sample Name",
        idNumber: "123456789",
        birthDate: "1990-01-01",
      };
      onNext(ocrData, file);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="space-y-4">
      <ThreeHero className="h-36 sm:h-52" />
      <GlassCard>
        <div className="flex gap-3 justify-center flex-col sm:flex-row">
          <button
            className={`p-3 rounded-xl w-full sm:w-auto ${type === "id" ? "bg-emerald-500 text-black" : "bg-white/6"
              }`}
            onClick={() => setType("id")}
          >
            🪪 National ID
          </button>
          <button
            className={`p-3 rounded-xl w-full sm:w-auto ${type === "passport" ? "bg-emerald-500 text-black" : "bg-white/6"
              }`}
            onClick={() => setType("passport")}
          >
            🛂 Passport
          </button>
        </div>

        <div className="mt-4">
          <UploadBox
            label={`Upload ${type === "id" ? "National ID (front)" : "Passport"
              }`}
            onFile={handleFile}
          />
        </div>

        {file && (
          <div className="mt-4 text-sm text-gray-200">
            <div className="flex items-center justify-between">
              <div>{file.name}</div>
              <div>{Math.round(file.size / 1000)} KB</div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                onClick={handleProcessDocument}
                className="w-full"
                disabled={isProcessing}
              >
                {isProcessing ? "Processing..." : "Process Document"}
              </Button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}