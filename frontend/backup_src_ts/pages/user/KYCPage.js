"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
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
const getProgress = (step) => {
    if (step < TOTAL_STEPS) {
        return Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 85);
    }
    return 100;
};
export default function KYCPage() {
    const [step, setStep] = useState(1);
    const [userData, setUserData] = useState({
        phone: "",
        documentFile: null,
        ocrData: null,
        faceImage: null,
        editedData: null,
        needsEditing: false,
    });
    const handleNext = () => {
        setStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
    };
    const handleBack = () => {
        setStep((prev) => Math.max(prev - 1, 1));
    };
    const handleOtpVerified = (phoneNumber) => {
        setUserData((prev) => ({ ...prev, phone: phoneNumber }));
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
    const handleFieldEditSubmit = (editedData) => {
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
                return (_jsxs(motion.div, { initial: { opacity: 0, y: 40 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -40 }, className: "space-y-6 text-center", children: [_jsx("div", { className: "flex justify-center", children: _jsx(LogoHero, { className: "max-h-40" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-lg sm:text-xl font-semibold mt-4", children: "Verify your identity" }), _jsx("p", { className: "text-gray-300 text-sm sm:text-base mt-1", children: "This process helps keep your account secure." })] }), _jsx("button", { onClick: handleNext, className: "w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 text-black font-semibold transition transform hover:scale-105 hover:shadow-[0_0_10px_rgba(0,255,136,0.6)]", children: "Start Verification" })] }, "step1"));
            case 2:
                return _jsx(OTPStep, { onNext: handleOtpVerified });
            case 3:
                return _jsx(DocumentStep, { onNext: handleDocumentSubmit });
            case 4:
                return (_jsx(OcrResultStep, { ocrData: userData.ocrData || {}, faceImage: userData.faceImage || "", onNext: handleContinueWithoutEdit, onEdit: handleStartEditing }));
            case 5:
                if (userData.needsEditing) {
                    return (_jsx(FieldEditStep, { ocrData: userData.ocrData || {}, faceImage: userData.faceImage || "", onNext: handleFieldEditSubmit, onBack: handleBack }));
                }
                else {
                    return (_jsx(ReviewStep, { userData: userData, editedData: userData.editedData, onNext: handleNext }));
                }
            case 6:
                return _jsx(SuccessStep, {});
            default:
                return _jsx("div", { children: "Invalid Step" });
        }
    };
    return (_jsx("div", { className: "min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-white flex items-center justify-center px-4 py-10", children: _jsxs("div", { className: "w-full max-w-lg", children: [step <= TOTAL_STEPS && _jsx(ProgressBar, { value: getProgress(step) }), _jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 }, transition: { duration: 0.4 }, className: "bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl mt-8", children: _jsx(AnimatePresence, { mode: "wait", children: renderStep() }) }, step), step < TOTAL_STEPS && step > 1 && (_jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, className: "flex justify-center mt-6", children: _jsxs("button", { onClick: handleBack, className: "flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg", children: [_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 19l-7-7 7-7" }) }), _jsx("span", { children: "Go Back" })] }) }))] }) }));
}
