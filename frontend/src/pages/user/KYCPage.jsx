"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ProgressBar from "@/components/kyc/ProgressBar";
import OTPStep from "@/components/kyc/OTPStep";
import DocumentStep from "@/components/kyc/DocumentStep";
import { FaceVerificationStep } from "@/components/kyc/FaceVerificationStep";
import ReviewStep from "@/components/kyc/ReviewStep";
import SuccessStep from "@/components/kyc/SuccessStep";
import LogoHero from "@/components/kyc/ThreeHero";
import { useSubmitKYC } from "../../../useQueries";

const TOTAL_STEPS = 6; // Welcome → OTP → Document → Face → Review → Success

// Progress calculation: only 100% when SuccessStep is reached
const getProgress = (step) => {
    if (step < TOTAL_STEPS) {
        return Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 90);
    }
    return 100;
};

function calculateAge(birthDate) {
    if (!birthDate) return null;
    const today = new Date();
    const birthDateObj = new Date(birthDate);
    let age = today.getFullYear() - birthDateObj.getFullYear();
    const monthDifference = today.getMonth() - birthDateObj.getMonth();
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDateObj.getDate())) {
        age--;
    }
    return age;
}

export default function KYCPage() {
    const [step, setStep] = useState(1);
    const [submissionId, setSubmissionId] = useState(null);
    const [userData, setUserData] = useState({
        phone: "",
        documentFile: null,
        ocrData: null,
        faceImage: null,
        faceVerified: false,
    });
    const [submissionComplete, setSubmissionComplete] = useState(false);
    const submitKYC = useSubmitKYC();

    // Submit KYC data when reaching success step
    const handleFinalSubmit = (finalUserData) => {
        if (!submissionComplete && finalUserData.faceVerified) {
            // Filter ocrData to only include desired fields for submission
            const ocrDataForSubmission = (({
                full_name,
                national_id,
                birth_date,
                address,
                governorate,
                gender,
                face_image
            }) => ({
                full_name,
                national_id,
                birth_date,
                age: calculateAge(birth_date), // Calculate and add age
                address,
                governorate,
                gender,
                face_image
            }))(finalUserData.ocrData);

            const kycData = {
                submissionId,
                timestamp: new Date().toISOString(),
                phone: finalUserData.phone,
                documentFile: finalUserData.documentFile?.name || "N/A",
                ocrData: ocrDataForSubmission,
                faceVerified: finalUserData.faceVerified,
                status: "pending_review"
            };

            submitKYC.mutate({ submissionId, kycData }, {
                onSuccess: () => {
                    console.log("✅ KYC submission successful");
                    setSubmissionComplete(true);
                    setStep(TOTAL_STEPS); // Move to success step
                },
                onError: (error) => {
                    console.error("❌ KYC submission failed:", error);
                    // Optionally, show an error message to the user
                }
            });
        }
    };

    const handleNext = () => {
        setStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
    };
    const handleBack = () => {
        setStep((prev) => Math.max(prev - 1, 1));
    };
    const handleOtpVerified = (phoneNumber) => {
        setUserData((prev) => ({ ...prev, phone: phoneNumber }));
        const newSubmissionId = `kyc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setSubmissionId(newSubmissionId);
        handleNext();
    };
    const handleDocumentSubmit = (ocrData, file, faceImage) => {
        setUserData((prev) => ({
            ...prev,
            ocrData,
            documentFile: file,
            faceImage: faceImage || null,
        }));
        handleNext();
    };
    const handleFaceVerified = () => {
        setUserData((prev) => ({
            ...prev,
            faceVerified: true,
        }));
        handleNext();
    };

    const handleReviewComplete = (updatedOcrData) => {
        const finalUserData = {
            ...userData,
            ocrData: updatedOcrData,
        };
        setUserData(finalUserData);
        handleFinalSubmit(finalUserData);
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (<motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }} key="step1" className="space-y-6 text-center">
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
                    <button onClick={handleNext} className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 text-black font-semibold transition transform hover:scale-105 hover:shadow-[0_0_10px_rgba(0,255,136,0.6)]">
                        Start Verification
                    </button>
                </motion.div>);
            case 2:
                return <OTPStep onNext={handleOtpVerified} />;
            case 3:
                return (
                    <DocumentStep
                        submissionId={submissionId}
                        onNext={handleDocumentSubmit}
                        onUploaded={(file) =>
                            setUserData((prev) => ({ ...prev, documentFile: file }))
                        }
                    />
                );

            case 4:
                // Ensure the face image from the ID has the correct data URL prefix
                const idFaceImageWithPrefix = userData.faceImage && !userData.faceImage.startsWith('data:')
                    ? `data:image/jpeg;base64,${userData.faceImage}`
                    : userData.faceImage;

                return (
                    <FaceVerificationStep
                        idFaceImage={idFaceImageWithPrefix}
                        onVerified={handleFaceVerified}
                        onSkip={handleFaceVerified} // Allow skipping for testing
                    />
                );
            case 5:
                return (
                    <ReviewStep
                        userData={userData}
                        onNext={handleReviewComplete}
                    />
                );
            case 6:
                return <SuccessStep />;
            default:
                return <div>Invalid Step</div>;
        }
    };
    return (<div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-white flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">
            {/* Progress Bar */}
            {step < TOTAL_STEPS && <ProgressBar value={getProgress(step)} />}

            {/* Animated step content */}
            <motion.div key={step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl mt-8">
                <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
            </motion.div>

            {/* Navigation controls */}
            {step < TOTAL_STEPS && step > 1 && (<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center mt-6">
                <button onClick={handleBack} className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Go Back</span>
                </button>
            </motion.div>)}
        </div>
    </div>);
}
