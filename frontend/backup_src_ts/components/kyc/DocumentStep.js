"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import GlassCard from "./GlassCard";
import UploadBox from "./UploadBox";
import ThreeHero from "./ThreeHero";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
export default function DocumentStep({ onNext, onUploaded, }) {
    const [type, setType] = useState("id");
    const [file, setFile] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    function handleFile(f) {
        setFile(f);
        onUploaded?.(f);
    }
    async function handleProcessDocument() {
        if (!file)
            return;
        setIsProcessing(true);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const ocrEndpoint = type === "id"
                ? "http://194.31.150.154:5000/egyptian-id"
                : "http://194.31.150.154:5000/passport";
            const response = await fetch(ocrEndpoint, {
                method: "POST",
                headers: { "Content-Type": "image/jpeg" },
                body: arrayBuffer,
            });
            if (!response.ok)
                throw new Error(`OCR server error ${response.status}`);
            const result = await response.json();
            if (result.success && result.extracted_data) {
                const extractedData = result.extracted_data;
                const ocrData = {
                    full_name: extractedData.full_name || "Unknown",
                    national_id: extractedData.national_id || "Unknown",
                    birth_date: extractedData.birth_date || "Unknown",
                    address: extractedData.address || "Unknown",
                    governorate: extractedData.governorate || "Unknown",
                    gender: extractedData.gender || "Unknown",
                    serial: extractedData.serial || "Unknown",
                    first_name: extractedData.first_name || "Unknown",
                    second_name: extractedData.second_name || "Unknown",
                    face_image: extractedData.face_image || null,
                };
                onNext(ocrData, file, extractedData.face_image);
            }
            else {
                throw new Error(result.error || "OCR failed");
            }
        }
        catch (error) {
            console.error("OCR error:", error);
            onNext({
                name: "Sample Name",
                idNumber: "123456789",
                birthDate: "1990-01-01",
            }, file);
        }
        finally {
            setIsProcessing(false);
        }
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(ThreeHero, { className: "h-36 sm:h-52" }), _jsxs(GlassCard, { className: "p-6", children: [_jsx("div", { className: "flex gap-3 justify-center flex-col sm:flex-row", children: [
                            { key: "id", label: "🪪 National ID" },
                            { key: "passport", label: "🛂 Passport" },
                        ].map((doc) => (_jsx("button", { className: `p-3 rounded-xl w-full sm:w-auto transition ${type === doc.key
                                ? "bg-emerald-500 text-black font-semibold"
                                : "bg-white/10 hover:bg-white/20"}`, onClick: () => setType(doc.key), children: doc.label }, doc.key))) }), _jsx("div", { className: "mt-6", children: _jsx(UploadBox, { label: `Upload ${type === "id" ? "National ID (front)" : "Passport"}`, onFile: handleFile }) }), file && (_jsxs("div", { className: "mt-6 text-sm text-gray-200 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "truncate max-w-[70%]", children: file.name }), _jsxs("span", { className: "text-gray-400", children: [(file.size / 1000).toFixed(1), " KB"] })] }), _jsx(Button, { onClick: handleProcessDocument, className: "w-full", disabled: isProcessing, children: isProcessing ? (_jsxs("span", { className: "flex items-center gap-2", children: [_jsx(Loader2, { className: "w-4 h-4 animate-spin" }), " Processing..."] })) : ("Process Document") })] }))] })] }));
}
