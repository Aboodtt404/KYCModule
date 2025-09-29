// components/kyc/StepperHeader.tsx
"use client";
import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import ProgressBar from "./ProgressBar";
export default function StepperHeader({ step, total, percent }) {
    return (_jsxs("div", { className: "mb-6", children: [_jsxs("div", { className: "flex items-center justify-between text-xs text-gray-300 mb-2", children: [_jsxs("span", { children: ["Step ", step, " of ", total] }), _jsxs("span", { children: [percent, "%"] })] }), _jsx(ProgressBar, { value: percent, height: "h-2" })] }));
}
