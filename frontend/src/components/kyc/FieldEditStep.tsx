"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GlassCard from "./GlassCard";
import { CheckCircle, Edit3, Save, X } from "lucide-react";
import { toast } from "sonner";
import { verifyFace, convertFileToBase64 } from "../../services/faceVerification";
import { CameraCapture } from "./CameraCapture";

interface FieldEditStepProps {
  ocrData: Record<string, string>;
  faceImage: string;
  onNext: (editedData: Record<string, string>) => void;
  onBack: () => void;
}

export function FieldEditStep({ ocrData, faceImage, onNext, onBack }: FieldEditStepProps) {
  const [editedData, setEditedData] = useState<Record<string, string>>(ocrData);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [isIdentityVerified, setIsIdentityVerified] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [lastSelfieTimestamp, setLastSelfieTimestamp] = useState<number | null>(null);

  const fieldsToShow = [
    { key: 'full_name', label: 'Full Name', required: true, fallbackKeys: ['first_name', 'second_name', 'name'] },
    { key: 'national_id', label: 'National ID', required: true, fallbackKeys: ['id', 'national_id_number'] },
    { key: 'address', label: 'Address', required: true, fallbackKeys: ['location', 'residence'] },
    { key: 'birth_date', label: 'Birth Date', required: false, fallbackKeys: ['date_of_birth', 'birthday'] },
    { key: 'gender', label: 'Gender', required: false, fallbackKeys: ['sex'] },
    { key: 'governorate', label: 'Governorate', required: false, fallbackKeys: ['state', 'province'] }
  ];

  const getFieldValue = (fieldKey: string, fallbackKeys: string[] = []) => {
    // First try the main key
    let value = editedData[fieldKey];
    if (value) return value;
    
    // Then try fallback keys
    for (const fallbackKey of fallbackKeys) {
      value = editedData[fallbackKey];
      if (value) return value;
    }
    
    // If still no value, try to construct full_name from first_name and second_name
    if (fieldKey === 'full_name') {
      const firstName = editedData['first_name'] || editedData['firstName'];
      const secondName = editedData['second_name'] || editedData['secondName'];
      if (firstName && secondName) {
        return `${firstName} ${secondName}`;
      }
      if (firstName) return firstName;
      if (secondName) return secondName;
    }
    
    return '';
  };

  const handleFieldEdit = (key: string, value: string) => {
    setEditedData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveField = (key: string) => {
    setEditingField(null);
    toast.success(`${fieldsToShow.find(f => f.key === key)?.label} updated`);
  };

  const handleCameraCapture = (file: File) => {
    setSelfieFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelfiePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    setShowCamera(false);
    
    // Clear previous verification results when new selfie is captured
    setVerificationResult(null);
    setIsIdentityVerified(false);
    setLastSelfieTimestamp(Date.now());
  };

  const handleCameraCancel = () => {
    setShowCamera(false);
  };

  const handleVerifyIdentity = async () => {
    if (!selfieFile) {
      toast.error("Please capture a selfie first");
      return;
    }

    const requestId = Date.now() + Math.random();
    console.log(`Starting face verification ${requestId} with new selfie:`, selfieFile.name, 'File size:', selfieFile.size);
    setIsVerifying(true);
    try {
      // Convert selfie to base64
      const selfieBase64 = await convertFileToBase64(selfieFile);
      console.log(`Selfie ${requestId} converted to base64, length:`, selfieBase64.length);
      
      // Call the face verification API
      const result = await verifyFace(faceImage, selfieBase64);
      console.log(`Face verification ${requestId} result:`, result);
      
      setVerificationResult(result.verification_result);
      
      if (result.verification_result.is_match) {
        setIsIdentityVerified(true);
        toast.success("Identity verified successfully! You can now edit the information.");
      } else {
        toast.error(`Identity verification failed. Similarity: ${(result.verification_result.similarity_score * 100).toFixed(1)}%. Please try again with a clearer selfie.`);
      }
    } catch (error) {
      console.error(`Verification ${requestId} error:`, error);
      toast.error(error instanceof Error ? error.message : "Verification failed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = () => {
    if (!verificationResult?.is_match) {
      toast.error("Please verify your identity first");
      return;
    }
    onNext(editedData);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -40 }}
      className="w-full max-w-4xl mx-auto"
    >
      <GlassCard>
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center"
          >
            <Edit3 className="w-8 h-8 text-white" />
          </motion.div>
          
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-bold text-gray-900 dark:text-white mb-2"
          >
            Verify Identity & Edit Information
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-gray-600 dark:text-gray-300"
          >
            Please verify your identity and review the extracted information
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Face Verification Section */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Identity Verification
              </h3>
              
              {/* Face from ID */}
              <div className="mb-4">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Face from ID Document
                </Label>
                <div className="w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden">
                  {faceImage ? (
                    <img 
                      src={`data:image/jpeg;base64,${faceImage}`} 
                      alt="Face from ID" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-gray-500 dark:text-gray-400">No face detected</div>
                  )}
                </div>
              </div>

              {/* Selfie Capture */}
              <div className="mb-4">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Take a Selfie
                </Label>
                <div className="space-y-3">
                  <div
                    className="w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border-2 border-dashed border-gray-300 dark:border-gray-600"
                    onClick={() => setShowCamera(true)}
                  >
                    {selfiePreview ? (
                      <img 
                        src={selfiePreview} 
                        alt="Selfie preview" 
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <div className="text-center">
                        <div className="relative">
                          <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Tap to take a selfie with camera</p>
                      </div>
                    )}
                  </div>
                  {selfieFile && (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="flex flex-col items-center">
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Selfie captured: {selfieFile.name}
                        </p>
                        {lastSelfieTimestamp && (
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            Captured: {new Date(lastSelfieTimestamp).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowCamera(true)}
                        className="text-xs h-6 px-2"
                      >
                        Retake
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Verification Status */}
              {verificationResult && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-lg border ${
                    verificationResult.is_match
                      ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      verificationResult.is_match
                        ? "bg-emerald-100 dark:bg-emerald-800"
                        : "bg-red-100 dark:bg-red-800"
                    }`}>
                      {verificationResult.is_match ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <X className="w-5 h-5 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${
                        verificationResult.is_match
                          ? "text-emerald-800 dark:text-emerald-200"
                          : "text-red-800 dark:text-red-200"
                      }`}>
                        {verificationResult.is_match ? "Identity Verified" : "Verification Failed"}
                      </p>
                      <p className={`text-xs ${
                        verificationResult.is_match
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}>
                        Similarity: {(verificationResult.similarity_score * 100).toFixed(1)}% • {verificationResult.confidence} confidence
                        {lastSelfieTimestamp && (
                          <span className="ml-2 text-gray-500">
                            • Verified: {new Date(lastSelfieTimestamp).toLocaleTimeString()}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Verify Button */}
              {!verificationResult && (
                <div className="space-y-2">
                  <Button
                    onClick={handleVerifyIdentity}
                    disabled={isVerifying || !selfieFile}
                    className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isVerifying ? (
                      <div className="flex items-center space-x-2">
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Verifying...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5" />
                        <span>Verify Identity</span>
                      </div>
                    )}
                  </Button>
                  {lastSelfieTimestamp && (
                    <p className="text-xs text-center text-blue-600 dark:text-blue-400">
                      ✨ Fresh selfie captured - verification will use new image
                    </p>
                  )}
                </div>
              )}

              {/* Retry Verification Button */}
              {verificationResult && !verificationResult.is_match && (
                <Button
                  onClick={handleVerifyIdentity}
                  disabled={isVerifying || !selfieFile}
                  className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isVerifying ? (
                    <div className="flex items-center space-x-2">
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Retrying...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Retry Verification</span>
                    </div>
                  )}
                </Button>
              )}

              {/* Clear Verification Button (for successful verification) */}
              {verificationResult && verificationResult.is_match && (
                <Button
                  onClick={() => {
                    setVerificationResult(null);
                    setIsIdentityVerified(false);
                    setSelfieFile(null);
                    setSelfiePreview(null);
                    setLastSelfieTimestamp(null);
                  }}
                  variant="outline"
                  className="w-full h-10 text-sm font-medium border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Take New Selfie</span>
                  </div>
                </Button>
              )}
            </div>
          </div>

          {/* Field Editing Section */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Edit Information
              </h3>
              {!isIdentityVerified ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-800 flex items-center justify-center">
                      <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Identity verification required
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Please verify your identity by taking a selfie before you can edit the information.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  ✅ Identity verified! You can now edit the extracted information.
                </p>
              )}
            </div>

            <div className="space-y-4">
              {fieldsToShow.map(({ key, label, required }) => (
                <div key={key} className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {label} {required && <span className="text-red-500">*</span>}
                  </Label>
                  
                  {editingField === key ? (
                    <div className="flex space-x-2">
                      <Input
                        value={getFieldValue(key, fieldsToShow.find(f => f.key === key)?.fallbackKeys)}
                        onChange={(e) => handleFieldEdit(key, e.target.value)}
                        className="flex-1"
                        autoFocus
                        disabled={!isIdentityVerified}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSaveField(key)}
                        className="bg-emerald-500 hover:bg-emerald-600"
                        disabled={!isIdentityVerified}
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingField(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        isIdentityVerified
                          ? "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                          : "bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-600 cursor-not-allowed opacity-60"
                      }`}
                      onClick={() => isIdentityVerified && setEditingField(key)}
                    >
                      <span className="text-gray-900 dark:text-white">
                        {getFieldValue(key, fieldsToShow.find(f => f.key === key)?.fallbackKeys) || 'Not available'}
                      </span>
                      <Edit3 className={`w-4 h-4 ${isIdentityVerified ? 'text-gray-400' : 'text-gray-300'}`} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!isIdentityVerified}
              className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5" />
                <span>{isIdentityVerified ? "Submit Changes" : "Verify Identity First"}</span>
              </div>
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Camera Capture Modal */}
      <CameraCapture
        isOpen={showCamera}
        onCapture={handleCameraCapture}
        onCancel={handleCameraCancel}
      />
    </motion.div>
  );
}
