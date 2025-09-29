"use client";
import React, { useRef, useState } from "react";
import { Upload } from "lucide-react";
export default function UploadBox({ onFile, accept = "image/*,application/pdf", label = "Upload Document", }) {
    const [drag, setDrag] = useState(false);
    const [preview, setPreview] = useState(null);
    const inputRef = useRef(null);
    function handleFiles(files) {
        if (!files || files.length === 0)
            return;
        const file = files[0];
        onFile(file);
        // Preview only for images
        if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = () => setPreview(reader.result);
            reader.readAsDataURL(file);
        }
        else {
            setPreview(null);
        }
    }
    return (<div className="space-y-3">
      <div onDragEnter={() => setDrag(true)} onDragLeave={() => setDrag(false)} onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
        }} onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            handleFiles(e.dataTransfer.files);
        }} onClick={() => inputRef.current?.click()} className={`w-full rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition duration-200 ${drag
            ? "border-emerald-400 bg-emerald-400/5"
            : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
        <div className="flex flex-col items-center gap-3">
          {preview ? (<img src={preview} alt="Preview" className="w-20 h-20 object-cover rounded-xl shadow-md"/>) : (<Upload className="w-10 h-10 text-emerald-400"/>)}
          <div className="font-medium">{label}</div>
          <div className="text-xs text-gray-400">
            JPG, PNG, PDF — max 10MB
          </div>
          <div className="text-xs text-gray-500">
            Drag & drop or click to select
          </div>
        </div>
      </div>

      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => handleFiles(e.target.files)}/>
    </div>);
}
