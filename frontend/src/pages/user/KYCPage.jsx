"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ProgressBar from "@/components/kyc/ProgressBar";
import OTPStep from "@/components/kyc/OTPStep";
import DocumentStep from "@/components/kyc/DocumentStep";
import { FaceVerificationStep } from "@/components/kyc/FaceVerificationStep";
import ReviewStep from "@/components/kyc/ReviewStep";
import SuccessStep from "@/components/kyc/SuccessStep";
import MobileTransferComplete from "@/components/kyc/MobileTransferComplete";
import LogoHero from "@/components/kyc/ThreeHero";
import QRHandoff from "@/components/kyc/QRHandoff";
import { useSubmitKYC, useCreateVerificationSession } from "../../hooks/useQueries";
import { v4 as uuidv4 } from 'uuid';

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

export default function KYCPage({ mobileMode = false, sessionId = null, onComplete = null }) {
    const [isMobileDevice, setIsMobileDevice] = useState(false);
    const [step, setStep] = useState(mobileMode ? 1 : 0); // 0 = handoff choice, 1 = start
    const [submissionId, setSubmissionId] = useState(sessionId || null);
    const [showQRHandoff, setShowQRHandoff] = useState(false);
    const [handoffSessionId, setHandoffSessionId] = useState(null);
    const [mobileTransferComplete, setMobileTransferComplete] = useState(false);

    // Detect if device is mobile
    useEffect(() => {
        const checkMobile = () => {
            const userAgent = navigator.userAgent || navigator.vendor || window.opera;
            const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
            // Also check screen width as fallback
            const isSmallScreen = window.innerWidth <= 768;
            setIsMobileDevice(isMobile || isSmallScreen);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    const [userData, setUserData] = useState({
        phone: "",
        documentFile: null,
        ocrData: null,
        faceImage: null,
        faceVerified: false,
    });
    const [submissionComplete, setSubmissionComplete] = useState(false);
    const submitKYC = useSubmitKYC();
    const createSession = useCreateVerificationSession();

    // Submit KYC data when reaching success step
    const handleFinalSubmit = (finalUserData) => {
        if (!submissionComplete && finalUserData.faceVerified) {
            // Ensure ocrData is an object before destructuring
            const ocrData = finalUserData.ocrData || {};

            // Filter ocrData to only include desired fields for submission
            const ocrDataForSubmission = {
                full_name: ocrData.full_name || "",
                national_id: ocrData.national_id,
                birth_date: ocrData.birth_date,
                age: calculateAge(ocrData.birth_date), // Calculate and add age
                address: ocrData.address || "",
                governorate: ocrData.governorate,
                gender: ocrData.gender,
                face_image: ocrData.face_image
            };

            const kycData = {
                submissionId,
                timestamp: new Date().toISOString(),
                phone: finalUserData.phone,
                documentFile: finalUserData.documentFile?.name || "N/A",
                ocrData: ocrDataForSubmission,
                faceVerified: finalUserData.faceVerified,
                status: "pending_review"
            };

            // Wrap in kycData object to match backend structure
            const payload = { kycData };

            submitKYC.mutate({ submissionId, kycData: payload }, {
                onSuccess: () => {
                    console.log("✅ KYC submission successful");
                    setSubmissionComplete(true);
                    setStep(TOTAL_STEPS); // Move to success step
                },
                onError: (error) => {
                    console.error("❌ KYC submission failed:", error);
                    alert(`KYC submission failed: ${error.message || error}`);
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
    const handleReset = () => {
        setStep(1);
        setUserData({
            phone: "",
            documentFile: null,
            ocrData: null,
            faceImage: null,
            faceVerified: false,
        });
        setSubmissionId(null);
        setSubmissionComplete(false);
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
        const updatedUserData = {
            ...userData,
            faceVerified: true,
        };
        
        setUserData(updatedUserData);
        
        if (mobileMode && sessionId) {
            if (onComplete) {
                console.log('📱 Mobile verification complete. Sending data to parent:', updatedUserData);
                onComplete(updatedUserData);
            }
            setMobileTransferComplete(true);
            return;
        }
        
        // On desktop, proceed to the review step
        setStep(5);
    };

    const handleReviewComplete = (updatedOcrData) => {
        const finalUserData = {
            ...userData,
            ocrData: updatedOcrData,
        };
        setUserData(finalUserData);
        handleFinalSubmit(finalUserData);
    };

    // Handle mobile handoff completion
    const handleHandoffComplete = (sessionData) => {
        console.log('📱 Received session data from mobile handoff:', sessionData);
        setShowQRHandoff(false);

        let parsedData;
        try {
            // The actual user data is in a stringified JSON field named 'data'
            if (typeof sessionData.data === 'string') {
                parsedData = JSON.parse(sessionData.data);
            } else if (typeof sessionData.data === 'object') {
                // In case it's already an object
                parsedData = sessionData.data;
            } else {
                throw new Error("sessionData.data is not a string or object");
            }
        } catch (error) {
            console.error('❌ Failed to parse user data from mobile handoff:', error, 'Raw data:', sessionData.data);
            alert("There was an issue parsing the data from your mobile device. Please try again.");
            setStep(0); // Reset to start
            return;
        }
        
        // Now validate the PARSED data
        if (parsedData && parsedData.ocrData && parsedData.faceVerified) {
            setUserData({
                phone: parsedData.phone || userData.phone,
                documentFile: parsedData.documentFile || null,
                ocrData: parsedData.ocrData || null,
                faceImage: parsedData.faceImage || null,
                faceVerified: parsedData.faceVerified || false,
            });
            
            console.log('✅ Handoff complete, moving to Review Step.');
            setStep(5);
        } else {
            console.error('❌ Invalid or incomplete data after parsing from mobile handoff. Parsed data:', parsedData);
            alert("The data received from your mobile device was incomplete. Please try again.");
            setStep(0); 
        }
    };

    // Generate handoff session
    const handleStartOnMobile = async () => {
        const newSessionId = uuidv4();
        try {
            await createSession.mutateAsync(newSessionId);
            setHandoffSessionId(newSessionId);
            setSubmissionId(newSessionId);
            setShowQRHandoff(true);
        } catch (error) {
            console.error('Failed to create verification session:', error);
            alert('Failed to create verification session. Please try again.');
        }
    };

    const renderStep = () => {
        // Choice screen (desktop only, or simplified on mobile)
        if (step === 0) {
            // On mobile device, show simplified version with just "Continue on Phone"
            if (isMobileDevice) {
                return (
                    <motion.div 
                        initial={{ opacity: 0, y: 40 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: -40 }} 
                        key="step0" 
                        className="space-y-4 sm:space-y-6 text-center"
                    >
                        <div className="flex justify-center">
                            <LogoHero className="max-h-32 sm:max-h-40" />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold text-white">
                                Verify Your Identity
                            </h2>
                            <p className="text-gray-300 text-sm mt-2 px-2">
                                Complete verification on your phone
                            </p>
                        </div>
                        <button 
                            onClick={() => setStep(1)}
                            className="w-full py-3 sm:py-4 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold transition transform active:scale-[0.98] active:shadow-lg flex items-center justify-center gap-2 sm:gap-3 touch-manipulation min-h-[48px] text-sm sm:text-base"
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs sm:text-sm md:text-base">Continue on Phone</span>
                        </button>
                    </motion.div>
                );
            }
            
            // On desktop, show both options
            return (
                <motion.div 
                    initial={{ opacity: 0, y: 40 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -40 }} 
                    key="step0" 
                    className="space-y-6 text-center"
                >
                    <div className="flex justify-center">
                        <LogoHero className="max-h-40" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">
                            Verify Your Identity
                        </h2>
                        <p className="text-gray-300 text-sm mt-2">
                            Choose how you'd like to complete verification
                        </p>
                    </div>
                    <div className="space-y-2 sm:space-y-3">
                        <button 
                            onClick={handleStartOnMobile}
                            className="w-full py-3 sm:py-4 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold transition transform active:scale-[0.98] active:shadow-lg flex items-center justify-center gap-2 sm:gap-3 touch-manipulation min-h-[48px] text-sm sm:text-base"
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs sm:text-sm md:text-base">Continue on Mobile (Recommended)</span>
                        </button>
                        <button 
                            onClick={() => setStep(1)}
                            className="w-full py-3 sm:py-4 rounded-xl bg-white/10 border border-white/20 text-white font-semibold transition active:bg-white/20 touch-manipulation min-h-[48px] text-sm sm:text-base"
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                            Continue on Desktop
                        </button>
                    </div>
                </motion.div>
            );
        }
        
        switch (step) {
            case 1:
                return (<motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }} key="step1" className="space-y-4 sm:space-y-6 text-center">
                    <div className="flex justify-center">
                        <LogoHero className="max-h-28 sm:max-h-40" />
                    </div>
                    <div>
                        <h2 className="text-base sm:text-xl font-semibold mt-2 sm:mt-4 text-white">
                            Verify your identity
                        </h2>
                        <p className="text-gray-300 text-xs sm:text-base mt-1">
                            This process helps keep your account secure.
                        </p>
                    </div>
                    <button onClick={handleNext} className="w-full py-3 sm:py-3.5 text-sm sm:text-base rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 text-black font-semibold transition transform active:scale-[0.98] active:shadow-[0_0_10px_rgba(0,255,136,0.6)] touch-manipulation min-h-[48px]">
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
                        onReset={handleReset}
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
    
    // Show mobile transfer complete screen
    if (mobileMode && mobileTransferComplete) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-white flex items-center justify-center px-3 sm:px-4 py-4 sm:py-10">
                <div className="w-full max-w-lg">
                    <MobileTransferComplete />
                </div>
            </div>
        );
    }
    
    // Show QR handoff if requested
    if (showQRHandoff && handoffSessionId) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-white flex items-center justify-center px-4 py-10">
                <QRHandoff 
                    sessionId={handoffSessionId}
                    onComplete={handleHandoffComplete}
                />
            </div>
        );
    }

    return (<div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-white flex items-center justify-center px-3 sm:px-4 py-4 sm:py-10">
        <div className="w-full max-w-lg">
            {/* Progress Bar */}
            {step > 0 && step < TOTAL_STEPS && <ProgressBar value={getProgress(step)} />}

            {/* Animated step content */}
            <motion.div key={step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-xl mt-3 sm:mt-8">
                <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
            </motion.div>

            {/* Navigation controls */}
            {step < TOTAL_STEPS && step > 1 && (<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center mt-3 sm:mt-6">
                <button onClick={handleBack} className="flex items-center space-x-2 px-3 sm:px-4 py-2.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 active:text-gray-800 dark:active:text-gray-200 transition-colors duration-200 active:bg-gray-100 dark:active:bg-gray-800 rounded-lg touch-manipulation min-h-[44px] flex items-center justify-center" style={{ WebkitTapHighlightColor: 'transparent' }}>
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Go Back</span>
                </button>
            </motion.div>)}
        </div>
    </div>);
}
