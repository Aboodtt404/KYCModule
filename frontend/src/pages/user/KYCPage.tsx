"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { useStepper } from "../../../hooks/useStepper";

import StepperHeader from "@/components/kyc/StepperHeader";

import OTPStep from "@/components/kyc/OTPStep";
import { DocumentStep } from "@/components/kyc/DocumentStep";
import ReviewStep from "@/components/kyc/ReviewStep";
import SuccessStep from "@/components/kyc/SuccessStep";
import LogoHero from "@/components/kyc/ThreeHero";
import { OcrResultStep } from "@/components/kyc/OcrResultStep";
import { FieldEditStep } from "@/components/kyc/FieldEditStep";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

<<<<<<< HEAD
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
=======
export default function KYCPage() {
  const totalSteps = 6;
  const { step, next, prev, skipToEnd, percent } = useStepper(totalSteps);

  // shared data
  const [phone, setPhone] = useState<string>();
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [selfieCaptured, setSelfieCaptured] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        {/* Stepper header */}
        <StepperHeader step={step} total={totalSteps} percent={percent} />

        {/* Animated step content */}
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4 }}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl"
        >
          {step === 1 && (
            <div className="space-y-6 text-center">
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
                onClick={next}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 text-black font-semibold transition transform hover:scale-105 hover:shadow-[0_0_10px_rgba(0,255,136,0.6)]"
              >
                Start Verification
              </button>
            </div>
          )}

          {step === 2 && <OTPStep onNext={next} onSent={setPhone} />}
          {step === 3 && <DocumentStep onNext={next} onUploaded={setDocumentFile} />}
          {step === 4 && (
            <SelfieStep
              onNext={() => {
                setSelfieCaptured(true);
                next();
              }}
              onCapture={() => setSelfieCaptured(true)}
            />
          )}
          {step === 5 && (
            <ReviewStep
              onSubmit={next}
              summary={{
                phone,
                documentName: documentFile?.name,
                selfieCaptured,
              }}
            />
          )}
          {step === 6 && <SuccessStep onDone={() => {}} />}
        </motion.div>

        {/* Navigation controls */}
        <div className="mt-6 flex justify-between text-xs text-gray-400">
          <button
            onClick={prev}
            className={`px-3 py-2 rounded-md transition ${
              step === 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-white/10"
            }`}
            disabled={step === 1}
          >
            Back
          </button>
          <button
            onClick={skipToEnd}
            className="px-3 py-2 rounded-md hover:bg-white/10"
          >
            Skip to end
          </button>
        </div>
>>>>>>> b39fae27837b325f504d18fa1cdb95f3f4517997
      </div>
    </div>
  );
}
