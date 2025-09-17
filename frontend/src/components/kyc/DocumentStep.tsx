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
  onNext: () => void;
  onUploaded?: (file: File) => void;
}) {
  const [type, setType] = useState<"id" | "passport">("id");
  const [file, setFile] = useState<File | null>(null);

  function handleFile(f: File) {
    setFile(f);
    onUploaded?.(f);
  }

  return (
    <div className="space-y-4">
      <ThreeHero className="h-36 sm:h-52" />
      <GlassCard>
        <div className="flex gap-3 justify-center flex-col sm:flex-row">
          <button
            className={`p-3 rounded-xl w-full sm:w-auto ${
              type === "id" ? "bg-emerald-500 text-black" : "bg-white/6"
            }`}
            onClick={() => setType("id")}
          >
            🪪 National ID
          </button>
          <button
            className={`p-3 rounded-xl w-full sm:w-auto ${
              type === "passport" ? "bg-emerald-500 text-black" : "bg-white/6"
            }`}
            onClick={() => setType("passport")}
          >
            🛂 Passport
          </button>
        </div>

        <div className="mt-4">
          <UploadBox
            label={`Upload ${
              type === "id" ? "National ID (front)" : "Passport"
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
              <Button onClick={() => onNext()} className="w-full">
                Continue
              </Button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}