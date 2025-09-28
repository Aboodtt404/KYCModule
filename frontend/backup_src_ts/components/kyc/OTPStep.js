"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useSmsVerificationActor } from "../../../hooks/useSmsVerificationActor";
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
export default function OTPStep({ onNext, onSent }) {
    const [step, setStep] = useState("phone");
    const [phone, setPhone] = useState("");
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
                setTimer(30);
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
                onNext("+" + phone);
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
    return (_jsxs(motion.div, { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -30 }, className: "w-full max-w-md mx-auto text-center space-y-6 bg-gray-900/40 backdrop-blur-lg p-8 rounded-2xl shadow-lg border border-gray-800", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-semibold text-white", children: step === "phone" ? "Verify your phone" : "Enter verification code" }), _jsx("p", { className: "text-sm text-gray-400 mt-1", children: step === "phone"
                            ? "We will send a 6-digit code to your phone number"
                            : `Code sent to ${maskPhone("+" + phone)}` })] }), _jsx(AnimatePresence, { mode: "wait", children: step === "phone" ? (_jsxs(motion.div, { initial: { opacity: 0, x: 20 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -20 }, transition: { duration: 0.2 }, className: "space-y-4", children: [_jsx(PhoneInput, { country: "eg", value: phone, onChange: (val) => setPhone(val), inputClass: "!w-full !h-12 !text-base !bg-gray-800 !border !border-gray-700 !text-white !rounded-xl !pl-14", buttonClass: "!bg-gray-700 !border-gray-600 !rounded-l-xl", dropdownClass: "!bg-gray-800 !text-white", placeholder: "Enter phone number" }), _jsx(Button, { className: "w-full h-12 text-lg font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-md", onClick: handleSendCode, disabled: loading || !phone, children: loading ? _jsx(Loader2, { className: "w-5 h-5 animate-spin" }) : "Send Code" })] }, "phone")) : (_jsxs(motion.div, { initial: { opacity: 0, x: -20 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 20 }, transition: { duration: 0.2 }, className: "space-y-6", children: [_jsx("div", { className: "flex justify-center space-x-3", children: otp.map((digit, i) => (_jsx(Input, { ref: (el) => {
                                    inputsRef.current[i] = el;
                                }, type: "text", inputMode: "numeric", maxLength: 1, value: digit, onChange: (e) => handleChange(e.target.value, i), onKeyDown: (e) => handleKeyDown(e, i), className: "w-12 h-14 text-center text-xl font-bold bg-gray-800 border border-gray-700 text-white focus:ring-emerald-500 focus:border-emerald-500 rounded-xl" }, i))) }), _jsx(Button, { className: "w-full h-12 text-lg font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-md", onClick: handleVerifyCode, disabled: loading || otp.join("").length !== 6, children: loading ? _jsx(Loader2, { className: "w-5 h-5 animate-spin" }) : "Verify" }), _jsxs("div", { className: "flex justify-between items-center text-sm text-gray-400", children: [_jsx("button", { onClick: () => setStep("phone"), className: "hover:text-gray-200 transition", children: "Change number" }), _jsx("button", { onClick: handleSendCode, disabled: timer > 0, className: `${timer > 0 ? "text-gray-500" : "text-emerald-400 hover:text-emerald-300"} transition`, children: timer > 0 ? `Resend in ${timer}s` : "Resend code" })] })] }, "otp")) }), error && _jsx("p", { className: "text-sm text-red-400", children: error })] }));
}
