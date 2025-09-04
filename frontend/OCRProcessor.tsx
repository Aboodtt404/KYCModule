import React, { useState } from 'react';
import { useDocuments, useOCR, useEgyptianIDOCR } from './useQueries';
import { useFileList } from './FileList';
import { Image, Loader2, ScanText, AlertCircle, Flag } from 'lucide-react';
import { FileMetadata } from './types';

interface OcrResult {
  text: string;
  confidence: number;
}

interface EgyptianIDResult {
  first_name: string;
  second_name: string;
  full_name: string;
  national_id: string;
  address: string;
  birth_date: string;
  governorate: string;
  gender: string;
}

interface DebugInfo {
  detected_fields: Array<{
    class: string;
    confidence: number;
    bbox: number[];
  }>;
  debug_image_path: string;
  cropped_image_path: string;
  yolo_output_path: string;
}

export function OCRProcessor() {
  const { data: documents } = useDocuments();
  const { getFileUrl } = useFileList();
  const ocrMutation = useOCR();
  const egyptianIDMutation = useEgyptianIDOCR();

  const [selectedImage, setSelectedImage] = useState<FileMetadata | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [ocrResult, setOcrResult] = useState<OcrResult[] | null>(null);
  const [egyptianIDResult, setEgyptianIDResult] = useState<EgyptianIDResult | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [ocrType, setOcrType] = useState<'egyptian' | 'passport'>('egyptian');
  const [error, setError] = useState<string>('');

  const imageFiles = documents?.filter(doc => doc.mimeType.startsWith('image/')) || [];

  const handleImageSelect = async (file: FileMetadata) => {
    try {
      const url = await getFileUrl(file);
      setImageUrl(url);
      setSelectedImage(file);
      setOcrResult(null);
      setEgyptianIDResult(null);
      setDebugInfo(null);
      setError('');
    } catch (err) {
      setError('Failed to load image URL.');
      console.error(err);
    }
  };

  const handleRunOcr = async () => {
    if (!selectedImage) return;
    setError('');

    try {
      // Fetch the actual image data from the URL
      console.log('Fetching image from URL:', imageUrl);
      const response = await fetch(imageUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }

      const imageBlob = await response.blob();
      console.log('Image blob size:', imageBlob.size, 'bytes');
      console.log('Image blob type:', imageBlob.type);

      if (imageBlob.size === 0) {
        throw new Error('Image data is empty');
      }

      if (ocrType === 'egyptian') {
        // Use Egyptian ID OCR
        egyptianIDMutation.mutate(imageBlob, {
          onSuccess: (data) => {
            try {
              if (data.success && data.extracted_data) {
                setEgyptianIDResult(data.extracted_data);
                setDebugInfo(data.debug_info || null);
                setOcrResult(null); // Clear basic OCR results
              } else {
                setError('Egyptian ID OCR processing failed: ' + (data.error || 'Unknown error'));
              }
            } catch (e) {
              setError('Failed to parse Egyptian ID OCR results.');
              console.error(e);
            }
          },
          onError: (err) => {
            setError('Failed to process Egyptian ID OCR: ' + err.message);
            console.error(err);
          },
        });
      } else if (ocrType === 'passport') {
        // Passport OCR placeholder - show coming soon message
        setError('Passport OCR is coming soon! This feature will be available in a future update.');
        setEgyptianIDResult(null);
        setOcrResult(null);
        setDebugInfo(null);
      }
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

        {/* OCR Type Selector */}
        <div className="mt-4 flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="ocrType"
              value="egyptian"
              checked={ocrType === 'egyptian'}
              onChange={(e) => setOcrType(e.target.value as 'egyptian' | 'passport')}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700 flex items-center">
              <Flag className="w-4 h-4 mr-1" />
              Egyptian ID OCR (AI-Powered)
            </span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="ocrType"
              value="passport"
              checked={ocrType === 'passport'}
              onChange={(e) => setOcrType(e.target.value as 'egyptian' | 'passport')}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700 flex items-center">
              <ScanText className="w-4 h-4 mr-1" />
              Passport OCR (Coming Soon)
            </span>
          </label>
        </div>
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
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedImage?.path === file.path
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
                  disabled={ocrMutation.isPending || egyptianIDMutation.isPending}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center mx-auto"
                >
                  {(ocrMutation.isPending || egyptianIDMutation.isPending) ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {ocrType === 'egyptian' ? (
                        <Flag className="w-5 h-5 mr-2" />
                      ) : (
                        <ScanText className="w-5 h-5 mr-2" />
                      )}
                      Run {ocrType === 'egyptian' ? 'Egyptian ID' : 'Passport'} OCR
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

              {/* Egyptian ID Results */}
              {egyptianIDResult && (
                <div className="mt-4 space-y-4">
                  <h4 className="text-lg font-medium text-gray-900 flex items-center">
                    <Flag className="w-5 h-5 mr-2 text-green-600" />
                    Egyptian ID Information
                  </h4>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Full Name</label>
                        <p className="text-gray-900 font-medium">{egyptianIDResult.full_name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">National ID</label>
                        <p className="text-gray-900 font-mono">{egyptianIDResult.national_id}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Birth Date</label>
                        <p className="text-gray-900">{egyptianIDResult.birth_date}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Gender</label>
                        <p className="text-gray-900">{egyptianIDResult.gender}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Governorate</label>
                        <p className="text-gray-900">{egyptianIDResult.governorate}</p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-600">Address</label>
                        <p className="text-gray-900">{egyptianIDResult.address}</p>
                      </div>
                    </div>
                  </div>

                  {/* Debug Information */}
                  {debugInfo && (
                    <div className="mt-4">
                      <h5 className="text-md font-medium text-gray-900 mb-3">🔍 Debug Information</h5>
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-600">Fields Detected</label>
                            <div className="mt-2 space-y-1">
                              {debugInfo.detected_fields.map((field, index) => (
                                <div key={index} className="text-sm">
                                  <span className="font-medium">{field.class}:</span>
                                  <span className="ml-2 text-gray-600">{(field.confidence * 100).toFixed(1)}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">Debug Images</label>
                            <div className="mt-2 space-y-2">
                              <a
                                href={`http://localhost:5000/debug-image/${debugInfo.debug_image_path}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-sm block"
                              >
                                📊 Annotated Detection Image
                              </a>
                              <br />
                              <a
                                href={`http://localhost:5000/debug-image/${debugInfo.cropped_image_path}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-sm block"
                              >
                                ✂️ Cropped ID Card
                              </a>
                              <br />
                              <a
                                href={`http://localhost:5000/debug-image/${debugInfo.yolo_output_path}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-sm block"
                              >
                                🤖 YOLO Output
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
} 