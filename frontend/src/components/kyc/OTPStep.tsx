"use client";
import React, { useState } from "react";
import { PhoneInputComponent as PhoneInput } from "@/components/shared/PhoneInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Phone, Shield, CheckCircle, ArrowLeft } from "lucide-react";
import GlassCard from "./GlassCard";
import { useSmsVerificationActor } from "../../../hooks/useSmsVerificationActor";
import type { Response } from "../../../declarations/sms_verification_backend/sms_verification_backend.did";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onNext: () => void;
  onSent?: (phone: string) => void;
}

export default function OTPStep({ onNext, onSent }: Props) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState<string>("");
  const [otp, setOtp] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const { actor } = useSmsVerificationActor();

  async function handleSendCode() {
    if (!actor) return;
    setLoading(true);
    setError(null);
    try {
      const result: Response = await actor.send_sms(phone);
      if (result.success) {
        setStep("otp");
        if (onSent) onSent(phone);
      } else {
        setError(result.message);
      }
    } catch (e) {
      console.error(e);
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode() {
    if (!actor) return;
    setLoading(true);
    setError(null);
    try {
      const result: Response = await actor.verify_otp(phone, otp);
      if (result.success) {
        onNext();
      } else {
        setError(result.message);
      }
    } catch (e) {
      console.error(e);
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -40 }}
      className="w-full max-w-md mx-auto"
    >
      <GlassCard>
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center"
          >
            {step === "phone" ? (
              <Phone className="w-8 h-8 text-white" />
            ) : (
              <Shield className="w-8 h-8 text-white" />
            )}
          </motion.div>
          
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-bold text-gray-900 dark:text-white mb-2"
          >
            {step === "phone" ? "Verify Your Phone" : "Enter Verification Code"}
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-gray-600 dark:text-gray-300"
          >
            {step === "phone" 
              ? "We'll send a secure verification code to your phone number" 
              : `We sent a 6-digit code to ${phone}`
            }
          </motion.p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {step === "phone" ? (
              <div className="space-y-4">
                <div className="relative">
                  <PhoneInput 
                    value={phone} 
                    onChange={(p) => setPhone(p || "")} 
                  />
                </div>
                
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>Your number is encrypted and secure</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <Input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    className="text-center text-2xl font-mono tracking-widest h-14 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <Phone className="w-4 h-4" />
                  <span>Code sent to {phone}</span>
                </div>
                
                <button
                  onClick={() => setStep("phone")}
                  className="flex items-center space-x-2 text-sm text-emerald-600 hover:text-emerald-700 transition-colors mx-auto"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Change phone number</span>
                </button>
              </div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3"
              >
                <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
              </motion.div>
            )}

            <Button
              className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
              onClick={step === "phone" ? handleSendCode : handleVerifyCode}
              disabled={loading || (step === 'phone' && !phone) || (step === 'otp' && otp.length !== 6)}
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{step === "phone" ? "Sending..." : "Verifying..."}</span>
                </div>
              ) : step === "phone" ? (
                <div className="flex items-center space-x-2">
                  <Phone className="w-5 h-5" />
                  <span>Send Code</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span>Verify Code</span>
                </div>
              )}
            </Button>
          </motion.div>
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
}
