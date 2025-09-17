"use client";
import React, { useRef, useState } from "react";

export default function UploadBox({
  onFile,
  accept = "image/*,application/pdf",
  label = "Upload Document",
}: {
  onFile: (f: File) => void;
  accept?: string;
  label?: string;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    onFile(files[0]);
  }

  return (
    <div>
      <div
        onDragEnter={() => setDrag(true)}
        onDragLeave={() => setDrag(false)}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`w-full rounded-xl border-2 p-6 text-center cursor-pointer transition ${
          drag ? "border-emerald-400 bg-white/6" : "border-white/6 bg-white/3"
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="text-3xl">📤</div>
          <div className="font-medium">{label}</div>
          <div className="text-xs text-gray-300 mt-1">
            JPG, PNG, PDF — max 10MB
          </div>
          <div className="text-xs text-gray-400 mt-2">
            or tap to open camera / files
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
