"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
export default function ProgressBar({ value }) {
    const percentage = Math.max(0, Math.min(100, value));
    return (_jsxs("div", { className: "w-full mb-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-sm font-medium text-gray-700 dark:text-gray-300", children: "Progress" }), _jsxs("span", { className: "text-sm font-semibold text-emerald-600 dark:text-emerald-400", children: [Math.round(percentage), "%"] })] }), _jsx("div", { className: "w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner", children: _jsx(motion.div, { className: "h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full shadow-sm", initial: { width: 0 }, animate: { width: `${percentage}%` }, transition: { duration: 0.6, ease: "easeOut" } }) })] }));
}
