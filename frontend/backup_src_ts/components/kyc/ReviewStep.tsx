"use client";
import React from "react";
import GlassCard from "./GlassCard";
import { Button } from "@/components/ui/button";

interface Props {
  userData?: {
    phone?: string;
    documentFile?: File | null;
    ocrData?: Record<string, string> | null;
    faceImage?: string | null;
    editedData?: Record<string, string> | null;
    needsEditing?: boolean;
  };
  editedData?: Record<string, string> | null;
  onNext: () => void;
}

export default function ReviewStep({ userData, editedData, onNext }: Props) {
  // Prefer editedData → fallback to OCR data → fallback to {}
  const displayData: Record<string, string> =
    editedData ?? userData?.ocrData ?? {};

  return (
    <GlassCard className="space-y-4">
      <h3 className="text-lg font-semibold">Review & submit</h3>
      <div className="text-sm text-gray-300">
        {/* Phone */}
        <div className="flex justify-between">
          <span>Phone</span>
          <span>{userData?.phone ?? "—"}</span>
        </div>

        {/* Document */}
        <div className="flex justify-between mt-2">
          <span>Document</span>
          <span>{userData?.documentFile?.name ?? "—"}</span>
        </div>

        {/* Verified Information */}
        {Object.keys(displayData).length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-600">
            <h4 className="font-medium mb-2">Verified Information:</h4>

            {/* Face Image */}
            {displayData.face_image && (
              <div className="mb-4 p-3 bg-gray-800 rounded-lg">
                <h5 className="text-sm font-medium mb-2">Extracted Face:</h5>
                <img
                  src={`data:image/jpeg;base64,${displayData.face_image}`}
                  alt="Extracted face from ID"
                  className="w-24 h-24 object-cover rounded border border-gray-600"
                />
              </div>
            )}

            {/* Other Fields */}
            {Object.entries(displayData)
              .filter(([key]) => key !== "face_image")
              .map(([key, value]) => (
                <div key={key} className="flex justify-between mt-1">
                  <span className="capitalize">
                    {key
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (str) => str.toUpperCase())}
                  </span>
                  <span className="text-right max-w-[200px] truncate">
                    {value || "—"}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="pt-2">
        <Button onClick={onNext} className="w-full">
          Submit for verification
        </Button>
      </div>
    </GlassCard>
  );
}
