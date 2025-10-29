import React, { useState, useRef } from "react";
import { useFileUpload } from "@/hooks/useFileUpload";
import { Upload, File, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export function FileUpload() {
  const { handleFileSelect, isUploading, error } = useFileUpload();
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("idle");
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;

    setUploadStatus("uploading");
    try {
      await handleFileSelect(files);
      setUploadStatus("success");
      setTimeout(() => setUploadStatus("idle"), 3000); // Reset after 3s
    } catch (err) {
      console.error("Upload component error:", err);
      setUploadStatus("error");
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const resetUpload = () => {
    setUploadStatus("idle");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">
          Upload Documents
        </h2>
        <p className="text-gray-400">
          Upload images, documents, and other files to your collection
        </p>
      </div>

      <div className="bg-slate-800/60 backdrop-blur-md border border-white/10 rounded-2xl shadow-sm p-6 transition-all">
        {uploadStatus === "idle" && (
          <div
            className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              dragActive
                ? "border-indigo-400 bg-indigo-500/10"
                : "border-gray-600 hover:border-indigo-400"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={onButtonClick}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleChange}
              multiple
              accept="*/*"
            />

            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-white">
              Drag & drop your files here
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              or click to browse files from your device
            </p>
          </div>
        )}

        {isUploading && uploadStatus === 'uploading' && (
          <div className="text-center py-8">
            <Loader2 className="mx-auto h-12 w-12 text-indigo-400 animate-spin mb-4" />
            <h3 className="text-lg font-semibold text-white mb-4">
              Uploading...
            </h3>
            <p className="text-sm text-gray-400">
              Please wait while your files are being uploaded.
            </p>
          </div>
        )}

        {uploadStatus === "success" && (
          <div className="text-center py-8">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold text-white">
              Upload Successful!
            </h3>
            <p className="text-gray-400 mb-4">
              Your files have been added to the library.
            </p>

            <button
              onClick={resetUpload}
              className="px-6 py-2 rounded-full font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              Upload More Files
            </button>
          </div>
        )}

        {(uploadStatus === "error" || error) && (
          <div className="text-center py-8">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold text-white">
              Upload Failed
            </h3>
            <p className="text-red-400 mb-4">
              {error?.message || "An unknown error occurred."}
            </p>

            <button
              onClick={resetUpload}
              className="px-6 py-2 rounded-full font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
