"use client";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import GlassCard from "./GlassCard";

export default function OTPStep({
  onNext,
  onSent,
}: {
  onNext: () => void;
  onSent?: (phone: string) => void;
}) {
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    if (!sent) return;
    if (timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, sent]);

  function sendOTP() {
    setSent(true);
    setTimeLeft(30);
    onSent?.(phone);
    // simulate server sending
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>, idx: number) {
    const v = e.target.value.replace(/\D/g, "").slice(0, 1);
    const copy = [...otp];
    copy[idx] = v;
    setOtp(copy);
    if (v && idx < 5) inputRefs.current[idx + 1]?.focus();
  }

  function handleVerify() {
    if (otp.some((d) => !d)) return;
    // simulate verification success
    onNext();
  }

  return (
    <GlassCard className="flex flex-col gap-4">
      {!sent ? (
        <>
          <label className="text-sm text-gray-300">Phone number</label>
          <input
            className="rounded-lg p-3 text-black w-full"
            placeholder="+20 123 456 7890"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
          />
          <Button onClick={sendOTP} className="w-full">
            Send OTP
          </Button>
        </>
      ) : (
        <>
          <div className="text-sm text-gray-300">
            Enter the 6-digit code sent to {phone || "your phone"}
          </div>
          <div className="flex justify-center gap-2 mt-3">
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                value={digit}
                onChange={(e) => handleChange(e, idx)}
                maxLength={1}
                inputMode="numeric"
                className="w-12 h-12 rounded-md text-center text-lg"
              />
            ))}
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="text-sm text-gray-300">
              {timeLeft > 0
                ? `Resend in 00:${String(timeLeft).padStart(2, "0")}`
                : "Didn't receive code?"}
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setSent(false);
                setOtp(new Array(6).fill(""));
              }}
            >
              Change number
            </Button>
          </div>
          <Button onClick={handleVerify} className="w-full mt-4">
            Verify
          </Button>
        </>
      )}
    </GlassCard>
  );
}
