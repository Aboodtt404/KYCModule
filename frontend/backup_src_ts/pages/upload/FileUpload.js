import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef } from "react";
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
        }
        else if (e.type === "dragleave") {
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
        if (!file)
            return;
        setUploadStatus("uploading");
        setUploadProgress(0);
        setErrorMessage("");
        try {
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            await uploadFile(file.name, file.type || "application/octet-stream", uint8Array, (progress) => setUploadProgress(progress));
            setUploadStatus("success");
            setTimeout(() => setUploadStatus("idle"), 2500);
        }
        catch (error) {
            setUploadStatus("error");
            setErrorMessage(error instanceof Error ? error.message : "Upload failed");
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
    return (_jsxs("div", { className: "max-w-2xl mx-auto", children: [_jsxs("div", { className: "mb-6", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900 dark:text-gray-100", children: "Upload Documents" }), _jsx("p", { className: "text-gray-600 dark:text-gray-300", children: "Upload images, documents, and other files to your collection" })] }), _jsxs("div", { className: "bg-white dark:bg-glass dark:backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm p-6 transition-all", children: [uploadStatus === "idle" && (_jsxs("div", { className: `relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragActive
                            ? "border-blue-400 bg-blue-50 dark:bg-blue-500/10"
                            : "border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-300"}`, onDragEnter: handleDrag, onDragLeave: handleDrag, onDragOver: handleDrag, onDrop: handleDrop, onClick: onButtonClick, children: [_jsx("input", { ref: fileInputRef, type: "file", className: "hidden", onChange: handleChange, accept: "*/*" }), _jsx(Upload, { className: "mx-auto h-12 w-12 text-gray-400 dark:text-gray-300 mb-4" }), _jsx("h3", { className: "text-lg font-semibold text-gray-900 dark:text-gray-100", children: "Drag & drop your file here" }), _jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400 mt-1", children: "or click to browse files from your device" })] })), uploadStatus === "uploading" && (_jsxs("div", { className: "text-center py-8", children: [_jsx(File, { className: "mx-auto h-12 w-12 text-blue-600 mb-4" }), _jsx("h3", { className: "text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4", children: "Uploading..." }), _jsx("div", { className: "w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3 overflow-hidden", children: _jsx("div", { className: "bg-blue-600 h-2 rounded-full transition-all duration-300", style: { width: `${uploadProgress}%` } }) }), _jsxs("p", { className: "text-sm text-gray-600 dark:text-gray-300", children: [Math.round(uploadProgress), "% complete"] })] })), uploadStatus === "success" && (_jsxs("div", { className: "text-center py-8", children: [_jsx(CheckCircle, { className: "mx-auto h-12 w-12 text-green-500 mb-4" }), _jsx("h3", { className: "text-lg font-semibold text-gray-900 dark:text-gray-100", children: "Upload Successful!" }), _jsx("p", { className: "text-gray-600 dark:text-gray-300 mb-4", children: "Your file has been uploaded successfully" }), _jsx("button", { onClick: resetUpload, className: "px-6 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors", children: "Upload Another File" })] })), uploadStatus === "error" && (_jsxs("div", { className: "text-center py-8", children: [_jsx(AlertCircle, { className: "mx-auto h-12 w-12 text-red-500 mb-4" }), _jsx("h3", { className: "text-lg font-semibold text-gray-900 dark:text-gray-100", children: "Upload Failed" }), _jsx("p", { className: "text-red-600 dark:text-red-400 mb-4", children: errorMessage }), _jsx("button", { onClick: resetUpload, className: "px-6 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors", children: "Try Again" })] }))] })] }));
}
