"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import GlassCard from "./GlassCard";
import { Button } from "@/components/ui/button";
export default function ReviewStep({ userData, editedData, onNext }) {
    // Prefer editedData → fallback to OCR data → fallback to {}
    const displayData = editedData ?? userData?.ocrData ?? {};
    return (_jsxs(GlassCard, { className: "space-y-4", children: [_jsx("h3", { className: "text-lg font-semibold", children: "Review & submit" }), _jsxs("div", { className: "text-sm text-gray-300", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Phone" }), _jsx("span", { children: userData?.phone ?? "—" })] }), _jsxs("div", { className: "flex justify-between mt-2", children: [_jsx("span", { children: "Document" }), _jsx("span", { children: userData?.documentFile?.name ?? "—" })] }), Object.keys(displayData).length > 0 && (_jsxs("div", { className: "mt-4 pt-4 border-t border-gray-600", children: [_jsx("h4", { className: "font-medium mb-2", children: "Verified Information:" }), displayData.face_image && (_jsxs("div", { className: "mb-4 p-3 bg-gray-800 rounded-lg", children: [_jsx("h5", { className: "text-sm font-medium mb-2", children: "Extracted Face:" }), _jsx("img", { src: `data:image/jpeg;base64,${displayData.face_image}`, alt: "Extracted face from ID", className: "w-24 h-24 object-cover rounded border border-gray-600" })] })), Object.entries(displayData)
                                .filter(([key]) => key !== "face_image")
                                .map(([key, value]) => (_jsxs("div", { className: "flex justify-between mt-1", children: [_jsx("span", { className: "capitalize", children: key
                                            .replace(/([A-Z])/g, " $1")
                                            .replace(/^./, (str) => str.toUpperCase()) }), _jsx("span", { className: "text-right max-w-[200px] truncate", children: value || "—" })] }, key)))] }))] }), _jsx("div", { className: "pt-2", children: _jsx(Button, { onClick: onNext, className: "w-full", children: "Submit for verification" }) })] }));
}
