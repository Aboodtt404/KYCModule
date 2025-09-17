"use client";
import React, { useState } from "react";
import ProgressBar from "@/components/kyc/ProgressBar";
import StepIndicator from "@/components/kyc/StepIndicator";
import OTPStep from "@/components/kyc/OTPStep";
import { DocumentStep } from "@/components/kyc/DocumentStep";
import ReviewStep from "@/components/kyc/ReviewStep";
import SuccessStep from "@/components/kyc/SuccessStep";
import LogoHero from "@/components/kyc/ThreeHero";
import { OcrResultStep } from "@/components/kyc/OcrResultStep";
import { FieldEditStep } from "@/components/kyc/FieldEditStep";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

const TOTAL_STEPS = 6;

export function KYCPage() {
  const [step, setStep] = useState(1);
  const [userData, setUserData] = useState({
    phone: "",
    documentFile: null as File | null,
    ocrData: null as Record<string, string> | null,
    faceImage: null as string | null,
    editedData: null as Record<string, string> | null,
    needsEditing: false,
  });

  const handleNext = () => {
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS + 1));
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleOtpVerified = (phoneNumber: string) => {
    setUserData((prev) => ({ ...prev, phone: phoneNumber }));
    handleNext();
  };

  const handleDocumentSubmit = (ocrData: Record<string, string>, file: File, faceImage?: string) => {
    setUserData((prev) => ({
      ...prev,
      ocrData: ocrData,
      documentFile: file,
      faceImage: faceImage || null,
    }));
    handleNext();
  };

  const handleFieldEditSubmit = (editedData: Record<string, string>) => {
    setUserData((prev) => ({
      ...prev,
      editedData: editedData,
      needsEditing: false,
    }));
    handleNext();
  };

  const handleStartEditing = () => {
    setUserData((prev) => ({
      ...prev,
      needsEditing: true,
    }));
    handleNext();
  };

  const handleContinueWithoutEdit = () => {
    setUserData((prev) => ({
      ...prev,
      editedData: prev.ocrData, // Use original OCR data as final data
      needsEditing: false,
    }));
    handleNext();
  };


  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            key="step1"
          >
            <LogoHero onNext={handleNext} />
          </motion.div>
        );
      case 2:
        return <OTPStep onNext={handleOtpVerified} />;
      case 3:
        return <DocumentStep onNext={handleDocumentSubmit} />;
      case 4:
        return <OcrResultStep 
          ocrData={userData.ocrData || {}} 
          faceImage={userData.faceImage || ""}
          onNext={handleContinueWithoutEdit} 
          onEdit={handleStartEditing}
        />;
      case 5:
        if (userData.needsEditing) {
          return <FieldEditStep 
            ocrData={userData.ocrData || {}} 
            faceImage={userData.faceImage || ""}
            onNext={handleFieldEditSubmit}
            onBack={handleBack}
          />;
        } else {
          return <ReviewStep 
            userData={userData} 
            editedData={userData.editedData}
            onNext={handleNext} 
          />;
        }
      case 6:
        return <SuccessStep />;
      default:
        return <div>Invalid Step</div>;
    }
  };

  return (
    <div className="min-h-screen bg-background-gradient flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl mx-auto">
        {step <= TOTAL_STEPS && <ProgressBar value={(step / TOTAL_STEPS) * 100} />}
        
        <div className="mt-8">
          <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
        </div>

        {step < TOTAL_STEPS && step > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center mt-6"
          >
            <button
              onClick={handleBack}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Go Back</span>
            </button>
          </motion.div>
        )}

        {step <= TOTAL_STEPS && <StepIndicator step={step} total={TOTAL_STEPS} />}
      </div>
    </div>
  );
}
