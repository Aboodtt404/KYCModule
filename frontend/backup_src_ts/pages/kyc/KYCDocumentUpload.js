import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Upload, File, CheckCircle, AlertCircle, CreditCard, FileText } from "lucide-react";
const documentTypes = [
    {
        id: "national_id",
        name: "National ID",
        description: "Government issued national identification",
        icon: CreditCard,
        required: true,
    },
    {
        id: "passport",
        name: "Passport",
        description: "International passport document",
        icon: FileText,
        required: false,
    },
    {
        id: "driver_license",
        name: "Driver's License",
        description: "Valid driver's license",
        icon: CreditCard,
        required: false,
    },
];
export function KYCDocumentUpload({ onDocumentVerified }) {
    const [selectedDocumentType, setSelectedDocumentType] = useState("national_id");
    const [uploadedDocuments, setUploadedDocuments] = useState([]);
    const [dragActive, setDragActive] = useState(false);
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
        const documentId = `${selectedDocumentType}_${Date.now()}`;
        const newDocument = {
            id: documentId,
            type: selectedDocumentType,
            file,
            status: "uploading",
            progress: 0,
        };
        setUploadedDocuments(prev => [...prev, newDocument]);
        // Simulate upload progress
        const uploadInterval = setInterval(() => {
            setUploadedDocuments(prev => prev.map(doc => doc.id === documentId
                ? { ...doc, progress: Math.min(doc.progress + 10, 100) }
                : doc));
        }, 100);
        // Simulate upload completion
        setTimeout(() => {
            clearInterval(uploadInterval);
            setUploadedDocuments(prev => prev.map(doc => doc.id === documentId
                ? { ...doc, status: "uploaded", progress: 100 }
                : doc));
            // Simulate verification process
            setTimeout(() => {
                setUploadedDocuments(prev => prev.map(doc => doc.id === documentId
                    ? { ...doc, status: "verifying" }
                    : doc));
                // Simulate verification result
                setTimeout(() => {
                    const isVerified = Math.random() > 0.3;
                    setUploadedDocuments(prev => prev.map(doc => doc.id === documentId
                        ? {
                            ...doc,
                            status: isVerified ? "verified" : "rejected",
                            error: isVerified ? undefined : "Document quality is too low. Please upload a clearer image."
                        }
                        : doc));
                    // Trigger verification callback if document is verified
                    if (isVerified && onDocumentVerified) {
                        setTimeout(() => {
                            onDocumentVerified();
                        }, 1000);
                    }
                }, 2000);
            }, 1000);
        }, 2000);
    };
    const onButtonClick = () => {
        fileInputRef.current?.click();
    };
    const getStatusIcon = (status) => {
        switch (status) {
            case "uploading":
                return _jsx("div", { className: "w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" });
            case "uploaded":
                return _jsx(CheckCircle, { className: "w-4 h-4 text-blue-600" });
            case "verifying":
                return _jsx("div", { className: "w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" });
            case "verified":
                return _jsx(CheckCircle, { className: "w-4 h-4 text-green-600" });
            case "rejected":
                return _jsx(AlertCircle, { className: "w-4 h-4 text-red-600" });
            default:
                return null;
        }
    };
    const getStatusText = (status) => {
        switch (status) {
            case "uploading":
                return "Uploading...";
            case "uploaded":
                return "Uploaded";
            case "verifying":
                return "Verifying...";
            case "verified":
                return "Verified";
            case "rejected":
                return "Rejected";
            default:
                return "";
        }
    };
    const getStatusColor = (status) => {
        switch (status) {
            case "uploading":
                return "text-blue-600";
            case "uploaded":
                return "text-blue-600";
            case "verifying":
                return "text-yellow-600";
            case "verified":
                return "text-green-600";
            case "rejected":
                return "text-red-600";
            default:
                return "text-gray-600";
        }
    };
    const selectedDocType = documentTypes.find(doc => doc.id === selectedDocumentType);
    return (_jsxs("div", { className: "max-w-4xl mx-auto", children: [_jsxs("div", { className: "mb-8", children: [_jsx("h2", { className: "text-3xl font-bold text-gray-900 dark:text-white mb-4", children: "KYC Document Verification" }), _jsx("p", { className: "text-gray-600 dark:text-gray-300 text-lg", children: "Upload your identity documents to complete the verification process" })] }), _jsxs("div", { className: "mb-8", children: [_jsx("h3", { className: "text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4", children: "Select Document Type" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: documentTypes.map((docType) => {
                            const Icon = docType.icon;
                            return (_jsxs("button", { onClick: () => setSelectedDocumentType(docType.id), className: `p-4 rounded-xl border-2 transition-all ${selectedDocumentType === docType.id
                                    ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"}`, children: [_jsx(Icon, { className: "w-8 h-8 mx-auto mb-3 text-gray-600 dark:text-gray-300" }), _jsx("h4", { className: "font-medium text-gray-900 dark:text-gray-100 mb-1", children: docType.name }), _jsx("p", { className: "text-sm text-gray-600 dark:text-gray-400", children: docType.description }), docType.required && (_jsx("span", { className: "inline-block mt-2 px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full", children: "Required" }))] }, docType.id));
                        }) })] }), _jsxs("div", { className: "mb-8", children: [_jsxs("h3", { className: "text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4", children: ["Upload ", selectedDocType?.name] }), _jsxs("div", { className: `relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragActive
                            ? "border-blue-400 bg-blue-50 dark:bg-blue-500/10"
                            : "border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-300"}`, onDragEnter: handleDrag, onDragLeave: handleDrag, onDragOver: handleDrag, onDrop: handleDrop, onClick: onButtonClick, children: [_jsx("input", { ref: fileInputRef, type: "file", className: "hidden", onChange: handleChange, accept: "image/*,.pdf" }), _jsx(Upload, { className: "mx-auto h-12 w-12 text-gray-400 dark:text-gray-300 mb-4" }), _jsxs("h4", { className: "text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2", children: ["Drag & drop your ", selectedDocType?.name.toLowerCase(), " here"] }), _jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400 mb-4", children: "or click to browse files from your device" }), _jsx("p", { className: "text-xs text-gray-400 dark:text-gray-500", children: "Supported formats: JPG, PNG, PDF (Max 10MB)" })] })] }), uploadedDocuments.length > 0 && (_jsxs("div", { className: "mb-8", children: [_jsx("h3", { className: "text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4", children: "Uploaded Documents" }), _jsx("div", { className: "space-y-4", children: uploadedDocuments.map((doc) => (_jsxs(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, className: "bg-white dark:bg-glass dark:backdrop-blur-md rounded-xl p-4 border border-gray-200 dark:border-white/10 shadow-sm", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx(File, { className: "w-8 h-8 text-gray-600 dark:text-gray-300" }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 dark:text-gray-100", children: doc.file.name }), _jsx("p", { className: "text-sm text-gray-600 dark:text-gray-400", children: documentTypes.find(dt => dt.id === doc.type)?.name })] })] }), _jsxs("div", { className: "flex items-center space-x-3", children: [getStatusIcon(doc.status), _jsx("span", { className: `text-sm font-medium ${getStatusColor(doc.status)}`, children: getStatusText(doc.status) })] })] }), doc.status === "uploading" && (_jsxs("div", { className: "mt-3", children: [_jsx("div", { className: "w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2", children: _jsx("div", { className: "bg-blue-600 h-2 rounded-full transition-all duration-300", style: { width: `${doc.progress}%` } }) }), _jsxs("p", { className: "text-xs text-gray-500 dark:text-gray-400 mt-1", children: [doc.progress, "% complete"] })] })), doc.error && (_jsx("div", { className: "mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg", children: _jsx("p", { className: "text-sm text-red-600 dark:text-red-400", children: doc.error }) }))] }, doc.id))) })] })), uploadedDocuments.some(doc => doc.status === "verified") && (_jsxs(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, className: "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center", children: [_jsx(CheckCircle, { className: "w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-4" }), _jsx("h3", { className: "text-xl font-semibold text-green-800 dark:text-green-200 mb-2", children: "Document Verified Successfully!" }), _jsx("p", { className: "text-green-700 dark:text-green-300", children: "Your document has been verified. You can now proceed to OTP verification." })] }))] }));
}
