"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GlassCard from "./GlassCard";
import { CheckCircle, Edit3, Save, X } from "lucide-react";
import { toast } from "sonner";
import { verifyFace, convertFileToBase64 } from "../../services/faceVerification";
import { CameraCapture } from "./CameraCapture";
export function FieldEditStep({ ocrData, faceImage, onNext, onBack }) {
    const [editedData, setEditedData] = useState(ocrData);
    const [editingField, setEditingField] = useState(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationResult, setVerificationResult] = useState(null);
    const [selfieFile, setSelfieFile] = useState(null);
    const [selfiePreview, setSelfiePreview] = useState(null);
    const [isIdentityVerified, setIsIdentityVerified] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [lastSelfieTimestamp, setLastSelfieTimestamp] = useState(null);
    const fieldsToShow = [
        { key: 'full_name', label: 'Full Name', required: true, fallbackKeys: ['first_name', 'second_name', 'name'] },
        { key: 'national_id', label: 'National ID', required: true, fallbackKeys: ['id', 'national_id_number'] },
        { key: 'address', label: 'Address', required: true, fallbackKeys: ['location', 'residence'] },
        { key: 'birth_date', label: 'Birth Date', required: false, fallbackKeys: ['date_of_birth', 'birthday'] },
        { key: 'gender', label: 'Gender', required: false, fallbackKeys: ['sex'] },
        { key: 'governorate', label: 'Governorate', required: false, fallbackKeys: ['state', 'province'] }
    ];
    const getFieldValue = (fieldKey, fallbackKeys = []) => {
        // First try the main key
        let value = editedData[fieldKey];
        if (value)
            return value;
        // Then try fallback keys
        for (const fallbackKey of fallbackKeys) {
            value = editedData[fallbackKey];
            if (value)
                return value;
        }
        // If still no value, try to construct full_name from first_name and second_name
        if (fieldKey === 'full_name') {
            const firstName = editedData['first_name'] || editedData['firstName'];
            const secondName = editedData['second_name'] || editedData['secondName'];
            if (firstName && secondName) {
                return `${firstName} ${secondName}`;
            }
            if (firstName)
                return firstName;
            if (secondName)
                return secondName;
        }
        return '';
    };
    const handleFieldEdit = (key, value) => {
        setEditedData(prev => ({
            ...prev,
            [key]: value
        }));
    };
    const handleSaveField = (key) => {
        setEditingField(null);
        toast.success(`${fieldsToShow.find(f => f.key === key)?.label} updated`);
    };
    const handleCameraCapture = (file) => {
        setSelfieFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            setSelfiePreview(e.target?.result);
        };
        reader.readAsDataURL(file);
        setShowCamera(false);
        // Clear previous verification results when new selfie is captured
        setVerificationResult(null);
        setIsIdentityVerified(false);
        setLastSelfieTimestamp(Date.now());
    };
    const handleCameraCancel = () => {
        setShowCamera(false);
    };
    const handleVerifyIdentity = async () => {
        if (!selfieFile) {
            toast.error("Please capture a selfie first");
            return;
        }
        const requestId = Date.now() + Math.random();
        console.log(`Starting face verification ${requestId} with new selfie:`, selfieFile.name, 'File size:', selfieFile.size);
        setIsVerifying(true);
        try {
            // Convert selfie to base64
            const selfieBase64 = await convertFileToBase64(selfieFile);
            console.log(`Selfie ${requestId} converted to base64, length:`, selfieBase64.length);
            // Call the face verification API
            const result = await verifyFace(faceImage, selfieBase64);
            console.log(`Face verification ${requestId} result:`, result);
            setVerificationResult(result.verification_result);
            if (result.verification_result.is_match) {
                setIsIdentityVerified(true);
                toast.success("Identity verified successfully! You can now edit the information.");
            }
            else {
                toast.error(`Identity verification failed. Similarity: ${(result.verification_result.similarity_score * 100).toFixed(1)}%. Please try again with a clearer selfie.`);
            }
        }
        catch (error) {
            console.error(`Verification ${requestId} error:`, error);
            toast.error(error instanceof Error ? error.message : "Verification failed. Please try again.");
        }
        finally {
            setIsVerifying(false);
        }
    };
    const handleSubmit = () => {
        if (!verificationResult?.is_match) {
            toast.error("Please verify your identity first");
            return;
        }
        onNext(editedData);
    };
    return (_jsxs(motion.div, { initial: { opacity: 0, y: 40 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -40 }, className: "w-full max-w-8xl mx-auto px-4", children: [_jsxs(GlassCard, { className: "p-8 sm:p-12", children: [_jsxs("div", { className: "text-center mb-12", children: [_jsx(motion.div, { initial: { scale: 0 }, animate: { scale: 1 }, transition: { delay: 0.2, type: "spring", stiffness: 200 }, className: "w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center", children: _jsx(Edit3, { className: "w-8 h-8 text-white" }) }), _jsx(motion.h2, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.3 }, className: "text-2xl font-bold text-gray-900 dark:text-white mb-2", children: "Verify Identity & Edit Information" }), _jsx(motion.p, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.4 }, className: "text-gray-600 dark:text-gray-300", children: "Please verify your identity and review the extracted information" })] }), _jsxs("div", { className: "grid grid-cols-1 xl:grid-cols-2 gap-12", children: [_jsx("div", { className: "space-y-8", children: _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 dark:text-white mb-4", children: "Identity Verification" }), _jsxs("div", { className: "mb-4", children: [_jsx(Label, { className: "text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block", children: "Face from ID Document" }), _jsx("div", { className: "w-full h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden", children: faceImage ? (_jsx("img", { src: `data:image/jpeg;base64,${faceImage}`, alt: "Face from ID", className: "w-full h-full object-cover" })) : (_jsx("div", { className: "text-gray-500 dark:text-gray-400", children: "No face detected" })) })] }), _jsxs("div", { className: "mb-4", children: [_jsx(Label, { className: "text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block", children: "Take a Selfie" }), _jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "w-full h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border-2 border-dashed border-gray-300 dark:border-gray-600", onClick: () => setShowCamera(true), children: selfiePreview ? (_jsx("img", { src: selfiePreview, alt: "Selfie preview", className: "w-full h-full object-cover rounded-lg" })) : (_jsxs("div", { className: "text-center", children: [_jsxs("div", { className: "relative", children: [_jsxs("svg", { className: "w-12 h-12 text-gray-400 mx-auto mb-2", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [_jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" }), _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 13a3 3 0 11-6 0 3 3 0 016 0z" })] }), _jsx("div", { className: "absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center", children: _jsx("svg", { className: "w-3 h-3 text-white", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z", clipRule: "evenodd" }) }) })] }), _jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: "Tap to take a selfie with camera" })] })) }), selfieFile && (_jsxs("div", { className: "flex items-center justify-center space-x-2", children: [_jsxs("div", { className: "flex flex-col items-center", children: [_jsxs("p", { className: "text-xs text-gray-600 dark:text-gray-400", children: ["Selfie captured: ", selfieFile.name] }), lastSelfieTimestamp && (_jsxs("p", { className: "text-xs text-blue-600 dark:text-blue-400", children: ["Captured: ", new Date(lastSelfieTimestamp).toLocaleTimeString()] }))] }), _jsx(Button, { size: "sm", variant: "outline", onClick: () => setShowCamera(true), className: "text-xs h-6 px-2", children: "Retake" })] }))] })] }), verificationResult && (_jsx(motion.div, { initial: { opacity: 0, y: -10 }, animate: { opacity: 1, y: 0 }, className: `p-4 rounded-lg border ${verificationResult.is_match
                                                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                                                : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"}`, children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: `w-10 h-10 rounded-lg flex items-center justify-center ${verificationResult.is_match
                                                            ? "bg-emerald-100 dark:bg-emerald-800"
                                                            : "bg-red-100 dark:bg-red-800"}`, children: verificationResult.is_match ? (_jsx(CheckCircle, { className: "w-5 h-5 text-emerald-600 dark:text-emerald-400" })) : (_jsx(X, { className: "w-5 h-5 text-red-600 dark:text-red-400" })) }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: `text-sm font-medium ${verificationResult.is_match
                                                                    ? "text-emerald-800 dark:text-emerald-200"
                                                                    : "text-red-800 dark:text-red-200"}`, children: verificationResult.is_match ? "Identity Verified" : "Verification Failed" }), _jsxs("p", { className: `text-xs ${verificationResult.is_match
                                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                                    : "text-red-600 dark:text-red-400"}`, children: ["Similarity: ", (verificationResult.similarity_score * 100).toFixed(1), "% \u2022 ", verificationResult.confidence, " confidence", lastSelfieTimestamp && (_jsxs("span", { className: "ml-2 text-gray-500", children: ["\u2022 Verified: ", new Date(lastSelfieTimestamp).toLocaleTimeString()] }))] })] })] }) })), !verificationResult && (_jsxs("div", { className: "space-y-2", children: [_jsx(Button, { onClick: handleVerifyIdentity, disabled: isVerifying || !selfieFile, className: "w-full h-12 text-lg font-semibold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed", children: isVerifying ? (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsxs("svg", { className: "animate-spin h-5 w-5 text-white", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), _jsx("span", { children: "Verifying..." })] })) : (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(CheckCircle, { className: "w-5 h-5" }), _jsx("span", { children: "Verify Identity" })] })) }), lastSelfieTimestamp && (_jsx("p", { className: "text-xs text-center text-blue-600 dark:text-blue-400", children: "\u2728 Fresh selfie captured - verification will use new image" }))] })), verificationResult && !verificationResult.is_match && (_jsx(Button, { onClick: handleVerifyIdentity, disabled: isVerifying || !selfieFile, className: "w-full h-12 text-lg font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed", children: isVerifying ? (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsxs("svg", { className: "animate-spin h-5 w-5 text-white", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), _jsx("span", { children: "Retrying..." })] })) : (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" }) }), _jsx("span", { children: "Retry Verification" })] })) })), verificationResult && verificationResult.is_match && (_jsx(Button, { onClick: () => {
                                                setVerificationResult(null);
                                                setIsIdentityVerified(false);
                                                setSelfieFile(null);
                                                setSelfiePreview(null);
                                                setLastSelfieTimestamp(null);
                                            }, variant: "outline", className: "w-full h-10 text-sm font-medium border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800", children: _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" }) }), _jsx("span", { children: "Take New Selfie" })] }) }))] }) }), _jsxs("div", { className: "space-y-8", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 dark:text-white mb-4", children: "Edit Information" }), !isIdentityVerified ? (_jsx("div", { className: "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-800 flex items-center justify-center", children: _jsx("svg", { className: "w-4 h-4 text-amber-600 dark:text-amber-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" }) }) }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "text-sm font-medium text-amber-800 dark:text-amber-200", children: "Identity verification required" }), _jsx("p", { className: "text-xs text-amber-600 dark:text-amber-400", children: "Please verify your identity by taking a selfie before you can edit the information." })] })] }) })) : (_jsx("p", { className: "text-sm text-gray-600 dark:text-gray-400 mb-6", children: "\u2705 Identity verified! You can now edit the extracted information." }))] }), _jsx("div", { className: "space-y-6", children: fieldsToShow.map(({ key, label, required }) => (_jsxs("div", { className: "space-y-2", children: [_jsxs(Label, { className: "text-sm font-medium text-gray-700 dark:text-gray-300", children: [label, " ", required && _jsx("span", { className: "text-red-500", children: "*" })] }), editingField === key ? (_jsxs("div", { className: "flex space-x-2", children: [_jsx(Input, { value: getFieldValue(key, fieldsToShow.find(f => f.key === key)?.fallbackKeys), onChange: (e) => handleFieldEdit(key, e.target.value), className: "flex-1", autoFocus: true, disabled: !isIdentityVerified }), _jsx(Button, { size: "sm", onClick: () => handleSaveField(key), className: "bg-emerald-500 hover:bg-emerald-600", disabled: !isIdentityVerified, children: _jsx(Save, { className: "w-4 h-4" }) }), _jsx(Button, { size: "sm", variant: "outline", onClick: () => setEditingField(null), children: _jsx(X, { className: "w-4 h-4" }) })] })) : (_jsxs("div", { className: `flex items-center justify-between p-4 rounded-lg border transition-colors ${isIdentityVerified
                                                        ? "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                                        : "bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-600 cursor-not-allowed opacity-60"}`, onClick: () => isIdentityVerified && setEditingField(key), children: [_jsx("span", { className: "text-gray-900 dark:text-white", children: getFieldValue(key, fieldsToShow.find(f => f.key === key)?.fallbackKeys) || 'Not available' }), _jsx(Edit3, { className: `w-4 h-4 ${isIdentityVerified ? 'text-gray-400' : 'text-gray-300'}` })] }))] }, key))) }), _jsx(Button, { onClick: handleSubmit, disabled: !isIdentityVerified, className: "w-full h-12 text-lg font-semibold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed", children: _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(CheckCircle, { className: "w-5 h-5" }), _jsx("span", { children: isIdentityVerified ? "Submit Changes" : "Verify Identity First" })] }) })] })] })] }), _jsx(CameraCapture, { isOpen: showCamera, onCapture: handleCameraCapture, onCancel: handleCameraCancel })] }));
}
