import React, { useState } from 'react';
import { useDocuments, useOCR } from './useQueries';
import { useFileList } from './FileList';
import { Image, Loader2, ScanText, AlertCircle } from 'lucide-react';
import { FileMetadata } from './types';

interface OcrResult {
  text: string;
  confidence: number;
}

export function OCRProcessor() {
  const { data: documents } = useDocuments();
  const { getFileUrl } = useFileList();
  const ocrMutation = useOCR();

  const [selectedImage, setSelectedImage] = useState<FileMetadata | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [ocrResult, setOcrResult] = useState<OcrResult[] | null>(null);
  const [error, setError] = useState<string>('');

  const imageFiles = documents?.filter(doc => doc.mimeType.startsWith('image/')) || [];

  const handleImageSelect = async (file: FileMetadata) => {
    try {
      const url = await getFileUrl(file);
      setImageUrl(url);
      setSelectedImage(file);
      setOcrResult(null);
      setError('');
    } catch (err) {
      setError('Failed to load image URL.');
      console.error(err);
    }
  };

  const handleRunOcr = async () => {
    if (!selectedImage || !imageUrl) return;
    setError('');
    
    try {
      // Fetch the image data
      const response = await fetch(imageUrl);
      const imageBlob = await response.blob();
      
      ocrMutation.mutate(imageBlob, {
        onSuccess: (data) => {
          setOcrResult(data);
        },
        onError: (err) => {
          setError('Failed to process image with OCR.');
          console.error(err);
        },
      });
    } catch (err) {
      setError('Failed to fetch image data.');
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Run OCR on Document</h2>
        <p className="text-gray-600">Select an image to extract text using OCR</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Image Selection */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Select Image</h3>
          {imageFiles.length === 0 ? (
            <div className="text-center py-8">
              <Image className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-600">No images available for OCR</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {imageFiles.map((file, index) => (
                <button
                  key={`${file.path}-${index}`}
                  onClick={() => handleImageSelect(file)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedImage?.path === file.path
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center min-w-0">
                    <Image className="w-4 h-4 text-blue-600 mr-2 flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{file.path}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* OCR Processing and Results */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">OCR Preview and Results</h3>
          {!selectedImage ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
              <ScanText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-600">Select an image to begin</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <img src={imageUrl} alt={selectedImage.path} className="w-full h-auto max-h-96 object-contain" />
              </div>

              <div className="text-center">
                <button
                  onClick={handleRunOcr}
                  disabled={ocrMutation.isPending}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center mx-auto"
                >
                  {ocrMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ScanText className="w-5 h-5 mr-2" />
                      Run OCR
                    </>
                  )}
                </button>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              )}

              {ocrResult && (
                <div className="mt-4 space-y-4">
                  <h4 className="text-lg font-medium text-gray-900">Extracted Text</h4>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-h-60 overflow-y-auto">
                    {ocrResult.length > 0 ? (
                      <ul className="space-y-2">
                        {ocrResult.map((result, index) => (
                          <li key={index} className="flex justify-between items-center">
                            <span className="text-gray-800">{result.text}</span>
                            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                              {(result.confidence * 100).toFixed(1)}%
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-600">No text found in the image.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 