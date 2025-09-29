"use client";
import { jsx as _jsx } from "react/jsx-runtime";
export default function GlassCard({ children, className = "", }) {
    return (_jsx("div", { className: `bg-white/6 backdrop-blur-md border border-white/6 rounded-2xl p-4 sm:p-6 ${className}`, children: children }));
}
