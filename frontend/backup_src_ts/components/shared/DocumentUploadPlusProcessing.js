import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import { useFileUpload } from '../hooks/useFileUpload';
import { useVerifyKYC } from '../hooks/useQueries';
import { extractStructuredData } from '../utils/dataExtraction';
import { enhanceImage } from '../utils/imageEnhancement';
import { Upload, FileImage, CheckCircle, AlertCircle, Settings } from 'lucide-react';
import StructuredDataDisplay from './StructuredDataDisplay';
export default function DocumentUpload() {
    const [uploadState, setUploadState] = useState({
        file: null,
        documentType: 'national-id',
        uploading: false,
        enhancing: false,
        processing: false,
        completed: false,
        error: null,
        rawOcrResult: null,
        structuredData: null,
        enhancedImageUrl: null,
        originalImageUrl: null,
        compressing: false,
        compressionInfo: null,
    });
    const { uploadFile } = useFileUpload();
    const verifyKYC = useVerifyKYC();
    const { compressImageFile, isCompressing, compressionResult, compressionError, needsCompressionCheck, getRecommendations } = useImageCompression({
        maxSizeKB: 500, // 500KB limit for IC compatibility
        autoCompress: true,
        showCompressionInfo: true
    });
    const handleFileSelect = useCallback(async (file) => {
        // Create preview URL for original image
        const originalUrl = URL.createObjectURL(file);
        // Check if compression is needed
        const needsCompression = needsCompressionCheck(file);
        const recommendations = getRecommendations(file);
        setUploadState(prev => ({
            ...prev,
            file,
            error: null,
            completed: false,
            rawOcrResult: null,
            structuredData: null,
            enhancedImageUrl: null,
            originalImageUrl: originalUrl,
            compressing: needsCompression,
            compressionInfo: null,
        }));
        // Compress image if needed
        if (needsCompression) {
            try {
                const compressedFile = await compressImageFile(file);
                setUploadState(prev => ({
                    ...prev,
                    file: compressedFile,
                    compressing: false,
                    compressionInfo: compressionResult ? {
                        originalSize: file.size,
                        compressedSize: compressionResult.compressedSize,
                        compressionRatio: compressionResult.compressionRatio
                    } : null,
                }));
            }
            catch (error) {
                console.error('Compression failed:', error);
                setUploadState(prev => ({
                    ...prev,
                    compressing: false,
                    error: `Compression failed: ${compressionError || 'Unknown error'}. Using original file.`,
                }));
            }
        }
        else {
            setUploadState(prev => ({
                ...prev,
                compressing: false,
            }));
        }
    }, [compressImageFile, needsCompressionCheck, getRecommendations, compressionResult, compressionError]);
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        const imageFile = files.find(file => file.type.startsWith('image/'));
        if (imageFile) {
            handleFileSelect(imageFile);
        }
    }, [handleFileSelect]);
    const handleFileInput = useCallback((e) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    }, [handleFileSelect]);
    const handleUpload = async () => {
        if (!uploadState.file)
            return;
        try {
            setUploadState(prev => ({ ...prev, enhancing: true, error: null }));
            // Apply client-side image enhancements
            const enhancedFile = await enhanceImage(uploadState.file, uploadState.documentType);
            // Create preview URL for enhanced image
            const enhancedUrl = URL.createObjectURL(enhancedFile);
            setUploadState(prev => ({
                ...prev,
                enhancing: false,
                uploading: true,
                enhancedImageUrl: enhancedUrl
            }));
            // Upload enhanced file
            const timestamp = Date.now();
            const fileName = `${uploadState.documentType}-enhanced-${timestamp}-${uploadState.file.name}`;
            const filePath = `kyc-documents/${fileName}`;
            await uploadFile(filePath, enhancedFile);
            setUploadState(prev => ({ ...prev, uploading: false, processing: true }));
            // Process with OCR
            const rawResult = await verifyKYC.mutateAsync(filePath);
            // Extract structured data from OCR results
            const structuredData = extractStructuredData(rawResult, uploadState.documentType);
            setUploadState(prev => ({
                ...prev,
                processing: false,
                completed: true,
                rawOcrResult: rawResult,
                structuredData,
            }));
        }
        catch (error) {
            setUploadState(prev => ({
                ...prev,
                enhancing: false,
                uploading: false,
                processing: false,
                error: error instanceof Error ? error.message : 'Upload failed',
            }));
        }
    };
    const resetUpload = () => {
        // Clean up object URLs
        if (uploadState.originalImageUrl) {
            URL.revokeObjectURL(uploadState.originalImageUrl);
        }
        if (uploadState.enhancedImageUrl) {
            URL.revokeObjectURL(uploadState.enhancedImageUrl);
        }
        setUploadState({
            file: null,
            documentType: 'national-id',
            uploading: false,
            enhancing: false,
            processing: false,
            completed: false,
            error: null,
            rawOcrResult: null,
            structuredData: null,
            enhancedImageUrl: null,
            originalImageUrl: null,
        });
    };
    return (_jsx("div", { className: "space-y-6", children: _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Upload KYC Document" }), _jsxs("div", { className: "mb-6", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-3", children: "Document Type" }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("button", { onClick: () => setUploadState(prev => ({ ...prev, documentType: 'national-id' })), className: `p-4 border-2 rounded-lg text-left transition-colors ${uploadState.documentType === 'national-id'
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'}`, children: [_jsx("div", { className: "font-medium text-gray-900", children: "National ID" }), _jsx("div", { className: "text-sm text-gray-600", children: "Arabic national identity card" })] }), _jsxs("button", { onClick: () => setUploadState(prev => ({ ...prev, documentType: 'passport' })), className: `p-4 border-2 rounded-lg text-left transition-colors ${uploadState.documentType === 'passport'
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'}`, children: [_jsx("div", { className: "font-medium text-gray-900", children: "Passport" }), _jsx("div", { className: "text-sm text-gray-600", children: "International passport" })] })] })] }), _jsx("div", { onDrop: handleDrop, onDragOver: (e) => e.preventDefault(), className: "border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors", children: uploadState.file ? (_jsxs("div", { className: "space-y-4", children: [_jsx(FileImage, { className: "w-12 h-12 text-green-600 mx-auto" }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-gray-900", children: uploadState.file.name }), _jsxs("p", { className: "text-sm text-gray-600", children: [(uploadState.file.size / 1024 / 1024).toFixed(2), " MB"] }), uploadState.compressing && (_jsxs("div", { className: "flex items-center space-x-2 mt-2", children: [_jsx(Zap, { className: "w-4 h-4 text-blue-500 animate-pulse" }), _jsx("span", { className: "text-sm text-blue-600", children: "Compressing image..." })] })), uploadState.compressionInfo && (_jsxs("div", { className: "mt-2 p-2 bg-green-50 rounded-md", children: [_jsxs("div", { className: "flex items-center space-x-2 mb-1", children: [_jsx(Zap, { className: "w-4 h-4 text-green-600" }), _jsx("span", { className: "text-sm font-medium text-green-800", children: "Image Compressed" })] }), _jsxs("div", { className: "text-xs text-green-700", children: [_jsxs("div", { children: ["Original: ", (uploadState.compressionInfo.originalSize / 1024 / 1024).toFixed(2), " MB"] }), _jsxs("div", { children: ["Compressed: ", (uploadState.compressionInfo.compressedSize / 1024 / 1024).toFixed(2), " MB"] }), _jsxs("div", { children: ["Saved: ", ((1 - uploadState.compressionInfo.compressionRatio) * 100).toFixed(1), "%"] })] })] }))] }), _jsx("button", { onClick: resetUpload, className: "text-sm text-blue-600 hover:text-blue-700", children: "Choose different file" })] })) : (_jsxs("div", { className: "space-y-4", children: [_jsx(Upload, { className: "w-12 h-12 text-gray-400 mx-auto" }), _jsxs("div", { children: [_jsx("p", { className: "text-lg font-medium text-gray-900", children: "Drop your document here" }), _jsx("p", { className: "text-gray-600", children: "or click to browse" })] }), _jsx("input", { type: "file", accept: "image/*", onChange: handleFileInput, className: "hidden", id: "file-upload" }), _jsx("label", { htmlFor: "file-upload", className: "inline-block bg-blue-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors", children: "Browse Files" })] })) }), (uploadState.originalImageUrl || uploadState.enhancedImageUrl) && (_jsxs("div", { className: "mt-6 bg-white border rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-gray-900 mb-4", children: "Image Preview" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [uploadState.originalImageUrl && (_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-700 mb-2", children: "Original Image" }), _jsx("img", { src: uploadState.originalImageUrl, alt: "Original document", className: "w-full h-48 object-contain border rounded-lg bg-gray-50" })] })), uploadState.enhancedImageUrl && (_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-700 mb-2", children: "Enhanced Image" }), _jsx("img", { src: uploadState.enhancedImageUrl, alt: "Enhanced document", className: "w-full h-48 object-contain border rounded-lg bg-gray-50" })] }))] })] })), uploadState.file && !uploadState.completed && (_jsx("div", { className: "mt-6", children: _jsx("button", { onClick: handleUpload, disabled: uploadState.enhancing || uploadState.uploading || uploadState.processing, className: "w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors", children: uploadState.enhancing
                            ? 'Enhancing Image...'
                            : uploadState.uploading
                                ? 'Uploading...'
                                : uploadState.processing
                                    ? 'Processing with OCR...'
                                    : 'Enhance and Verify' }) })), (uploadState.enhancing || uploadState.uploading || uploadState.processing) && (_jsxs("div", { className: "mt-6 space-y-4", children: [_jsx("div", { className: "bg-blue-50 rounded-lg p-4", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-blue-900", children: uploadState.enhancing
                                                    ? 'Applying image enhancements...'
                                                    : uploadState.uploading
                                                        ? 'Uploading enhanced document...'
                                                        : 'Processing with OCR...' }), _jsx("p", { className: "text-sm text-blue-700", children: uploadState.enhancing
                                                    ? 'Applying brightness, contrast, sharpening, denoising, cropping, orientation correction, and color normalization'
                                                    : uploadState.uploading
                                                        ? 'Securely uploading your enhanced document'
                                                        : 'Extracting structured data from enhanced image' })] })] }) }), uploadState.enhancing && (_jsx("div", { className: "bg-gray-50 rounded-lg p-4", children: _jsxs("div", { className: "flex items-start space-x-3", children: [_jsx(Settings, { className: "w-5 h-5 text-gray-600 mt-0.5" }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-gray-900 mb-2", children: "Applied Enhancements:" }), _jsxs("ul", { className: "text-sm text-gray-700 space-y-1", children: [_jsx("li", { children: "\u2022 Automatic brightness and contrast adjustment" }), _jsx("li", { children: "\u2022 Sharpening and edge enhancement" }), _jsx("li", { children: "\u2022 Noise reduction and denoising" }), _jsx("li", { children: "\u2022 Intelligent document cropping" }), _jsx("li", { children: "\u2022 Orientation and perspective correction" }), _jsx("li", { children: "\u2022 Color normalization and gamma correction" }), _jsx("li", { children: "\u2022 Histogram equalization for better text clarity" })] })] })] }) }))] })), uploadState.error && (_jsxs("div", { className: "mt-6 bg-red-50 border border-red-200 rounded-lg p-4", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx(AlertCircle, { className: "w-5 h-5 text-red-600" }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-red-900", children: "Processing Failed" }), _jsx("p", { className: "text-sm text-red-700", children: uploadState.error })] })] }), _jsx("button", { onClick: resetUpload, className: "mt-3 text-sm text-red-600 hover:text-red-700 font-medium", children: "Try Again" })] })), uploadState.completed && uploadState.rawOcrResult && (_jsxs("div", { className: "mt-6 space-y-6", children: [_jsx("div", { className: "bg-green-50 border border-green-200 rounded-lg p-4", children: _jsxs("div", { className: "flex items-start space-x-3", children: [_jsx(CheckCircle, { className: "w-5 h-5 text-green-600 mt-0.5" }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "font-medium text-green-900", children: "Document Processed Successfully" }), _jsx("p", { className: "text-sm text-green-700 mt-1", children: "Image enhanced with advanced preprocessing and OCR processing completed" })] })] }) }), uploadState.structuredData && (_jsx(StructuredDataDisplay, { data: uploadState.structuredData })), _jsxs("div", { className: "bg-white border rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-gray-900 mb-3", children: "Raw OCR Output" }), _jsx("div", { className: "bg-gray-50 rounded border p-3 max-h-40 overflow-y-auto", children: _jsx("pre", { className: "text-xs text-gray-600 whitespace-pre-wrap", children: uploadState.rawOcrResult }) })] }), _jsx("button", { onClick: resetUpload, className: "w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors", children: "Upload Another Document" })] }))] }) }));
}
