import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Phone,
  Mail,
  Clock,
  ArrowLeft
} from "lucide-react";

interface OTPVerificationProps {
  onVerificationComplete: () => void;
  onBack: () => void;
}

export function KYCOTPVerification({ onVerificationComplete, onBack }: OTPVerificationProps) {
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "success" | "error">("idle");
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [canResend, setCanResend] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<"sms" | "email">("sms");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOtpChange = (element: HTMLInputElement, index: number) => {
    const value = element.value;
    if (isNaN(Number(value))) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Move to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
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
    if (otpString.length !== 6) return;

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

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Document Upload
        </button>

        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            OTP Verification
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            Enter the verification code sent to your {verificationMethod === "sms" ? "phone" : "email"}
          </p>
        </div>
      </div>

      {/* Verification Method Selection */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Verification Method
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setVerificationMethod("sms")}
            className={`p-4 rounded-xl border-2 transition-all ${verificationMethod === "sms"
              ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
          >
            <Phone className="w-6 h-6 mx-auto mb-2 text-gray-600 dark:text-gray-300" />
            <span className="font-medium text-gray-900 dark:text-gray-100">SMS</span>
          </button>
          <button
            onClick={() => setVerificationMethod("email")}
            className={`p-4 rounded-xl border-2 transition-all ${verificationMethod === "email"
              ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
          >
            <Mail className="w-6 h-6 mx-auto mb-2 text-gray-600 dark:text-gray-300" />
            <span className="font-medium text-gray-900 dark:text-gray-100">Email</span>
          </button>
        </div>
      </div>

      {/* OTP Input */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Enter Verification Code
        </h3>
        <div className="flex justify-center space-x-3 mb-4">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(e.target, index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onPaste={handlePaste}
              className="w-12 h-12 text-center text-xl font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-600 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          ))}
        </div>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Enter the 6-digit code sent to your {verificationMethod === "sms" ? "phone" : "email"}
        </p>
      </div>

      {/* Timer */}
      <div className="text-center mb-6">
        {timeLeft > 0 ? (
          <div className="flex items-center justify-center text-gray-600 dark:text-gray-300">
            <Clock className="w-4 h-4 mr-2" />
            <span>Code expires in {formatTime(timeLeft)}</span>
          </div>
        ) : (
          <p className="text-red-600 dark:text-red-400 font-medium">
            Code has expired
          </p>
        )}
      </div>

      {/* Verify Button */}
      <div className="mb-6">
        <button
          onClick={handleVerify}
          disabled={!isOtpComplete || isVerifying}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          {isVerifying ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify Code"
          )}
        </button>
      </div>

      {/* Resend Button */}
      <div className="text-center">
        <button
          onClick={handleResend}
          disabled={!canResend}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Resend Code
        </button>
      </div>

      {/* Status Messages */}
      {verificationStatus === "success" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center"
        >
          <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-green-800 dark:text-green-200 mb-2">
            Verification Successful!
          </h3>
          <p className="text-green-700 dark:text-green-300">
            Your identity has been verified successfully.
          </p>
        </motion.div>
      )}

      {verificationStatus === "error" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center"
        >
          <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
            Verification Failed
          </h3>
          <p className="text-red-700 dark:text-red-300">
            The verification code is incorrect. Please try again.
          </p>
        </motion.div>
      )}
    </div>
  );
}
