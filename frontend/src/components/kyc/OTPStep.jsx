"use client";
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useSmsVerificationActor } from "../../hooks/useSmsVerificationActor";
import { motion, AnimatePresence } from "framer-motion";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
// Utility to mask phone numbers
function maskPhone(phone) {
    if (phone.length <= 4)
        return phone;
    const visible = phone.slice(-4);
    return phone.slice(0, -4).replace(/\d/g, "*") + visible;
}
const OTP_TTL = 300; // 5 minutes — must match canister expires_at = now + 300_000_000_000

function formatTimer(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function OTPStep({ onNext, onSent }) {
    const [step, setStep] = useState("phone");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState(Array(6).fill(""));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [timer, setTimer] = useState(0);
    const inputsRef = useRef([]);
    const { actor } = useSmsVerificationActor();
    useEffect(() => {
        let interval;
        if (timer > 0) {
            interval = setInterval(() => setTimer((t) => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [timer]);
    async function handleSendCode() {
        if (!actor)
            return;
        setLoading(true);
        setError(null);
        try {
            const result = await actor.send_sms("+" + phone);
            if (result.success) {
                setStep("otp");
                setTimer(OTP_TTL);
                onSent?.("+" + phone);
            }
            else {
                setError(result.message);
            }
        }
        catch {
            setError("Something went wrong.");
        }
        finally {
            setLoading(false);
        }
    }
    // Skip phone/email verification entirely. Any phone typed so far is kept as
    // unverified contact info; the submission is flagged phoneVerified: false.
    function handleSkip() {
        onNext({
            phone: phone ? "+" + phone : "",
            email: email.trim(),
            phoneVerified: false,
        });
    }

    async function handleVerifyCode() {
        if (!actor)
            return;
        const code = otp.join("");
        if (code.length !== 6)
            return;
        setLoading(true);
        setError(null);
        try {
            const result = await actor.verify_otp("+" + phone, code);
            if (result.success) {
                onNext({ phone: "+" + phone, email: email.trim(), phoneVerified: true });
            }
            else {
                setError(result.message);
            }
        }
        catch {
            setError("Something went wrong.");
        }
        finally {
            setLoading(false);
        }
    }
    const handleChange = (value, index) => {
        if (!/^[0-9]?$/.test(value))
            return;
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        if (value && index < 5)
            inputsRef.current[index + 1]?.focus();
    };
    const handleKeyDown = (e, index) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            inputsRef.current[index - 1]?.focus();
        }
    };
    return (<motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} className="w-full max-w-md mx-auto text-center space-y-4 sm:space-y-6 bg-gray-900/40 backdrop-blur-lg p-4 sm:p-8 rounded-xl sm:rounded-2xl shadow-lg border border-gray-800">
        <div>
            <h2 className="text-lg sm:text-2xl font-semibold text-white">
                {step === "phone" ? "Verify your phone" : "Enter verification code"}
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
                {step === "phone"
                    ? "We will send a 6-digit code to your phone number"
                    : `Code sent to ${maskPhone("+" + phone)}`}
            </p>
        </div>

        <AnimatePresence mode="wait">
            {step === "phone" ? (<motion.div key="phone" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-3 sm:space-y-4">
                <PhoneInput country={"eg"} value={phone} onChange={(val) => setPhone(val)} inputClass="!w-full !h-10 sm:!h-12 !text-sm sm:!text-base !bg-gray-800 !border !border-gray-700 !text-white !rounded-lg sm:!rounded-xl !pl-12 sm:!pl-14" buttonClass="!bg-gray-700 !border-gray-600 !rounded-l-lg sm:!rounded-l-xl !h-10 sm:!h-12" dropdownClass="!bg-gray-800 !text-white !text-sm" placeholder="Enter phone number" />

                <div className="space-y-1 text-left">
                    <label className="text-xs text-gray-400">Email address <span className="text-gray-600">(optional)</span></label>
                    <Input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="h-10 sm:h-12 bg-gray-800 border-gray-700 text-white text-sm placeholder-gray-500 rounded-lg sm:rounded-xl"
                    />
                    {!email.trim() && (
                        <p className="text-xs text-yellow-500/80 mt-1">
                            Without an email you won't receive approval or rejection notifications.
                        </p>
                    )}
                </div>

                <Button className="w-full h-10 sm:h-12 text-sm sm:text-lg font-semibold rounded-xl bg-brand-500 hover:bg-brand-600 text-white shadow-md" onClick={handleSendCode} disabled={loading || !phone}>
                    {loading ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : "Send Code"}
                </Button>

                <button
                    type="button"
                    onClick={handleSkip}
                    className="w-full text-xs sm:text-sm text-slate-400 hover:text-slate-200 underline underline-offset-4 py-2 transition-colors touch-manipulation"
                >
                    Skip phone & email verification
                </button>
                <p className="text-[11px] text-slate-500 -mt-1">
                    If you skip, you won't be able to check your status or delete your data yourself later — only an admin can.
                </p>

            </motion.div>)             : (<motion.div key="otp" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }} className="space-y-4 sm:space-y-6">
                <div className="flex justify-center space-x-2 sm:space-x-3">
                    {otp.map((digit, i) => (<Input key={i} ref={(el) => {
                        inputsRef.current[i] = el;
                    }} type="text" inputMode="numeric" maxLength={1} value={digit} onChange={(e) => handleChange(e.target.value, i)} onKeyDown={(e) => handleKeyDown(e, i)} aria-label={`OTP digit ${i + 1} of 6`} className="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold bg-gray-800 border border-gray-700 text-white focus:ring-brand-500 focus:border-brand-500 rounded-lg sm:rounded-xl" />))}
                </div>

                <Button className="w-full h-10 sm:h-12 text-sm sm:text-lg font-semibold rounded-xl bg-brand-500 hover:bg-brand-600 text-white shadow-md" onClick={handleVerifyCode} disabled={loading || otp.join("").length !== 6}>
                    {loading ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : "Verify"}
                </Button>

                <div className="flex justify-between items-center text-xs sm:text-sm text-gray-400 gap-2">
                    <button onClick={() => setStep("phone")} className="hover:text-gray-200 transition truncate">Change number</button>
                    <button onClick={handleSkip} className="hover:text-gray-200 transition truncate underline underline-offset-4">Skip verification</button>
                    <button onClick={handleSendCode} disabled={timer > 0} className={`${timer > 0 ? "text-gray-500" : "text-brand-400 hover:text-brand-300"} transition truncate`}>
                        {timer > 0 ? `Resend in ${formatTimer(timer)}` : "Resend code"}
                    </button>
                </div>

            </motion.div>)}
        </AnimatePresence>

        {error && <p className="text-xs sm:text-sm text-red-400">{error}</p>}
    </motion.div>);
}
