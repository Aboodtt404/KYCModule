import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useDocuments, useOCR, useEgyptianIDOCR, usePassportOCR, useEgyptianIdResults, usePassportResults, } from "../../../useQueries";
import { useFileList } from "../../components/shared/FileList";
import { useImageCompression } from "../../../hooks/useImageCompression";
import { Image, Loader2, ScanText, AlertCircle, Flag, Database, Zap, Clock, Bug, CheckCircle, } from "lucide-react";
export function OCRProcessor() {
    const { data: documents } = useDocuments();
    const { getFileUrl } = useFileList();
    const ocrMutation = useOCR();
    const egyptianIDMutation = useEgyptianIDOCR();
    const passportMutation = usePassportOCR();
    const { data: egyptianIdResults } = useEgyptianIdResults();
    const { data: passportResults } = usePassportResults();
    const [selectedImage, setSelectedImage] = useState(null);
    const [imageUrl, setImageUrl] = useState("");
    const [egyptianIDResult, setEgyptianIDResult] = useState(null);
    const [passportResult, setPassportResult] = useState(null);
    const [debugInfo, setDebugInfo] = useState(null);
    const [ocrType, setOcrType] = useState("egyptian");
    const [activeTab, setActiveTab] = useState("process");
    const [error, setError] = useState("");
    const [compressing, setCompressing] = useState(false);
    const [compressionInfo, setCompressionInfo] = useState(null);
    const imageFiles = documents?.filter((doc) => doc.mimeType.startsWith("image/")) || [];
    const { compressImageFile, compressionResult, needsCompressionCheck } = useImageCompression({
        maxSizeKB: 500,
        autoCompress: true,
        showCompressionInfo: true,
    });
    const handleImageSelect = async (file) => {
        try {
            const url = await getFileUrl(file);
            setImageUrl(url);
            setSelectedImage(file);
            setError("");
            setEgyptianIDResult(null);
            setPassportResult(null);
            setDebugInfo(null);
            setCompressionInfo(null);
        }
        catch (err) {
            setError("Failed to load image URL");
            console.error(err);
        }
    };
    const handleRunOcr = async () => {
        if (!selectedImage)
            return;
        setError("");
        try {
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status}`);
            }
            let imageBlob = await response.blob();
            if (imageBlob.size === 0) {
                throw new Error("Image data is empty");
            }
            // Handle compression
            const needsCompression = needsCompressionCheck(new File([imageBlob], "img.jpg"));
            if (needsCompression) {
                setCompressing(true);
                try {
                    const originalSize = imageBlob.size;
                    const compressedFile = await compressImageFile(new File([imageBlob], "img.jpg", { type: imageBlob.type }));
                    imageBlob = compressedFile;
                    setCompressionInfo({
                        originalSize,
                        compressedSize: imageBlob.size,
                        compressionRatio: imageBlob.size / originalSize
                    });
                }
                catch (compressionError) {
                    console.warn("Compression failed, using original:", compressionError);
                }
                finally {
                    setCompressing(false);
                }
            }
            if (ocrType === "egyptian") {
                egyptianIDMutation.mutate(imageBlob, {
                    onSuccess: (data) => {
                        if (data.success && data.extracted_data) {
                            setEgyptianIDResult(data.extracted_data);
                            setDebugInfo(data.debug_info || null);
                        }
                        else {
                            setError("Egyptian ID OCR processing failed: " + (data.error || "Unknown error"));
                        }
                    },
                    onError: (err) => {
                        setError("Failed to process Egyptian ID OCR: " + err.message);
                        console.error(err);
                    },
                });
            }
            else {
                passportMutation.mutate(imageBlob, {
                    onSuccess: (data) => {
                        if (data.success && data.data) {
                            setPassportResult(data.data);
                            setDebugInfo(data.debug_info || null);
                        }
                        else {
                            setError("Passport OCR processing failed: " + (data.error || "Unknown error"));
                        }
                    },
                    onError: (err) => {
                        setError("Failed to process Passport OCR: " + err.message);
                        console.error(err);
                    },
                });
            }
        }
        catch (err) {
            setError("Failed to process image");
            console.error(err);
        }
    };
    return (_jsxs("div", { className: "max-w-6xl mx-auto", children: [_jsxs("div", { className: "mb-6 border-b border-gray-200 dark:border-gray-700 flex space-x-6", children: [_jsx("button", { onClick: () => setActiveTab("process"), className: `px-4 py-2 -mb-px font-medium border-b-2 transition ${activeTab === "process"
                            ? "border-blue-600 text-blue-600 dark:text-blue-400"
                            : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"}`, children: "OCR Processor" }), _jsx("button", { onClick: () => setActiveTab("results"), className: `px-4 py-2 -mb-px font-medium border-b-2 transition ${activeTab === "results"
                            ? "border-blue-600 text-blue-600 dark:text-blue-400"
                            : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"}`, children: "Stored Results" }), _jsxs("button", { onClick: () => setActiveTab("debug"), className: `px-4 py-2 -mb-px font-medium border-b-2 transition ${activeTab === "debug"
                            ? "border-blue-600 text-blue-600 dark:text-blue-400"
                            : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"}`, disabled: !debugInfo, children: [_jsx(Bug, { className: "w-4 h-4 mr-1 inline" }), "Debug Info"] })] }), activeTab === "process" && (_jsxs("div", { children: [_jsxs("div", { className: "flex space-x-6 mb-6", children: [_jsxs("button", { onClick: () => setOcrType("egyptian"), className: `flex items-center px-3 py-2 rounded-lg text-sm font-medium transition ${ocrType === "egyptian"
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-600/20 dark:text-blue-300"
                                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`, children: [_jsx(Flag, { className: "w-4 h-4 mr-2" }), "Egyptian ID"] }), _jsxs("button", { onClick: () => setOcrType("passport"), className: `flex items-center px-3 py-2 rounded-lg text-sm font-medium transition ${ocrType === "passport"
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-600/20 dark:text-blue-300"
                                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`, children: [_jsx(ScanText, { className: "w-4 h-4 mr-2" }), "Passport"] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsxs("div", { className: "bg-white dark:bg-glass border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4", children: "Select Image" }), imageFiles.length === 0 ? (_jsxs("div", { className: "text-center py-8 text-gray-600 dark:text-gray-400", children: [_jsx(Image, { className: "mx-auto h-12 w-12 mb-4 opacity-50" }), "No images available"] })) : (_jsx("div", { className: "space-y-2 max-h-96 overflow-y-auto", children: imageFiles.map((file) => (_jsx("button", { onClick: () => handleImageSelect(file), className: `w-full text-left px-3 py-2 rounded-lg border transition ${selectedImage?.path === file.path
                                                ? "bg-blue-50 dark:bg-blue-600/20 border-blue-500 text-blue-600 dark:text-blue-200"
                                                : "border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-300 text-gray-700 dark:text-gray-300"}`, children: _jsxs("div", { className: "flex items-center min-w-0", children: [_jsx(Image, { className: "w-4 h-4 text-blue-500 mr-2" }), _jsx("span", { className: "truncate", children: file.path })] }) }, file.path))) }))] }), _jsxs("div", { className: "lg:col-span-2 bg-white dark:bg-glass border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4", children: "OCR Preview & Results" }), !selectedImage ? (_jsxs("div", { className: "text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400", children: [_jsx(ScanText, { className: "mx-auto h-12 w-12 mb-4 opacity-50" }), "Select an image to begin"] })) : (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600", children: _jsx("img", { src: imageUrl, alt: selectedImage.path, className: "w-full h-auto max-h-96 object-contain" }) }), compressing && (_jsxs("div", { className: "flex items-center justify-center space-x-2 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg", children: [_jsx(Zap, { className: "w-5 h-5 text-blue-500 animate-pulse" }), _jsx("span", { className: "text-blue-700 dark:text-blue-300", children: "Compressing image..." })] })), compressionInfo && (_jsxs("div", { className: "p-3 bg-green-50 dark:bg-green-900/30 rounded-lg", children: [_jsxs("div", { className: "flex items-center justify-center space-x-2 mb-2", children: [_jsx(CheckCircle, { className: "w-4 h-4 text-green-600" }), _jsx("span", { className: "text-sm font-medium text-green-800 dark:text-green-300", children: "Image Compressed" })] }), _jsxs("div", { className: "text-xs text-green-700 dark:text-green-400 space-y-1", children: [_jsxs("div", { children: ["Original: ", (compressionInfo.originalSize / 1024 / 1024).toFixed(2), " MB"] }), _jsxs("div", { children: ["Compressed: ", (compressionInfo.compressedSize / 1024 / 1024).toFixed(2), " MB"] }), _jsxs("div", { children: ["Space saved: ", ((1 - compressionInfo.compressionRatio) * 100).toFixed(1), "%"] })] })] })), _jsx("div", { className: "text-center", children: _jsxs("button", { onClick: handleRunOcr, disabled: ocrMutation.isPending ||
                                                        egyptianIDMutation.isPending ||
                                                        passportMutation.isPending ||
                                                        compressing, className: "bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition flex items-center justify-center mx-auto disabled:opacity-50", children: [(ocrMutation.isPending ||
                                                            egyptianIDMutation.isPending ||
                                                            passportMutation.isPending) && (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "w-5 h-5 animate-spin mr-2" }), " Processing"] })), compressing && (_jsxs(_Fragment, { children: [_jsx(Zap, { className: "w-5 h-5 animate-pulse mr-2" }), " Compressing"] })), !ocrMutation.isPending &&
                                                            !egyptianIDMutation.isPending &&
                                                            !passportMutation.isPending &&
                                                            !compressing && (_jsxs(_Fragment, { children: [ocrType === "egyptian" ? (_jsx(Flag, { className: "w-5 h-5 mr-2" })) : (_jsx(ScanText, { className: "w-5 h-5 mr-2" })), "Run ", ocrType === "egyptian" ? "Egyptian ID" : "Passport", " OCR"] }))] }) }), error && (_jsxs("div", { className: "mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-800 dark:text-red-300", children: [_jsx(AlertCircle, { className: "w-4 h-4 inline mr-2" }), error] })), egyptianIDResult && (_jsxs("div", { className: "mt-6 space-y-4", children: [_jsxs("h4", { className: "text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center", children: [_jsx(Flag, { className: "w-5 h-5 mr-2 text-green-600" }), "Egyptian ID Information"] }), _jsx("div", { className: "bg-green-50 dark:bg-green-900/30 rounded-lg p-4 border border-green-200 dark:border-green-700", children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-gray-600 dark:text-gray-400", children: "Full Name" }), _jsx("p", { className: "text-gray-900 dark:text-gray-100 font-medium", children: egyptianIDResult.full_name })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-gray-600 dark:text-gray-400", children: "National ID" }), _jsx("p", { className: "text-gray-900 dark:text-gray-100 font-mono", children: egyptianIDResult.national_id })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-gray-600 dark:text-gray-400", children: "Birth Date" }), _jsx("p", { className: "text-gray-900 dark:text-gray-100", children: egyptianIDResult.birth_date })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-gray-600 dark:text-gray-400", children: "Gender" }), _jsx("p", { className: "text-gray-900 dark:text-gray-100", children: egyptianIDResult.gender })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-gray-600 dark:text-gray-400", children: "Governorate" }), _jsx("p", { className: "text-gray-900 dark:text-gray-100", children: egyptianIDResult.governorate })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "text-sm font-medium text-gray-600 dark:text-gray-400", children: "Address" }), _jsx("p", { className: "text-gray-900 dark:text-gray-100", children: egyptianIDResult.address })] })] }) })] })), passportResult && (_jsxs("div", { className: "mt-6 space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg", children: _jsx(ScanText, { className: "w-6 h-6 text-blue-600" }) }), _jsxs("div", { children: [_jsx("h4", { className: "text-xl font-semibold text-gray-900 dark:text-gray-100", children: "Passport Information" }), _jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: "Extracted from Machine Readable Zone" })] })] }), _jsx("div", { className: "px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-medium rounded-full", children: "Verified" })] }), _jsx("div", { className: "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-700 shadow-sm", children: _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "mb-6", children: [_jsxs("h5", { className: "text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4 flex items-center", children: [_jsx("div", { className: "w-2 h-2 bg-blue-500 rounded-full mr-2" }), "Personal Information"] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide", children: "Surname" }), _jsx("p", { className: "text-lg font-semibold text-gray-900 dark:text-gray-100", children: passportResult.surname })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide", children: "Given Name" }), _jsx("p", { className: "text-lg font-semibold text-gray-900 dark:text-gray-100", children: passportResult.name })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide", children: "Date of Birth" }), _jsx("p", { className: "text-lg font-medium text-gray-900 dark:text-gray-100", children: passportResult.date_of_birth })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide", children: "Sex" }), _jsx("p", { className: "text-lg font-medium text-gray-900 dark:text-gray-100", children: passportResult.sex })] })] })] }), _jsxs("div", { className: "mb-6", children: [_jsxs("h5", { className: "text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4 flex items-center", children: [_jsx("div", { className: "w-2 h-2 bg-indigo-500 rounded-full mr-2" }), "Passport Details"] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide", children: "Passport Number" }), _jsx("p", { className: "text-lg font-mono font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border", children: passportResult.passport_number })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide", children: "Passport Type" }), _jsx("p", { className: "text-lg font-medium text-gray-900 dark:text-gray-100", children: passportResult.passport_type })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide", children: "Expiration Date" }), _jsx("p", { className: "text-lg font-medium text-gray-900 dark:text-gray-100", children: passportResult.expiration_date })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide", children: "Issuing Country" }), _jsx("p", { className: "text-lg font-medium text-gray-900 dark:text-gray-100", children: passportResult.issuing_country })] })] })] }), _jsxs("div", { children: [_jsxs("h5", { className: "text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4 flex items-center", children: [_jsx("div", { className: "w-2 h-2 bg-green-500 rounded-full mr-2" }), "Citizenship"] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide", children: "Nationality" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("div", { className: "w-6 h-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-sm shadow-sm" }), _jsx("p", { className: "text-lg font-semibold text-gray-900 dark:text-gray-100", children: passportResult.nationality })] })] })] })] }) })] }))] }))] })] })] })), activeTab === "results" && (_jsxs("div", { className: "mt-6", children: [_jsxs("h2", { className: "text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center mb-4", children: [_jsx(Database, { className: "w-5 h-5 mr-2 text-blue-600" }), "Stored OCR Results"] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs("div", { className: "bg-white dark:bg-glass border border-gray-200 dark:border-white/10 rounded-xl p-6", children: [_jsxs("h3", { className: "text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center", children: [_jsx(Flag, { className: "w-5 h-5 mr-2 text-green-600" }), "Egyptian ID Results (", egyptianIdResults?.length || 0, ")"] }), !egyptianIdResults || egyptianIdResults.length === 0 ? (_jsx("p", { className: "text-gray-500 dark:text-gray-400 text-center py-6", children: "No results stored" })) : (_jsx("div", { className: "space-y-3 max-h-96 overflow-y-auto", children: egyptianIdResults.map(([path, data], idx) => {
                                            try {
                                                const parsed = JSON.parse(data);
                                                return (_jsxs("div", { className: "border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition", children: [_jsxs("div", { className: "flex justify-between text-sm font-medium", children: [_jsx("span", { className: "truncate", children: path }), _jsxs("span", { className: "flex items-center text-gray-500 dark:text-gray-400", children: [_jsx(Clock, { className: "w-3 h-3 mr-1" }), parsed.processing_time, "s"] })] }), _jsxs("p", { className: "text-sm text-gray-700 dark:text-gray-300", children: [_jsx("span", { className: "font-medium", children: "Name:" }), " ", parsed.extracted_data?.full_name || "N/A"] }), _jsxs("p", { className: "text-sm text-gray-700 dark:text-gray-300", children: [_jsx("span", { className: "font-medium", children: "ID:" }), " ", parsed.extracted_data?.national_id || "N/A"] })] }, idx));
                                            }
                                            catch {
                                                return (_jsxs("p", { className: "text-sm text-red-600 dark:text-red-400", children: ["Error parsing ", path] }, idx));
                                            }
                                        }) }))] }), _jsxs("div", { className: "bg-white dark:bg-glass border border-gray-200 dark:border-white/10 rounded-xl p-6", children: [_jsxs("h3", { className: "text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center", children: [_jsx(ScanText, { className: "w-5 h-5 mr-2 text-blue-600" }), "Passport Results (", passportResults?.length || 0, ")"] }), !passportResults || passportResults.length === 0 ? (_jsx("p", { className: "text-gray-500 dark:text-gray-400 text-center py-6", children: "No results stored" })) : (_jsx("div", { className: "space-y-3 max-h-96 overflow-y-auto", children: passportResults.map(([path, data], idx) => {
                                            try {
                                                const parsed = JSON.parse(data);
                                                return (_jsxs("div", { className: "border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition", children: [_jsxs("div", { className: "flex justify-between text-sm font-medium", children: [_jsx("span", { className: "truncate", children: path }), _jsxs("span", { className: "flex items-center text-gray-500 dark:text-gray-400", children: [_jsx(Clock, { className: "w-3 h-3 mr-1" }), parsed.processing_time, "s"] })] }), _jsxs("p", { className: "text-sm text-gray-700 dark:text-gray-300", children: [_jsx("span", { className: "font-medium", children: "Name:" }), " ", parsed.data?.surname, " ", parsed.data?.name] }), _jsxs("p", { className: "text-sm text-gray-700 dark:text-gray-300", children: [_jsx("span", { className: "font-medium", children: "Passport:" }), " ", parsed.data?.passport_number || "N/A"] })] }, idx));
                                            }
                                            catch {
                                                return (_jsxs("p", { className: "text-sm text-red-600 dark:text-red-400", children: ["Error parsing ", path] }, idx));
                                            }
                                        }) }))] })] })] })), activeTab === "debug" && debugInfo && (_jsxs("div", { className: "mt-6", children: [_jsxs("h2", { className: "text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center mb-4", children: [_jsx(Bug, { className: "w-5 h-5 mr-2 text-purple-600" }), "Debug Information"] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-white dark:bg-glass border border-gray-200 dark:border-white/10 rounded-xl p-6", children: [_jsxs("h3", { className: "text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center", children: [_jsx(ScanText, { className: "w-5 h-5 mr-2 text-blue-600" }), "Field Detection Results"] }), debugInfo.detected_fields && debugInfo.detected_fields.length > 0 ? (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: debugInfo.detected_fields.map((field, index) => (_jsxs("div", { className: "border border-gray-200 dark:border-gray-600 rounded-lg p-4", children: [_jsxs("div", { className: "flex justify-between items-center mb-2", children: [_jsx("span", { className: "font-medium text-gray-900 dark:text-gray-100", children: field.class }), _jsxs("span", { className: `text-sm px-2 py-1 rounded-full ${field.confidence > 0.8
                                                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                                                : field.confidence > 0.6
                                                                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                                                                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"}`, children: [(field.confidence * 100).toFixed(1), "%"] })] }), _jsxs("p", { className: "text-xs text-gray-500 dark:text-gray-400", children: ["Box: [", field.bbox?.map(b => b.toFixed(0)).join(', '), "]"] })] }, index))) })) : (_jsx("p", { className: "text-gray-500 dark:text-gray-400 text-center py-6", children: "No field detection data available" }))] }), _jsxs("div", { className: "bg-white dark:bg-glass border border-gray-200 dark:border-white/10 rounded-xl p-6", children: [_jsxs("h3", { className: "text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center", children: [_jsx(Image, { className: "w-5 h-5 mr-2 text-green-600" }), "Processing Pipeline Images"] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [debugInfo.preprocessed_image_path && (_jsxs("a", { href: `http://194.31.150.154:5000/debug-image/${debugInfo.preprocessed_image_path}`, target: "_blank", rel: "noopener noreferrer", className: "block p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition", children: [_jsxs("div", { className: "flex items-center space-x-2 mb-2", children: [_jsx(Zap, { className: "w-4 h-4 text-blue-500" }), _jsx("span", { className: "font-medium text-gray-900 dark:text-gray-100", children: "Preprocessed Image" })] }), _jsx("p", { className: "text-sm text-gray-600 dark:text-gray-400", children: "Auto-rotated, enhanced, and denoised" })] })), debugInfo.debug_image_path && (_jsxs("a", { href: `http://194.31.150.154:5000/debug-image/${debugInfo.debug_image_path}`, target: "_blank", rel: "noopener noreferrer", className: "block p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition", children: [_jsxs("div", { className: "flex items-center space-x-2 mb-2", children: [_jsx(ScanText, { className: "w-4 h-4 text-purple-500" }), _jsx("span", { className: "font-medium text-gray-900 dark:text-gray-100", children: "Annotated Detection" })] }), _jsx("p", { className: "text-sm text-gray-600 dark:text-gray-400", children: "Image with detected field overlays" })] })), debugInfo.cropped_image_path && (_jsxs("a", { href: `http://194.31.150.154:5000/debug-image/${debugInfo.cropped_image_path}`, target: "_blank", rel: "noopener noreferrer", className: "block p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition", children: [_jsxs("div", { className: "flex items-center space-x-2 mb-2", children: [_jsx(Image, { className: "w-4 h-4 text-green-500" }), _jsx("span", { className: "font-medium text-gray-900 dark:text-gray-100", children: "Cropped Document" })] }), _jsx("p", { className: "text-sm text-gray-600 dark:text-gray-400", children: "Extracted document region" })] })), debugInfo.yolo_output_path && (_jsxs("a", { href: `http://194.31.150.154:5000/debug-image/${debugInfo.yolo_output_path}`, target: "_blank", rel: "noopener noreferrer", className: "block p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition", children: [_jsxs("div", { className: "flex items-center space-x-2 mb-2", children: [_jsx(Bug, { className: "w-4 h-4 text-orange-500" }), _jsx("span", { className: "font-medium text-gray-900 dark:text-gray-100", children: "YOLO Output" })] }), _jsx("p", { className: "text-sm text-gray-600 dark:text-gray-400", children: "Raw AI detection results" })] })), debugInfo.mrz_roi_path && (_jsxs("a", { href: `http://194.31.150.154:5000/debug-image/${debugInfo.mrz_roi_path}`, target: "_blank", rel: "noopener noreferrer", className: "block p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition", children: [_jsxs("div", { className: "flex items-center space-x-2 mb-2", children: [_jsx(Flag, { className: "w-4 h-4 text-indigo-500" }), _jsx("span", { className: "font-medium text-gray-900 dark:text-gray-100", children: "MRZ Region" })] }), _jsx("p", { className: "text-sm text-gray-600 dark:text-gray-400", children: "Machine Readable Zone extraction" })] }))] })] }), debugInfo.mrz_detected && (_jsxs("div", { className: "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-6", children: [_jsxs("h3", { className: "text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center", children: [_jsx(CheckCircle, { className: "w-5 h-5 mr-2 text-green-600" }), "MRZ Processing Details"] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "w-12 h-12 mx-auto mb-2 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center", children: _jsx(CheckCircle, { className: "w-6 h-6 text-green-600" }) }), _jsx("p", { className: "font-medium text-gray-900 dark:text-gray-100", children: "MRZ Detected" }), _jsx("p", { className: "text-sm text-gray-600 dark:text-gray-400", children: "Machine readable zone found" })] }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "w-12 h-12 mx-auto mb-2 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center", children: _jsx(ScanText, { className: "w-6 h-6 text-blue-600" }) }), _jsx("p", { className: "font-medium text-gray-900 dark:text-gray-100", children: "OCR Applied" }), _jsx("p", { className: "text-sm text-gray-600 dark:text-gray-400", children: "Text extracted successfully" })] }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "w-12 h-12 mx-auto mb-2 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center", children: _jsx(Database, { className: "w-6 h-6 text-purple-600" }) }), _jsx("p", { className: "font-medium text-gray-900 dark:text-gray-100", children: "Data Parsed" }), _jsx("p", { className: "text-sm text-gray-600 dark:text-gray-400", children: "Fields structured and validated" })] })] })] }))] })] }))] }));
}
