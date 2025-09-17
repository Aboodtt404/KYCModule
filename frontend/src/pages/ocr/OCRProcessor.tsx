import React, { useState } from "react";
import {
  useDocuments,
  useOCR,
  useEgyptianIDOCR,
  usePassportOCR,
  useEgyptianIdResults,
  usePassportResults,
} from "../../../useQueries";
import { useFileList } from "../../components/shared/FileList";
import { useImageCompression } from "../../../hooks/useImageCompression";
import {
  Image,
  Loader2,
  ScanText,
  AlertCircle,
  Flag,
  Database,
  Zap,
  Clock,
  Bug,
  CheckCircle,
} from "lucide-react";
import { FileMetadata } from "../../../types";

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

interface PassportResult {
  surname: string;
  name: string;
  sex: string;
  date_of_birth: string;
  nationality: string;
  passport_type: string;
  passport_number: string;
  issuing_country: string;
  expiration_date: string;
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
  preprocessed_image_path: string;
  mrz_roi_path?: string;
  mrz_detected?: boolean;
}

export function OCRProcessor() {
  const { data: documents } = useDocuments();
  const { getFileUrl } = useFileList();
  const ocrMutation = useOCR();
  const egyptianIDMutation = useEgyptianIDOCR();
  const passportMutation = usePassportOCR();
  const { data: egyptianIdResults } = useEgyptianIdResults();
  const { data: passportResults } = usePassportResults();

  const [selectedImage, setSelectedImage] = useState<FileMetadata | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [egyptianIDResult, setEgyptianIDResult] = useState<EgyptianIDResult | null>(null);
  const [passportResult, setPassportResult] = useState<PassportResult | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [ocrType, setOcrType] = useState<"egyptian" | "passport">("egyptian");
  const [activeTab, setActiveTab] = useState<"process" | "results" | "debug">("process");
  const [error, setError] = useState<string>("");
  const [compressing, setCompressing] = useState<boolean>(false);
  const [compressionInfo, setCompressionInfo] = useState<{
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  } | null>(null);

  const imageFiles =
    documents?.filter((doc) => doc.mimeType.startsWith("image/")) || [];

  const { compressImageFile, compressionResult, needsCompressionCheck } = useImageCompression({
    maxSizeKB: 500,
    autoCompress: true,
    showCompressionInfo: true,
  });

  const handleImageSelect = async (file: FileMetadata) => {
    try {
      const url = await getFileUrl(file);
      setImageUrl(url);
      setSelectedImage(file);
      setError("");
      setEgyptianIDResult(null);
      setPassportResult(null);
      setDebugInfo(null);
      setCompressionInfo(null);
    } catch (err) {
      setError("Failed to load image URL");
      console.error(err);
    }
  };

  const handleRunOcr = async () => {
    if (!selectedImage) return;
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
          const compressedFile = await compressImageFile(
            new File([imageBlob], "img.jpg", { type: imageBlob.type })
          );
          imageBlob = compressedFile;

          setCompressionInfo({
            originalSize,
            compressedSize: imageBlob.size,
            compressionRatio: imageBlob.size / originalSize
          });
        } catch (compressionError) {
          console.warn("Compression failed, using original:", compressionError);
        } finally {
          setCompressing(false);
        }
      }

      if (ocrType === "egyptian") {
        egyptianIDMutation.mutate(imageBlob, {
          onSuccess: (data) => {
            if (data.success && data.extracted_data) {
              setEgyptianIDResult(data.extracted_data);
              setDebugInfo(data.debug_info || null);
            } else {
              setError("Egyptian ID OCR processing failed: " + (data.error || "Unknown error"));
            }
          },
          onError: (err) => {
            setError("Failed to process Egyptian ID OCR: " + err.message);
            console.error(err);
          },
        });
      } else {
        passportMutation.mutate(imageBlob, {
          onSuccess: (data) => {
            if (data.success && data.data) {
              setPassportResult(data.data);
              setDebugInfo(data.debug_info || null);
            } else {
              setError("Passport OCR processing failed: " + (data.error || "Unknown error"));
            }
          },
          onError: (err) => {
            setError("Failed to process Passport OCR: " + err.message);
            console.error(err);
          },
        });
      }
    } catch (err) {
      setError("Failed to process image");
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700 flex space-x-6">
        <button
          onClick={() => setActiveTab("process")}
          className={`px-4 py-2 -mb-px font-medium border-b-2 transition ${activeTab === "process"
            ? "border-blue-600 text-blue-600 dark:text-blue-400"
            : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
        >
          OCR Processor
        </button>
        <button
          onClick={() => setActiveTab("results")}
          className={`px-4 py-2 -mb-px font-medium border-b-2 transition ${activeTab === "results"
            ? "border-blue-600 text-blue-600 dark:text-blue-400"
            : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
        >
          Stored Results
        </button>
        <button
          onClick={() => setActiveTab("debug")}
          className={`px-4 py-2 -mb-px font-medium border-b-2 transition ${activeTab === "debug"
            ? "border-blue-600 text-blue-600 dark:text-blue-400"
            : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          disabled={!debugInfo}
        >
          <Bug className="w-4 h-4 mr-1 inline" />
          Debug Info
        </button>
      </div>

      {/* Process Tab */}
      {activeTab === "process" && (
        <div>
          {/* OCR Type Switch */}
          <div className="flex space-x-6 mb-6">
            <button
              onClick={() => setOcrType("egyptian")}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition ${ocrType === "egyptian"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-600/20 dark:text-blue-300"
                : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
            >
              <Flag className="w-4 h-4 mr-2" />
              Egyptian ID
            </button>
            <button
              onClick={() => setOcrType("passport")}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition ${ocrType === "passport"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-600/20 dark:text-blue-300"
                : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
            >
              <ScanText className="w-4 h-4 mr-2" />
              Passport
            </button>
          </div>

          {/* Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sidebar */}
            <div className="bg-white dark:bg-glass border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Select Image
              </h3>
              {imageFiles.length === 0 ? (
                <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                  <Image className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  No images available
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {imageFiles.map((file) => (
                    <button
                      key={file.path}
                      onClick={() => handleImageSelect(file)}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition ${selectedImage?.path === file.path
                        ? "bg-blue-50 dark:bg-blue-600/20 border-blue-500 text-blue-600 dark:text-blue-200"
                        : "border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-300 text-gray-700 dark:text-gray-300"
                        }`}
                    >
                      <div className="flex items-center min-w-0">
                        <Image className="w-4 h-4 text-blue-500 mr-2" />
                        <span className="truncate">{file.path}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Main Panel */}
            <div className="lg:col-span-2 bg-white dark:bg-glass border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                OCR Preview & Results
              </h3>

              {!selectedImage ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400">
                  <ScanText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  Select an image to begin
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600">
                    <img
                      src={imageUrl}
                      alt={selectedImage.path}
                      className="w-full h-auto max-h-96 object-contain"
                    />
                  </div>

                  {/* Compression Status */}
                  {compressing && (
                    <div className="flex items-center justify-center space-x-2 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                      <Zap className="w-5 h-5 text-blue-500 animate-pulse" />
                      <span className="text-blue-700 dark:text-blue-300">Compressing image...</span>
                    </div>
                  )}

                  {compressionInfo && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                      <div className="flex items-center justify-center space-x-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800 dark:text-green-300">Image Compressed</span>
                      </div>
                      <div className="text-xs text-green-700 dark:text-green-400 space-y-1">
                        <div>Original: {(compressionInfo.originalSize / 1024 / 1024).toFixed(2)} MB</div>
                        <div>Compressed: {(compressionInfo.compressedSize / 1024 / 1024).toFixed(2)} MB</div>
                        <div>Space saved: {((1 - compressionInfo.compressionRatio) * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                  )}

                  <div className="text-center">
                    <button
                      onClick={handleRunOcr}
                      disabled={
                        ocrMutation.isPending ||
                        egyptianIDMutation.isPending ||
                        passportMutation.isPending ||
                        compressing
                      }
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition flex items-center justify-center mx-auto disabled:opacity-50"
                    >
                      {(ocrMutation.isPending ||
                        egyptianIDMutation.isPending ||
                        passportMutation.isPending) && (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Processing
                          </>
                        )}
                      {compressing && (
                        <>
                          <Zap className="w-5 h-5 animate-pulse mr-2" /> Compressing
                        </>
                      )}
                      {!ocrMutation.isPending &&
                        !egyptianIDMutation.isPending &&
                        !passportMutation.isPending &&
                        !compressing && (
                          <>
                            {ocrType === "egyptian" ? (
                              <Flag className="w-5 h-5 mr-2" />
                            ) : (
                              <ScanText className="w-5 h-5 mr-2" />
                            )}
                            Run {ocrType === "egyptian" ? "Egyptian ID" : "Passport"} OCR
                          </>
                        )}
                    </button>
                  </div>

                  {error && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-800 dark:text-red-300">
                      <AlertCircle className="w-4 h-4 inline mr-2" />
                      {error}
                    </div>
                  )}

                  {/* Egyptian ID Results */}
                  {egyptianIDResult && (
                    <div className="mt-6 space-y-4">
                      <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
                        <Flag className="w-5 h-5 mr-2 text-green-600" />
                        Egyptian ID Information
                      </h4>
                      <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4 border border-green-200 dark:border-green-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Full Name</label>
                            <p className="text-gray-900 dark:text-gray-100 font-medium">{egyptianIDResult.full_name}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">National ID</label>
                            <p className="text-gray-900 dark:text-gray-100 font-mono">{egyptianIDResult.national_id}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Birth Date</label>
                            <p className="text-gray-900 dark:text-gray-100">{egyptianIDResult.birth_date}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Gender</label>
                            <p className="text-gray-900 dark:text-gray-100">{egyptianIDResult.gender}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Governorate</label>
                            <p className="text-gray-900 dark:text-gray-100">{egyptianIDResult.governorate}</p>
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Address</label>
                            <p className="text-gray-900 dark:text-gray-100">{egyptianIDResult.address}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Passport Results */}
                  {passportResult && (
                    <div className="mt-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <ScanText className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Passport Information</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Extracted from Machine Readable Zone</p>
                          </div>
                        </div>
                        <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-medium rounded-full">
                          Verified
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-700 shadow-sm">
                        <div className="p-6">
                          <div className="mb-6">
                            <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4 flex items-center">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                              Personal Information
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Surname</label>
                                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{passportResult.surname}</p>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Given Name</label>
                                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{passportResult.name}</p>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date of Birth</label>
                                <p className="text-lg font-medium text-gray-900 dark:text-gray-100">{passportResult.date_of_birth}</p>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sex</label>
                                <p className="text-lg font-medium text-gray-900 dark:text-gray-100">{passportResult.sex}</p>
                              </div>
                            </div>
                          </div>

                          <div className="mb-6">
                            <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4 flex items-center">
                              <div className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></div>
                              Passport Details
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Passport Number</label>
                                <p className="text-lg font-mono font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border">{passportResult.passport_number}</p>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Passport Type</label>
                                <p className="text-lg font-medium text-gray-900 dark:text-gray-100">{passportResult.passport_type}</p>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Expiration Date</label>
                                <p className="text-lg font-medium text-gray-900 dark:text-gray-100">{passportResult.expiration_date}</p>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Issuing Country</label>
                                <p className="text-lg font-medium text-gray-900 dark:text-gray-100">{passportResult.issuing_country}</p>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4 flex items-center">
                              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                              Citizenship
                            </h5>
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nationality</label>
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-sm shadow-sm"></div>
                                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{passportResult.nationality}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Results Tab */}
      {activeTab === "results" && (
        <div className="mt-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center mb-4">
            <Database className="w-5 h-5 mr-2 text-blue-600" />
            Stored OCR Results
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Egyptian ID Results */}
            <div className="bg-white dark:bg-glass border border-gray-200 dark:border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                <Flag className="w-5 h-5 mr-2 text-green-600" />
                Egyptian ID Results ({egyptianIdResults?.length || 0})
              </h3>
              {!egyptianIdResults || egyptianIdResults.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-6">
                  No results stored
                </p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {egyptianIdResults.map(([path, data], idx) => {
                    try {
                      const parsed = JSON.parse(data);
                      return (
                        <div
                          key={idx}
                          className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                        >
                          <div className="flex justify-between text-sm font-medium">
                            <span className="truncate">{path}</span>
                            <span className="flex items-center text-gray-500 dark:text-gray-400">
                              <Clock className="w-3 h-3 mr-1" />
                              {parsed.processing_time}s
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-medium">Name:</span>{" "}
                            {parsed.extracted_data?.full_name || "N/A"}
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-medium">ID:</span>{" "}
                            {parsed.extracted_data?.national_id || "N/A"}
                          </p>
                        </div>
                      );
                    } catch {
                      return (
                        <p
                          key={idx}
                          className="text-sm text-red-600 dark:text-red-400"
                        >
                          Error parsing {path}
                        </p>
                      );
                    }
                  })}
                </div>
              )}
            </div>

            {/* Passport Results */}
            <div className="bg-white dark:bg-glass border border-gray-200 dark:border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                <ScanText className="w-5 h-5 mr-2 text-blue-600" />
                Passport Results ({passportResults?.length || 0})
              </h3>
              {!passportResults || passportResults.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-6">
                  No results stored
                </p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {passportResults.map(([path, data], idx) => {
                    try {
                      const parsed = JSON.parse(data);
                      return (
                        <div
                          key={idx}
                          className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                        >
                          <div className="flex justify-between text-sm font-medium">
                            <span className="truncate">{path}</span>
                            <span className="flex items-center text-gray-500 dark:text-gray-400">
                              <Clock className="w-3 h-3 mr-1" />
                              {parsed.processing_time}s
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-medium">Name:</span>{" "}
                            {parsed.data?.surname} {parsed.data?.name}
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-medium">Passport:</span>{" "}
                            {parsed.data?.passport_number || "N/A"}
                          </p>
                        </div>
                      );
                    } catch {
                      return (
                        <p
                          key={idx}
                          className="text-sm text-red-600 dark:text-red-400"
                        >
                          Error parsing {path}
                        </p>
                      );
                    }
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Debug Tab */}
      {activeTab === "debug" && debugInfo && (
        <div className="mt-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center mb-4">
            <Bug className="w-5 h-5 mr-2 text-purple-600" />
            Debug Information
          </h2>

          <div className="space-y-6">
            {/* Detection Info */}
            <div className="bg-white dark:bg-glass border border-gray-200 dark:border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                <ScanText className="w-5 h-5 mr-2 text-blue-600" />
                Field Detection Results
              </h3>
              {debugInfo.detected_fields && debugInfo.detected_fields.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {debugInfo.detected_fields.map((field, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{field.class}</span>
                        <span className={`text-sm px-2 py-1 rounded-full ${field.confidence > 0.8
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          : field.confidence > 0.6
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                          }`}>
                          {(field.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Box: [{field.bbox?.map(b => b.toFixed(0)).join(', ')}]
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-6">
                  No field detection data available
                </p>
              )}
            </div>

            {/* Debug Images */}
            <div className="bg-white dark:bg-glass border border-gray-200 dark:border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                <Image className="w-5 h-5 mr-2 text-green-600" />
                Processing Pipeline Images
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {debugInfo.preprocessed_image_path && (
                  <a
                    href={`http://localhost:5000/debug-image/${debugInfo.preprocessed_image_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <Zap className="w-4 h-4 text-blue-500" />
                      <span className="font-medium text-gray-900 dark:text-gray-100">Preprocessed Image</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Auto-rotated, enhanced, and denoised</p>
                  </a>
                )}
                {debugInfo.debug_image_path && (
                  <a
                    href={`http://localhost:5000/debug-image/${debugInfo.debug_image_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <ScanText className="w-4 h-4 text-purple-500" />
                      <span className="font-medium text-gray-900 dark:text-gray-100">Annotated Detection</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Image with detected field overlays</p>
                  </a>
                )}
                {debugInfo.cropped_image_path && (
                  <a
                    href={`http://localhost:5000/debug-image/${debugInfo.cropped_image_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <Image className="w-4 h-4 text-green-500" />
                      <span className="font-medium text-gray-900 dark:text-gray-100">Cropped Document</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Extracted document region</p>
                  </a>
                )}
                {debugInfo.yolo_output_path && (
                  <a
                    href={`http://localhost:5000/debug-image/${debugInfo.yolo_output_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <Bug className="w-4 h-4 text-orange-500" />
                      <span className="font-medium text-gray-900 dark:text-gray-100">YOLO Output</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Raw AI detection results</p>
                  </a>
                )}
                {debugInfo.mrz_roi_path && (
                  <a
                    href={`http://localhost:5000/debug-image/${debugInfo.mrz_roi_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <Flag className="w-4 h-4 text-indigo-500" />
                      <span className="font-medium text-gray-900 dark:text-gray-100">MRZ Region</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Machine Readable Zone extraction</p>
                  </a>
                )}
              </div>
            </div>

            {/* Technical Details */}
            {debugInfo.mrz_detected && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                  MRZ Processing Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-2 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">MRZ Detected</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Machine readable zone found</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-2 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <ScanText className="w-6 h-6 text-blue-600" />
                    </div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">OCR Applied</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Text extracted successfully</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-2 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                      <Database className="w-6 h-6 text-purple-600" />
                    </div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Data Parsed</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Fields structured and validated</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}