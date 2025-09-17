import React, { useState, useCallback } from 'react';
import { useFileUpload } 
import { useVerifyKYC } from '../hooks/useQueries'; 
import { extractStructuredData } from '../utils/dataExtraction'; 
import { enhanceImage } from '../utils/imageEnhancement'; 
import { Upload, FileImage, CheckCircle, AlertCircle, Settings } from 'lucide-react';
import StructuredDataDisplay from './StructuredDataDisplay'; 

type DocumentType = 'national-id' | 'passport';

interface StructuredData {
  name?: string;
  idNumber?: string;
  passportNumber?: string;
  dateOfBirth?: string;
  nationality?: string;
  expiryDate?: string;
  documentType: DocumentType;
}

interface UploadState {
  file: File | null;
  documentType: DocumentType;
  uploading: boolean;
  enhancing: boolean;
  processing: boolean;
  completed: boolean;
  error: string | null;
  rawOcrResult: string | null;
  structuredData: StructuredData | null;
  enhancedImageUrl: string | null;
  originalImageUrl: string | null;
  compressing: boolean;
  compressionInfo: {
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  } | null;
}

export default function DocumentUpload() {
  const [uploadState, setUploadState] = useState<UploadState>({
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
  const {
    compressImageFile,
    isCompressing,
    compressionResult,
    compressionError,
    needsCompressionCheck,
    getRecommendations
  } = useImageCompression({
    maxSizeKB: 500, // 500KB limit for IC compatibility
    autoCompress: true,
    showCompressionInfo: true
  });

  const handleFileSelect = useCallback(async (file: File) => {
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
      } catch (error) {
        console.error('Compression failed:', error);
        setUploadState(prev => ({
          ...prev,
          compressing: false,
          error: `Compression failed: ${compressionError || 'Unknown error'}. Using original file.`,
        }));
      }
    } else {
      setUploadState(prev => ({
        ...prev,
        compressing: false,
      }));
    }
  }, [compressImageFile, needsCompressionCheck, getRecommendations, compressionResult, compressionError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    if (imageFile) {
      handleFileSelect(imageFile);
    }
  }, [handleFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleUpload = async () => {
    if (!uploadState.file) return;

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

    } catch (error) {
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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload KYC Document</h3>

        {/* Document Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">Document Type</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setUploadState(prev => ({ ...prev, documentType: 'national-id' }))}
              className={`p-4 border-2 rounded-lg text-left transition-colors ${uploadState.documentType === 'national-id'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                }`}
            >
              <div className="font-medium text-gray-900">National ID</div>
              <div className="text-sm text-gray-600">Arabic national identity card</div>
            </button>
            <button
              onClick={() => setUploadState(prev => ({ ...prev, documentType: 'passport' }))}
              className={`p-4 border-2 rounded-lg text-left transition-colors ${uploadState.documentType === 'passport'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                }`}
            >
              <div className="font-medium text-gray-900">Passport</div>
              <div className="text-sm text-gray-600">International passport</div>
            </button>
          </div>
        </div>

        {/* File Upload Area */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
        >
          {uploadState.file ? (
            <div className="space-y-4">
              <FileImage className="w-12 h-12 text-green-600 mx-auto" />
              <div>
                <p className="font-medium text-gray-900">{uploadState.file.name}</p>
                <p className="text-sm text-gray-600">
                  {(uploadState.file.size / 1024 / 1024).toFixed(2)} MB
                </p>

                {/* Compression Status */}
                {uploadState.compressing && (
                  <div className="flex items-center space-x-2 mt-2">
                    <Zap className="w-4 h-4 text-blue-500 animate-pulse" />
                    <span className="text-sm text-blue-600">Compressing image...</span>
                  </div>
                )}

                {uploadState.compressionInfo && (
                  <div className="mt-2 p-2 bg-green-50 rounded-md">
                    <div className="flex items-center space-x-2 mb-1">
                      <Zap className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Image Compressed</span>
                    </div>
                    <div className="text-xs text-green-700">
                      <div>Original: {(uploadState.compressionInfo.originalSize / 1024 / 1024).toFixed(2)} MB</div>
                      <div>Compressed: {(uploadState.compressionInfo.compressedSize / 1024 / 1024).toFixed(2)} MB</div>
                      <div>Saved: {((1 - uploadState.compressionInfo.compressionRatio) * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={resetUpload}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Choose different file
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <Upload className="w-12 h-12 text-gray-400 mx-auto" />
              <div>
                <p className="text-lg font-medium text-gray-900">Drop your document here</p>
                <p className="text-gray-600">or click to browse</p>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
              >
                Browse Files
              </label>
            </div>
          )}
        </div>

        {/* Image Preview */}
        {(uploadState.originalImageUrl || uploadState.enhancedImageUrl) && (
          <div className="mt-6 bg-white border rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-4">Image Preview</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {uploadState.originalImageUrl && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Original Image</p>
                  <img
                    src={uploadState.originalImageUrl}
                    alt="Original document"
                    className="w-full h-48 object-contain border rounded-lg bg-gray-50"
                  />
                </div>
              )}
              {uploadState.enhancedImageUrl && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Enhanced Image</p>
                  <img
                    src={uploadState.enhancedImageUrl}
                    alt="Enhanced document"
                    className="w-full h-48 object-contain border rounded-lg bg-gray-50"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Upload Button */}
        {uploadState.file && !uploadState.completed && (
          <div className="mt-6">
            <button
              onClick={handleUpload}
              disabled={uploadState.enhancing || uploadState.uploading || uploadState.processing}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploadState.enhancing
                ? 'Enhancing Image...'
                : uploadState.uploading
                  ? 'Uploading...'
                  : uploadState.processing
                    ? 'Processing with OCR...'
                    : 'Enhance and Verify'}
            </button>
          </div>
        )}

        {/* Progress Indicators */}
        {(uploadState.enhancing || uploadState.uploading || uploadState.processing) && (
          <div className="mt-6 space-y-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <div>
                  <p className="font-medium text-blue-900">
                    {uploadState.enhancing
                      ? 'Applying image enhancements...'
                      : uploadState.uploading
                        ? 'Uploading enhanced document...'
                        : 'Processing with OCR...'
                    }
                  </p>
                  <p className="text-sm text-blue-700">
                    {uploadState.enhancing
                      ? 'Applying brightness, contrast, sharpening, denoising, cropping, orientation correction, and color normalization'
                      : uploadState.uploading
                        ? 'Securely uploading your enhanced document'
                        : 'Extracting structured data from enhanced image'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Enhancement Details */}
            {uploadState.enhancing && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Settings className="w-5 h-5 text-gray-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900 mb-2">Applied Enhancements:</p>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Automatic brightness and contrast adjustment</li>
                      <li>• Sharpening and edge enhancement</li>
                      <li>• Noise reduction and denoising</li>
                      <li>• Intelligent document cropping</li>
                      <li>• Orientation and perspective correction</li>
                      <li>• Color normalization and gamma correction</li>
                      <li>• Histogram equalization for better text clarity</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error State */}
        {uploadState.error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <div>
                <p className="font-medium text-red-900">Processing Failed</p>
                <p className="text-sm text-red-700">{uploadState.error}</p>
              </div>
            </div>
            <button
              onClick={resetUpload}
              className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Success State */}
        {uploadState.completed && uploadState.rawOcrResult && (
          <div className="mt-6 space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-green-900">Document Processed Successfully</p>
                  <p className="text-sm text-green-700 mt-1">
                    Image enhanced with advanced preprocessing and OCR processing completed
                  </p>
                </div>
              </div>
            </div>

            {/* Structured Data Display */}
            {uploadState.structuredData && (
              <StructuredDataDisplay data={uploadState.structuredData} />
            )}

            {/* Raw OCR Results */}
            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Raw OCR Output</h4>
              <div className="bg-gray-50 rounded border p-3 max-h-40 overflow-y-auto">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap">{uploadState.rawOcrResult}</pre>
              </div>
            </div>

            <button
              onClick={resetUpload}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Upload Another Document
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
