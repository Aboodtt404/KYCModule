import React, { useState, useRef } from 'react';
import { useFileUpload } from './FileUploadd';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';

export function FileUpload() {
  const { uploadFile, isUploading } = useFileUpload();
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = async (files: FileList) => {
    const file = files[0];
    if (!file) return;

    setUploadStatus('uploading');
    setUploadProgress(0);
    setErrorMessage('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      await uploadFile(
        file.name,
        file.type || 'application/octet-stream',
        uint8Array,
        (progress) => setUploadProgress(progress)
      );
      
      setUploadStatus('success');
      setTimeout(() => setUploadStatus('idle'), 3000);
    } catch (error) {
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const resetUpload = () => {
    setUploadStatus('idle');
    setUploadProgress(0);
    setErrorMessage('');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Documents</h2>
        <p className="text-gray-600">Upload images, documents, and other files to your collection</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {uploadStatus === 'idle' && (
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleChange}
              accept="*/*"
            />
            
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Drop files here or click to browse
            </h3>
            <p className="text-gray-500 mb-4">
              Support for images, documents, and other file types
            </p>
            
            <button
              onClick={onButtonClick}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Choose Files
            </button>
          </div>
        )}

        {uploadStatus === 'uploading' && (
          <div className="text-center py-8">
            <File className="mx-auto h-12 w-12 text-blue-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-4">Uploading...</h3>
            
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            
            <p className="text-gray-600">{Math.round(uploadProgress)}% complete</p>
          </div>
        )}

        {uploadStatus === 'success' && (
          <div className="text-center py-8">
            <CheckCircle className="mx-auto h-12 w-12 text-green-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Successful!</h3>
            <p className="text-gray-600 mb-4">Your file has been uploaded successfully</p>
            
            <button
              onClick={resetUpload}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload Another File
            </button>
          </div>
        )}

        {uploadStatus === 'error' && (
          <div className="text-center py-8">
            <AlertCircle className="mx-auto h-12 w-12 text-red-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Failed</h3>
            <p className="text-red-600 mb-4">{errorMessage}</p>
            
            <button
              onClick={resetUpload}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
