"use client";
import { useState } from "react";
import GlassCard from "./GlassCard";
import UploadBox from "./UploadBox";
import ThreeHero from "./ThreeHero";
import { Button } from "@/components/ui/button";
import { useActor } from "@/hooks/useActor";
import { useImageCompression } from "../../../hooks/useImageCompression";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";

interface DocumentStepProps {
  onNext: (ocrData: Record<string, string>, file: File, faceImage?: string) => void;
}

export function DocumentStep({ onNext }: DocumentStepProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<"id" | "passport">("id");
  const [error, setError] = useState<string | null>(null);
  const { actor } = useActor();
  const [isLoading, setIsLoading] = useState(false);

  const { compressImageFile, isCompressing } = useImageCompression({
    maxSizeKB: 500, // 500KB limit for IC compatibility
    autoCompress: true,
    showCompressionInfo: true
  });

  const { mutate: runEgyptianIdOcr, isPending: isEgyptianIdOcrPending } = useMutation({
    mutationFn: async (file: File) => {
      if (!actor) throw new Error('Backend not available');

      // Compress the image first to avoid payload too large error
      const compressedFile = await compressImageFile(file);

      // Convert compressed file to Uint8Array
      const arrayBuffer = await compressedFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // First upload the compressed image to get a path
      const path = `egyptian-id-${Date.now()}.jpg`;
      await actor.upload(path, 'image/jpeg', uint8Array, true);

      // Then call the OCR function with the path
      const result = await actor.getEgyptianIdOcr(path);

      // Parse the JSON result
      const ocrResult = JSON.parse(result);
      
      // Extract the actual data from the OCR result
      const ocrData = ocrResult.extracted_data || ocrResult;
      
      // Extract face image for verification
      const faceImage = ocrResult.face_verification?.face_image || null;
      
      return { ocrData, file: compressedFile, faceImage };
    },
    onSuccess: (data: any) => {
        toast.success("Document processed successfully!");
        onNext(data.ocrData, data.file, data.faceImage); // Pass OCR data, file, and face image to the parent
    },
    onError: (err) => {
        toast.error(`OCR failed: ${err.message}`);
        setIsLoading(false);
    },
  });

  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);
    setError(null);
  };

  const handleSubmit = () => {
    if (file) {
      setIsLoading(true);
      setError(null);
      if (fileType === 'id') {
        runEgyptianIdOcr(file);
      } else {
        // Placeholder for passport OCR
        toast.info("Passport processing is not yet implemented.");
        setIsLoading(false);
      }
    } else {
      setError("Please upload a document before proceeding.");
    }
  };

  const isProcessing = isLoading || isEgyptianIdOcrPending || isCompressing;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -40 }}
      className="w-full max-w-2xl mx-auto"
    >
      <GlassCard>
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center"
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </motion.div>
          
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-bold text-gray-900 dark:text-white mb-2"
          >
            Upload Your Document
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-gray-600 dark:text-gray-300"
          >
            Please upload a clear photo of your identity document for verification
          </motion.p>
        </div>

        <div className="space-y-6">
          {/* Document Type Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Document Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                  fileType === "id" 
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300" 
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300"
                }`}
                onClick={() => setFileType("id")}
              >
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium">National ID</span>
                </div>
              </button>
              
              <button
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                  fileType === "passport" 
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300" 
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300"
                }`}
                onClick={() => setFileType("passport")}
              >
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium">Passport</span>
                </div>
              </button>
            </div>
          </div>

          {/* File Upload Area */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Upload Document
            </label>
            <UploadBox onFile={handleFileChange} />
          </div>

          {/* Selected File Display */}
          {file && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                    {file.name}
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Error Display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-800 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    {error}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!file || isProcessing}
            className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <div className="flex items-center space-x-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Processing Document...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Submit and Continue</span>
              </div>
            )}
          </Button>
        </div>
      </GlassCard>
    </motion.div>
  );
}
