import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Shield, CheckCircle, AlertCircle, RefreshCw, Phone, Mail, Clock, ArrowLeft } from "lucide-react";
export function KYCOTPVerification({ onVerificationComplete, onBack }) {
    const [otp, setOtp] = useState(new Array(6).fill(""));
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState("idle");
    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
    const [canResend, setCanResend] = useState(false);
    const [verificationMethod, setVerificationMethod] = useState("sms");
    const inputRefs = useRef([]);
    // Countdown timer
    useEffect(() => {
        if (timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        }
        else {
            setCanResend(true);
        }
    }, [timeLeft]);
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    const handleOtpChange = (element, index) => {
        const value = element.value;
        if (isNaN(Number(value)))
            return;
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        // Move to next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };
    const handleKeyDown = (e, index) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };
    const handlePaste = (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        const newOtp = [...otp];
        for (let i = 0; i < pastedData.length && i < 6; i++) {
            newOtp[i] = pastedData[i];
        }
        setOtp(newOtp);
        // Focus on the next empty input or the last one
        const nextIndex = Math.min(pastedData.length, 5);
        inputRefs.current[nextIndex]?.focus();
    };
    const handleVerify = async () => {
        const otpString = otp.join("");
        if (otpString.length !== 6)
            return;
        setIsVerifying(true);
        setVerificationStatus("idle");
        // Simulate API call
        setTimeout(() => {
            const isValid = Math.random() > 0.3; // 70% success rate for demo
            setVerificationStatus(isValid ? "success" : "error");
            setIsVerifying(false);
            if (isValid) {
                setTimeout(() => {
                    onVerificationComplete();
                }, 2000);
            }
        }, 2000);
    };
    const handleResend = () => {
        setOtp(new Array(6).fill(""));
        setTimeLeft(300);
        setCanResend(false);
        setVerificationStatus("idle");
        inputRefs.current[0]?.focus();
    };
    const isOtpComplete = otp.every(digit => digit !== "");
    return (_jsxs("div", { className: "max-w-2xl mx-auto", children: [_jsxs("div", { className: "mb-8", children: [_jsxs("button", { onClick: onBack, className: "flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 mb-6 transition-colors", children: [_jsx(ArrowLeft, { className: "w-4 h-4 mr-2" }), "Back to Document Upload"] }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6", children: _jsx(Shield, { className: "w-8 h-8 text-blue-600 dark:text-blue-400" }) }), _jsx("h2", { className: "text-3xl font-bold text-gray-900 dark:text-white mb-4", children: "OTP Verification" }), _jsxs("p", { className: "text-gray-600 dark:text-gray-300 text-lg", children: ["Enter the verification code sent to your ", verificationMethod === "sms" ? "phone" : "email"] })] })] }), _jsxs("div", { className: "mb-8", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4", children: "Verification Method" }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("button", { onClick: () => setVerificationMethod("sms"), className: `p-4 rounded-xl border-2 transition-all ${verificationMethod === "sms"
                                    ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"}`, children: [_jsx(Phone, { className: "w-6 h-6 mx-auto mb-2 text-gray-600 dark:text-gray-300" }), _jsx("span", { className: "font-medium text-gray-900 dark:text-gray-100", children: "SMS" })] }), _jsxs("button", { onClick: () => setVerificationMethod("email"), className: `p-4 rounded-xl border-2 transition-all ${verificationMethod === "email"
                                    ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"}`, children: [_jsx(Mail, { className: "w-6 h-6 mx-auto mb-2 text-gray-600 dark:text-gray-300" }), _jsx("span", { className: "font-medium text-gray-900 dark:text-gray-100", children: "Email" })] })] })] }), _jsxs("div", { className: "mb-8", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4", children: "Enter Verification Code" }), _jsx("div", { className: "flex justify-center space-x-3 mb-4", children: otp.map((digit, index) => (_jsx("input", { ref: (el) => (inputRefs.current[index] = el), type: "text", maxLength: 1, value: digit, onChange: (e) => handleOtpChange(e.target, index), onKeyDown: (e) => handleKeyDown(e, index), onPaste: handlePaste, className: "w-12 h-12 text-center text-xl font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-600 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" }, index))) }), _jsxs("p", { className: "text-center text-sm text-gray-500 dark:text-gray-400", children: ["Enter the 6-digit code sent to your ", verificationMethod === "sms" ? "phone" : "email"] })] }), _jsx("div", { className: "text-center mb-6", children: timeLeft > 0 ? (_jsxs("div", { className: "flex items-center justify-center text-gray-600 dark:text-gray-300", children: [_jsx(Clock, { className: "w-4 h-4 mr-2" }), _jsxs("span", { children: ["Code expires in ", formatTime(timeLeft)] })] })) : (_jsx("p", { className: "text-red-600 dark:text-red-400 font-medium", children: "Code has expired" })) }), _jsx("div", { className: "mb-6", children: _jsx("button", { onClick: handleVerify, disabled: !isOtpComplete || isVerifying, className: "w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center", children: isVerifying ? (_jsxs(_Fragment, { children: [_jsx(RefreshCw, { className: "w-4 h-4 mr-2 animate-spin" }), "Verifying..."] })) : ("Verify Code") }) }), _jsx("div", { className: "text-center", children: _jsx("button", { onClick: handleResend, disabled: !canResend, className: "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors", children: "Resend Code" }) }), verificationStatus === "success" && (_jsxs(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, className: "mt-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center", children: [_jsx(CheckCircle, { className: "w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-4" }), _jsx("h3", { className: "text-xl font-semibold text-green-800 dark:text-green-200 mb-2", children: "Verification Successful!" }), _jsx("p", { className: "text-green-700 dark:text-green-300", children: "Your identity has been verified successfully." })] })), verificationStatus === "error" && (_jsxs(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, className: "mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center", children: [_jsx(AlertCircle, { className: "w-12 h-12 text-red-600 dark:text-red-400 mx-auto mb-4" }), _jsx("h3", { className: "text-xl font-semibold text-red-800 dark:text-red-200 mb-2", children: "Verification Failed" }), _jsx("p", { className: "text-red-700 dark:text-red-300", children: "The verification code is incorrect. Please try again." })] }))] }));
}
