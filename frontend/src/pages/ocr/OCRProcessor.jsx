import React, { useState } from "react";
import {
  useDocuments,
  useOCR,
  useEgyptianIDOCR,
  usePassportOCR,
  useEgyptianIdResults,
  usePassportResults,
} from "../../hooks/useQueries";
import { useFileList } from "../../components/shared/FileList";
import { useImageCompression } from "../../hooks/useImageCompression";
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

  const imageFiles = documents?.filter((doc) =>
    doc.mimeType.startsWith("image/")
  ) || [];

  const { compressImageFile, compressionResult, needsCompressionCheck } =
    useImageCompression({
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

      // compression
      const needsCompression = needsCompressionCheck(
        new File([imageBlob], "img.jpg")
      );
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
            compressionRatio: imageBlob.size / originalSize,
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
              setError(
                "Egyptian ID OCR processing failed: " +
                  (data.error || "Unknown error")
              );
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
              setError(
                "Passport OCR processing failed: " +
                  (data.error || "Unknown error")
              );
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
    <div className="max-w-6xl mx-auto font-inter">
      {/* Tabs */}
      <div className="mb-6 border-b border-gray-700 flex space-x-6">
        <button
          onClick={() => setActiveTab("process")}
          className={`px-4 py-2 -mb-px font-medium border-b-2 transition rounded-md ${
            activeTab === "process"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          OCR Processor
        </button>

        <button
          onClick={() => setActiveTab("results")}
          className={`px-4 py-2 -mb-px font-medium border-b-2 transition rounded-md ${
            activeTab === "results"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          Stored Results
        </button>

        <button
          onClick={() => setActiveTab("debug")}
          className={`px-4 py-2 -mb-px font-medium border-b-2 transition rounded-md ${
            activeTab === "debug"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-gray-400 hover:text-white"
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
          <div className="flex space-x-4 mb-6">
            <button
              onClick={() => setOcrType("egyptian")}
              className={`flex items-center px-3 py-2 rounded-full text-sm font-medium transition shadow-sm ${
                ocrType === "egyptian"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-indigo-100 hover:bg-gradient-to-r from-indigo-500 to-indigo-700 hover:text-white"
              }`}
            >
              <Flag className="w-4 h-4 mr-2" />
              Egyptian ID
            </button>

            <button
              onClick={() => setOcrType("passport")}
              className={`flex items-center px-3 py-2 rounded-full text-sm font-medium transition shadow-sm ${
                ocrType === "passport"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-indigo-100 hover:bg-gradient-to-r from-indigo-500 to-indigo-700 hover:text-white"
              }`}
            >
              <ScanText className="w-4 h-4 mr-2" />
              Passport
            </button>
          </div>

          {/* Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sidebar */}
            <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl shadow-lg border border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Select Image
              </h3>

              {imageFiles.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Image className="mx-auto h-12 w-12 mb-4 opacity-60" />
                  No images available
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {imageFiles.map((file) => (
                    <button
                      key={file.path}
                      onClick={() => handleImageSelect(file)}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition flex items-center min-w-0 ${
                        selectedImage?.path === file.path
                          ? "bg-indigo-700/30 border-indigo-500 text-white"
                          : "border-slate-700 text-slate-100 hover:border-indigo-500"
                      }`}
                    >
                      <Image className="w-4 h-4 text-indigo-300 mr-2" />
                      <span className="truncate">{file.path}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Main Panel */}
            <div className="lg:col-span-2 bg-slate-800/60 backdrop-blur-md rounded-2xl shadow-lg border border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                OCR Preview & Results
              </h3>

              {!selectedImage ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-700 rounded-xl text-gray-400">
                  <ScanText className="mx-auto h-12 w-12 mb-4 opacity-60" />
                  Select an image to begin
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-xl overflow-hidden border border-slate-700">
                    <img
                      src={imageUrl}
                      alt={selectedImage.path}
                      className="w-full h-auto max-h-96 object-contain"
                    />
                  </div>

                  {/* Compression Status */}
                  {compressing && (
                    <div className="flex items-center justify-center space-x-2 p-3 bg-indigo-900/20 rounded-lg">
                      <Zap className="w-5 h-5 text-indigo-300 animate-pulse" />
                      <span className="text-indigo-200">Compressing image...</span>
                    </div>
                  )}

                  {compressionInfo && (
                    <div className="p-3 bg-green-900/10 rounded-lg border border-green-800/20">
                      <div className="flex items-center justify-center space-x-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-medium text-green-300">
                          Image Compressed
                        </span>
                      </div>
                      <div className="text-xs text-green-200 space-y-1">
                        <div>
                          Original:{" "}
                          {(compressionInfo.originalSize / 1024 / 1024).toFixed(
                            2
                          )}{" "}
                          MB
                        </div>
                        <div>
                          Compressed:{" "}
                          {(compressionInfo.compressedSize / 1024 / 1024).toFixed(
                            2
                          )}{" "}
                          MB
                        </div>
                        <div>
                          Space saved:{" "}
                          {(
                            (1 - compressionInfo.compressionRatio) *
                            100
                          ).toFixed(1)}
                          %
                        </div>
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
                      className="bg-gradient-to-r from-indigo-500 to-indigo-700 text-white px-6 py-3 rounded-full hover:shadow-lg transition flex items-center justify-center mx-auto disabled:opacity-50"
                    >
                      {(ocrMutation.isPending ||
                        egyptianIDMutation.isPending ||
                        passportMutation.isPending) && (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />{" "}
                          Processing
                        </>
                      )}

                      {compressing && (
                        <>
                          <Zap className="w-5 h-5 animate-pulse mr-2" />{" "}
                          Compressing
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
                            Run {ocrType === "egyptian" ? "Egyptian ID" : "Passport"}{" "}
                            OCR
                          </>
                        )}
                    </button>
                  </div>

                  {error && (
                    <div className="mt-4 p-3 bg-red-900/10 border border-red-800/30 rounded-lg text-sm text-red-300 flex items-center">
                      <AlertCircle className="w-4 h-4 inline mr-2" />
                      {error}
                    </div>
                  )}

                  {/* Egyptian ID Results */}
                  {egyptianIDResult && (
                    <div className="mt-6 space-y-4">
                      <h4 className="text-lg font-medium text-white flex items-center">
                        <Flag className="w-5 h-5 mr-2 text-green-400" />
                        Egyptian ID Information
                      </h4>
                      <div className="bg-green-900/10 rounded-lg p-4 border border-green-800/20">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-slate-300">
                              Full Name
                            </label>
                            <p className="text-white font-medium">
                              {egyptianIDResult.full_name}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-slate-300">
                              National ID
                            </label>
                            <p className="text-white font-mono">
                              {egyptianIDResult.national_id}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-slate-300">
                              Birth Date
                            </label>
                            <p className="text-white">
                              {egyptianIDResult.birth_date}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-slate-300">
                              Gender
                            </label>
                            <p className="text-white">
                              {egyptianIDResult.gender}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-slate-300">
                              Governorate
                            </label>
                            <p className="text-white">
                              {egyptianIDResult.governorate}
                            </p>
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-sm font-medium text-slate-300">
                              Address
                            </label>
                            <p className="text-white">
                              {egyptianIDResult.address}
                            </p>
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
                          <div className="p-2 bg-indigo-900/20 rounded-lg">
                            <ScanText className="w-6 h-6 text-indigo-300" />
                          </div>
                          <div>
                            <h4 className="text-xl font-semibold text-white">
                              Passport Information
                            </h4>
                            <p className="text-sm text-slate-300">
                              Extracted from Machine Readable Zone
                            </p>
                          </div>
                        </div>
                        <div className="px-3 py-1 bg-green-900/10 text-green-300 text-xs font-medium rounded-full">
                          Verified
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-indigo-900/5 to-indigo-800/10 rounded-xl border border-indigo-800/20 shadow-sm">
                        <div className="p-6">
                          <div className="mb-6">
                            <h5 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4 flex items-center">
                              <div className="w-2 h-2 bg-indigo-500 rounded-full mr-2" />
                              Personal Information
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                                  Surname
                                </label>
                                <p className="text-lg font-semibold text-white">
                                  {passportResult.surname}
                                </p>
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                                  Given Name
                                </label>
                                <p className="text-lg font-semibold text-white">
                                  {passportResult.name}
                                </p>
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                                  Date of Birth
                                </label>
                                <p className="text-lg font-medium text-white">
                                  {passportResult.date_of_birth}
                                </p>
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                                  Sex
                                </label>
                                <p className="text-lg font-medium text-white">
                                  {passportResult.sex}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="mb-6">
                            <h5 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4 flex items-center">
                              <div className="w-2 h-2 bg-indigo-500 rounded-full mr-2" />
                              Passport Details
                            </h5>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                                  Passport Number
                                </label>
                                <p className="text-lg font-mono font-semibold text-white bg-slate-900 px-3 py-2 rounded-lg border border-slate-700">
                                  {passportResult.passport_number}
                                </p>
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                                  Passport Type
                                </label>
                                <p className="text-lg font-medium text-white">
                                  {passportResult.passport_type}
                                </p>
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                                  Expiration Date
                                </label>
                                <p className="text-lg font-medium text-white">
                                  {passportResult.expiration_date}
                                </p>
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                                  Issuing Country
                                </label>
                                <p className="text-lg font-medium text-white">
                                  {passportResult.issuing_country}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h5 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4 flex items-center">
                              <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                              Citizenship
                            </h5>
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                                Nationality
                              </label>
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-4 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-sm shadow-sm" />
                                <p className="text-lg font-semibold text-white">
                                  {passportResult.nationality}
                                </p>
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
          <h2 className="text-xl font-bold text-white flex items-center mb-4">
            <Database className="w-5 h-5 mr-2 text-indigo-300" />
            Stored OCR Results
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Egyptian ID Results */}
            <div className="bg-slate-800/60 backdrop-blur-md rounded-xl p-6 border border-white/10 shadow-lg">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Flag className="w-5 h-5 mr-2 text-green-400" />
                Egyptian ID Results ({egyptianIdResults?.length || 0})
              </h3>

              {!egyptianIdResults || egyptianIdResults.length === 0 ? (
                <p className="text-gray-400 text-center py-6">No results stored</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {egyptianIdResults.map(([path, data], idx) => {
                    try {
                      const parsed = JSON.parse(data);
                      return (
                        <div
                          key={idx}
                          className="border border-slate-700 rounded-lg p-4 hover:bg-slate-900 transition"
                        >
                          <div className="flex justify-between text-sm font-medium">
                            <span className="truncate text-white">{path}</span>
                            <span className="flex items-center text-gray-400">
                              <Clock className="w-3 h-3 mr-1" />
                              {parsed.processing_time}s
                            </span>
                          </div>
                          <p className="text-sm text-slate-300">
                            <span className="font-medium text-white">Name:</span>{" "}
                            {parsed.extracted_data?.full_name || "N/A"}
                          </p>
                          <p className="text-sm text-slate-300">
                            <span className="font-medium text-white">ID:</span>{" "}
                            {parsed.extracted_data?.national_id || "N/A"}
                          </p>
                        </div>
                      );
                    } catch {
                      return (
                        <p
                          key={idx}
                          className="text-sm text-red-500 dark:text-red-400"
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
            <div className="bg-slate-800/60 backdrop-blur-md rounded-xl p-6 border border-white/10 shadow-lg">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <ScanText className="w-5 h-5 mr-2 text-indigo-300" />
                Passport Results ({passportResults?.length || 0})
              </h3>

              {!passportResults || passportResults.length === 0 ? (
                <p className="text-gray-400 text-center py-6">No results stored</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {passportResults.map(([path, data], idx) => {
                    try {
                      const parsed = JSON.parse(data);
                      return (
                        <div
                          key={idx}
                          className="border border-slate-700 rounded-lg p-4 hover:bg-slate-900 transition"
                        >
                          <div className="flex justify-between text-sm font-medium">
                            <span className="truncate text-white">{path}</span>
                            <span className="flex items-center text-gray-400">
                              <Clock className="w-3 h-3 mr-1" />
                              {parsed.processing_time}s
                            </span>
                          </div>
                          <p className="text-sm text-slate-300">
                            <span className="font-medium text-white">Name:</span>{" "}
                            {parsed.data?.surname} {parsed.data?.name}
                          </p>
                          <p className="text-sm text-slate-300">
                            <span className="font-medium text-white">
                              Passport:
                            </span>{" "}
                            {parsed.data?.passport_number || "N/A"}
                          </p>
                        </div>
                      );
                    } catch {
                      return (
                        <p
                          key={idx}
                          className="text-sm text-red-500 dark:text-red-400"
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
          <h2 className="text-xl font-bold text-white flex items-center mb-4">
            <Bug className="w-5 h-5 mr-2 text-purple-400" />
            Debug Information
          </h2>

          <div className="space-y-6">
            {/* Detection Info */}
            <div className="bg-slate-800/60 backdrop-blur-md rounded-xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <ScanText className="w-5 h-5 mr-2 text-indigo-300" />
                Field Detection Results
              </h3>

              {debugInfo.detected_fields && debugInfo.detected_fields.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {debugInfo.detected_fields.map((field, index) => (
                    <div
                      key={index}
                      className="border border-slate-700 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-white">
                          {field.class}
                        </span>
                        <span
                          className={`text-sm px-2 py-1 rounded-full ${
                            field.confidence > 0.8
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : field.confidence > 0.6
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                          }`}
                        >
                          {(field.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Box: [{field.bbox?.map((b) => b.toFixed(0)).join(", ")}]
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-6">
                  No field detection data available
                </p>
              )}
            </div>

            {/* Debug Images */}
            <div className="bg-slate-800/60 backdrop-blur-md rounded-xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Image className="w-5 h-5 mr-2 text-green-400" />
                Processing Pipeline Images
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {debugInfo.preprocessed_image_path && (
                  <a
                    href={`http://194.31.150.154:5000/debug-image/${debugInfo.preprocessed_image_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 border border-slate-700 rounded-lg hover:bg-slate-900 transition"
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <Zap className="w-4 h-4 text-indigo-300" />
                      <span className="font-medium text-white">
                        Preprocessed Image
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">
                      Auto-rotated, enhanced, and denoised
                    </p>
                  </a>
                )}

                {debugInfo.debug_image_path && (
                  <a
                    href={`http://194.31.150.154:5000/debug-image/${debugInfo.debug_image_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 border border-slate-700 rounded-lg hover:bg-slate-900 transition"
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <ScanText className="w-4 h-4 text-purple-400" />
                      <span className="font-medium text-white">Annotated Detection</span>
                    </div>
                    <p className="text-sm text-slate-400">
                      Image with detected field overlays
                    </p>
                  </a>
                )}

                {debugInfo.cropped_image_path && (
                  <a
                    href={`http://194.31.150.154:5000/debug-image/${debugInfo.cropped_image_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 border border-slate-700 rounded-lg hover:bg-slate-900 transition"
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <Image className="w-4 h-4 text-green-400" />
                      <span className="font-medium text-white">Cropped Document</span>
                    </div>
                    <p className="text-sm text-slate-400">Extracted document region</p>
                  </a>
                )}

                {debugInfo.yolo_output_path && (
                  <a
                    href={`http://194.31.150.154:5000/debug-image/${debugInfo.yolo_output_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 border border-slate-700 rounded-lg hover:bg-slate-900 transition"
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <Bug className="w-4 h-4 text-orange-400" />
                      <span className="font-medium text-white">YOLO Output</span>
                    </div>
                    <p className="text-sm text-slate-400">Raw AI detection results</p>
                  </a>
                )}

                {debugInfo.mrz_roi_path && (
                  <a
                    href={`http://194.31.150.154:5000/debug-image/${debugInfo.mrz_roi_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 border border-slate-700 rounded-lg hover:bg-slate-900 transition"
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <Flag className="w-4 h-4 text-indigo-300" />
                      <span className="font-medium text-white">MRZ Region</span>
                    </div>
                    <p className="text-sm text-slate-400">
                      Machine Readable Zone extraction
                    </p>
                  </a>
                )}
              </div>
            </div>

            {/* Technical Details */}
            {debugInfo.mrz_detected && (
              <div className="bg-gradient-to-r from-indigo-900/10 to-indigo-800/10 border border-indigo-800/20 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-400" />
                  MRZ Processing Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-2 bg-green-900/10 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-400" />
                    </div>
                    <p className="font-medium text-white">MRZ Detected</p>
                    <p className="text-sm text-slate-400">
                      Machine readable zone found
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-2 bg-indigo-900/10 rounded-full flex items-center justify-center">
                      <ScanText className="w-6 h-6 text-indigo-300" />
                    </div>
                    <p className="font-medium text-white">OCR Applied</p>
                    <p className="text-sm text-slate-400">Text extracted successfully</p>
                  </div>

                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-2 bg-purple-900/10 rounded-full flex items-center justify-center">
                      <Database className="w-6 h-6 text-purple-400" />
                    </div>
                    <p className="font-medium text-white">Data Parsed</p>
                    <p className="text-sm text-slate-400">Fields structured and validated</p>
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
