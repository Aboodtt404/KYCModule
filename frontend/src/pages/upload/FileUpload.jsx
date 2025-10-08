import React, { useState, useRef } from "react";
import { useFileUpload } from "../../components/shared/FileUploadd";
import { Upload, File, CheckCircle, AlertCircle } from "lucide-react";

export function FileUpload() {
  const { uploadFile } = useFileUpload();
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
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
    const file = files[0];
    if (!file) return;

    setUploadStatus("uploading");
    setUploadProgress(0);
    setErrorMessage("");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      await uploadFile(
        file.name,
        file.type || "application/octet-stream",
        uint8Array,
        (progress) => setUploadProgress(progress)
      );

      setUploadStatus("success");
      setTimeout(() => setUploadStatus("idle"), 2500);
    } catch (error) {
      setUploadStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Upload failed"
      );
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const resetUpload = () => {
    setUploadStatus("idle");
    setUploadProgress(0);
    setErrorMessage("");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Upload Documents
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Upload images, documents, and other files to your collection
        </p>
      </div>

      <div className=" bg-slate-800/60  dark:backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm p-6 transition-all">
        {uploadStatus === "idle" && (
          <div
            className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              dragActive
                ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10"
                : "border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-300"
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
              accept="*/*"
            />

            <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Drag & drop your file here
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              or click to browse files from your device
            </p>
          </div>
        )}

        {uploadStatus === "uploading" && (
          <div className="text-center py-8">
            <File className="mx-auto h-12 w-12 text-indigo-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Uploading...
            </h3>

            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3 overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              {Math.round(uploadProgress)}% complete
            </p>
          </div>
        )}

        {uploadStatus === "success" && (
          <div className="text-center py-8">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Upload Successful!
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Your file has been uploaded successfully
            </p>

            <button
              onClick={resetUpload}
              className="px-6 py-2 rounded-full font-medium bg-indigo-600 text-white hover:bg-indigo-700 dark:hover:bg-indigo-500 transition-colors"
            >
              Upload Another File
            </button>
          </div>
        )}

        {uploadStatus === "error" && (
          <div className="text-center py-8">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Upload Failed
            </h3>
            <p className="text-red-600 dark:text-red-400 mb-4">
              {errorMessage}
            </p>

            <button
              onClick={resetUpload}
              className="px-6 py-2 rounded-full font-medium bg-indigo-600 text-white hover:bg-indigo-700 dark:hover:bg-indigo-500 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
