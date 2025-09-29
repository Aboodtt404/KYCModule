"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import LottieSuccess from "./LottieSuccess";
import { Button } from "@/components/ui/button";
import GlassCard from "./GlassCard";
export default function SuccessStep({ onDone }) {
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs(GlassCard, { className: "flex flex-col items-center justify-center gap-4", children: [_jsx(LottieSuccess, { className: "w-40 h-40" }), _jsx("h3", { className: "text-xl font-semibold", children: "Documents submitted" }), _jsx("p", { className: "text-sm text-gray-300 text-center", children: "Verification usually takes 24\u201348 hours. We'll notify you when it's completed." })] }), _jsx("div", { children: _jsx(Button, { className: "w-full", onClick: () => onDone?.(), children: "Go to dashboard" }) })] }));
}
