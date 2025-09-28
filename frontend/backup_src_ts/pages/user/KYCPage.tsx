"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import ProgressBar from "@/components/kyc/ProgressBar";

import OTPStep from "@/components/kyc/OTPStep";
import DocumentStep from "@/components/kyc/DocumentStep";
import { OcrResultStep } from "@/components/kyc/OcrResultStep";
import { FieldEditStep } from "@/components/kyc/FieldEditStep";
import ReviewStep from "@/components/kyc/ReviewStep";
import SuccessStep from "@/components/kyc/SuccessStep";
import LogoHero from "@/components/kyc/ThreeHero";

const TOTAL_STEPS = 6;

// Progress calculation: only 100% when SuccessStep is reached
const getProgress = (step: number): number => {
  if (step < TOTAL_STEPS) {
    return Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 85);
  }
  return 100;
};

export default function KYCPage() {
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
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleOtpVerified = (phoneNumber: string) => {
    setUserData((prev) => ({ ...prev, phone: phoneNumber }));
    handleNext();
  };

  const handleDocumentSubmit = (
    ocrData: Record<string, string>,
    file: File,
    faceImage?: string
  ) => {
    setUserData((prev) => ({
      ...prev,
      ocrData,
      documentFile: file,
      faceImage: faceImage || null,
    }));
    handleNext();
  };

  const handleFieldEditSubmit = (editedData: Record<string, string>) => {
    setUserData((prev) => ({
      ...prev,
      editedData,
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
      editedData: prev.ocrData, // Use original OCR data
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
            className="space-y-6 text-center"
          >
            <div className="flex justify-center">
              <LogoHero className="max-h-40" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold mt-4">
                Verify your identity
              </h2>
              <p className="text-gray-300 text-sm sm:text-base mt-1">
                This process helps keep your account secure.
              </p>
            </div>
            <button
              onClick={handleNext}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 text-black font-semibold transition transform hover:scale-105 hover:shadow-[0_0_10px_rgba(0,255,136,0.6)]"
            >
              Start Verification
            </button>
          </motion.div>
        );
      case 2:
        return <OTPStep onNext={handleOtpVerified} />;
      case 3:
        return <DocumentStep onNext={handleDocumentSubmit} />;
      case 4:
        return (
          <OcrResultStep
            ocrData={userData.ocrData || {}}
            faceImage={userData.faceImage || ""}
            onNext={handleContinueWithoutEdit}
            onEdit={handleStartEditing}
          />
        );
      case 5:
        if (userData.needsEditing) {
          return (
            <FieldEditStep
              ocrData={userData.ocrData || {}}
              faceImage={userData.faceImage || ""}
              onNext={handleFieldEditSubmit}
              onBack={handleBack}
            />
          );
        } else {
          return (
            <ReviewStep
              userData={userData}
              editedData={userData.editedData}
              onNext={handleNext}
            />
          );
        }
      case 6:
        return <SuccessStep />;
      default:
        return <div>Invalid Step</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        {/* Progress Bar */}
        {step <= TOTAL_STEPS && <ProgressBar value={getProgress(step)} />}

        {/* Animated step content */}
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4 }}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl mt-8"
        >
          <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
        </motion.div>

        {/* Navigation controls */}
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
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span>Go Back</span>
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
