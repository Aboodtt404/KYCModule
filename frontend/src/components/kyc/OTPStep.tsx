"use client";
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useSmsVerificationActor } from "../../../hooks/useSmsVerificationActor";
import type { Response } from "../../declarations/sms_verification_backend/sms_verification_backend.did";
import { motion, AnimatePresence } from "framer-motion";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

interface Props {
  onNext: () => void;
  onSent?: (phone: string) => void;
}

// Utility to mask phone numbers
function maskPhone(phone: string) {
  if (phone.length <= 4) return phone; // too short, just return
  const visible = phone.slice(-4); // last 4 digits
  return phone.slice(0, -4).replace(/\d/g, "*") + visible;
}

export default function OTPStep({ onNext, onSent }: Props) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);

  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const { actor } = useSmsVerificationActor() as {
    actor: {
      send_sms: (phone: string) => Promise<Response>;
      verify_otp: (phone: string, otp: string) => Promise<Response>;
    } | null;
  };

  // Handle timer countdown for resend
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  async function handleSendCode() {
    if (!actor) return;
    setLoading(true);
    setError(null);
    try {
      const result = await actor.send_sms("+" + phone);
      if (result.success) {
        setStep("otp");
        setTimer(30); // 30s cooldown
        if (onSent) onSent("+" + phone);
      } else {
        setError(result.message);
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode() {
    if (!actor) return;
    const code = otp.join("");
    if (code.length !== 6) return;

    setLoading(true);
    setError(null);
    try {
      const result = await actor.verify_otp("+" + phone, code);
      if (result.success) {
        onNext();
      } else {
        setError(result.message);
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // OTP input handlers
  const handleChange = (value: string, index: number) => {
    if (!/^[0-9]?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      className="w-full max-w-md mx-auto text-center space-y-6 bg-gray-900/40 backdrop-blur-lg p-8 rounded-2xl shadow-lg border border-gray-800"
    >
      <div>
        <h2 className="text-2xl font-semibold text-white">
          {step === "phone" ? "Verify your phone" : "Enter verification code"}
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          {step === "phone"
            ? "We will send a 6-digit code to your phone number"
            : `Code sent to ${maskPhone("+" + phone)}`}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {step === "phone" ? (
          <motion.div
            key="phone"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <PhoneInput
              country={"eg"}
              value={phone}
              onChange={(val) => setPhone(val)}
              inputClass="!w-full !h-12 !text-base !bg-gray-800 !border !border-gray-700 !text-white !rounded-xl !pl-14"
              buttonClass="!bg-gray-700 !border-gray-600 !rounded-l-xl"
              dropdownClass="!bg-gray-800 !text-white"
              placeholder="Enter phone number"
            />

            <Button
              className="w-full h-12 text-lg font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-md"
              onClick={handleSendCode}
              disabled={loading || !phone}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Code"}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="otp"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="flex justify-center space-x-3">
              {otp.map((digit, i) => (
                <Input
                  key={i}
                  ref={(el) => (inputsRef.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(e.target.value, i)}
                  onKeyDown={(e) => handleKeyDown(e, i)}
                  className="w-12 h-14 text-center text-xl font-bold bg-gray-800 border border-gray-700 text-white focus:ring-emerald-500 focus:border-emerald-500 rounded-xl"
                />
              ))}
            </div>

            <Button
              className="w-full h-12 text-lg font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-md"
              onClick={handleVerifyCode}
              disabled={loading || otp.join("").length !== 6}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify"}
            </Button>

            <div className="flex justify-between items-center text-sm text-gray-400">
              <button
                onClick={() => setStep("phone")}
                className="hover:text-gray-200 transition"
              >
                Change number
              </button>
              <button
                onClick={handleSendCode}
                disabled={timer > 0}
                className={`${
                  timer > 0
                    ? "text-gray-500"
                    : "text-emerald-400 hover:text-emerald-300"
                } transition`}
              >
                {timer > 0 ? `Resend in ${timer}s` : "Resend code"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </motion.div>
  );
}
