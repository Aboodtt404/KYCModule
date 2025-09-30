"use client";
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, CheckCircle, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { verifyFace } from "@/services/faceVerification";

export function FaceVerificationStep({ idFaceImage, onVerified, onSkip }) {
    const [step, setStep] = useState("instruction"); // instruction, capturing, preview, verifying, success, failed
    const [capturedImage, setCapturedImage] = useState(null);
    const [capturedImagePreview, setCapturedImagePreview] = useState(null);
    const [verificationResult, setVerificationResult] = useState(null);
    const [error, setError] = useState(null);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    // Start camera for live capture
    const startCamera = async () => {
        try {
            console.log("🎥 Starting camera...");
            setError(null);

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "user", // Front camera
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            });

            console.log("✅ Camera access granted");
            streamRef.current = stream;
            setStep("capturing"); // Change step AFTER getting stream

            // Wait a bit for React to render the video element
            setTimeout(() => {
                if (videoRef.current) {
                    console.log("📹 Attaching stream to video...");
                    videoRef.current.srcObject = stream;
                } else {
                    console.error("❌ Video ref is null after timeout");
                }
            }, 100);
        } catch (err) {
            console.error("❌ Camera error:", err);
            setError(`Unable to access camera: ${err.message}`);
            setStep("instruction");
        }
    };

    // Stop camera
    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    };

    // Capture photo from video
    const capturePhoto = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (!video || !canvas) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        context.drawImage(video, 0, 0);

        // Convert to base64
        const base64data = canvas.toDataURL("image/jpeg", 0.95).split(',')[1];
        const previewUrl = canvas.toDataURL("image/jpeg", 0.95);

        setCapturedImage(base64data);
        setCapturedImagePreview(previewUrl);

        stopCamera();
        setStep("preview");
        console.log("✅ Photo captured");
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => stopCamera();
    }, []);

    const verifyFaces = async (liveFaceBase64) => {
        setStep("verifying");
        setError(null);

        try {
            console.log("🔍 Starting face verification...");
            const result = await verifyFace(idFaceImage, liveFaceBase64);

            console.log("✅ Face verification result:", result);
            setVerificationResult(result.verification_result);

            if (result.verification_result.is_match) {
                setStep("success");
                // Auto-proceed after 2 seconds
                setTimeout(() => {
                    onVerified();
                }, 2000);
            } else {
                setStep("failed");
            }
        } catch (err) {
            console.error("Face verification error:", err);
            setError(err.message || "Face verification failed. Please try again.");
            setStep("failed");
        }
    };

    const handleRetry = () => {
        // Clean up
        stopCamera();
        setCapturedImage(null);
        setCapturedImagePreview(null);
        setVerificationResult(null);
        setError(null);
        setStep("instruction");
    };

    const handleVerify = () => {
        if (capturedImage) {
            verifyFaces(capturedImage);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10"
            >
                {/* Header */}
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">
                        Face Verification
                    </h2>
                    <p className="text-gray-400">
                        Let's verify that you're the owner of this ID
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {/* Instruction Screen */}
                    {step === "instruction" && (
                        <motion.div
                            key="instruction"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 space-y-4">
                                <div className="flex items-start gap-3">
                                    <Camera className="w-5 h-5 text-blue-400 mt-1" />
                                    <div>
                                        <h3 className="font-semibold text-white mb-1">Take a clear selfie</h3>
                                        <p className="text-sm text-gray-300">Make sure your face is clearly visible</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-400 mt-1" />
                                    <div>
                                        <h3 className="font-semibold text-white mb-1">Good lighting</h3>
                                        <p className="text-sm text-gray-300">Find a well-lit area for best results</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-yellow-400 mt-1" />
                                    <div>
                                        <h3 className="font-semibold text-white mb-1">Remove accessories</h3>
                                        <p className="text-sm text-gray-300">Take off glasses, hats, or masks</p>
                                    </div>
                                </div>
                            </div>

                            {/* ID Face Preview */}
                            {idFaceImage && (
                                <div className="text-center">
                                    <p className="text-sm text-gray-400 mb-3">We'll compare your selfie with this photo from your ID:</p>
                                    <img
                                        src={`data:image/jpeg;base64,${idFaceImage}`}
                                        alt="ID Face"
                                        className="w-32 h-32 mx-auto rounded-full object-cover border-4 border-white/20"
                                    />
                                </div>
                            )}

                            {/* Camera Button */}
                            <div className="space-y-3">
                                <Button
                                    type="button"
                                    onClick={startCamera}
                                    className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                                >
                                    <Camera className="w-5 h-5 mr-2" />
                                    Take Selfie
                                </Button>

                                <p className="text-xs text-gray-400 text-center">
                                    📸 For security, you must take a live photo (no uploads allowed)
                                </p>
                            </div>

                            {/* Skip button (for testing) */}
                            <Button
                                variant="ghost"
                                onClick={onSkip}
                                className="w-full text-gray-400 hover:text-white"
                            >
                                Skip for now (Testing)
                            </Button>
                        </motion.div>
                    )}

                    {/* Camera Capturing Screen */}
                    {step === "capturing" && (
                        <motion.div
                            key="capturing"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-4"
                        >
                            <div className="text-center mb-4">
                                <p className="text-gray-300">Position your face in the frame</p>
                            </div>

                            <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover transform scale-x-[-1]"
                                />

                                {/* Face oval guide */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-48 h-64 border-4 border-white/50 rounded-full"></div>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    onClick={capturePhoto}
                                    className="flex-1 h-12 text-lg font-semibold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                                >
                                    <Camera className="w-5 h-5 mr-2" />
                                    Capture Photo
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        stopCamera();
                                        setStep("instruction");
                                    }}
                                    className="h-12"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {/* Preview Screen */}
                    {step === "preview" && (
                        <motion.div
                            key="preview"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-6"
                        >
                            <div className="text-center">
                                <p className="text-gray-400 mb-4">Preview your photo:</p>
                                <img
                                    src={capturedImagePreview}
                                    alt="Your selfie"
                                    className="w-64 h-64 mx-auto rounded-lg object-cover border-4 border-white/20"
                                />
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    onClick={handleVerify}
                                    className="flex-1 h-12 text-lg font-semibold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                                >
                                    <CheckCircle className="w-5 h-5 mr-2" />
                                    Verify Face
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={handleRetry}
                                    className="flex-1 h-12 text-lg font-semibold"
                                >
                                    <RefreshCw className="w-5 h-5 mr-2" />
                                    Retake
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {/* Verifying Screen */}
                    {step === "verifying" && (
                        <motion.div
                            key="verifying"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-12 space-y-4"
                        >
                            <Loader2 className="w-16 h-16 animate-spin text-blue-400 mx-auto" />
                            <h3 className="text-xl font-semibold text-white">Verifying your face...</h3>
                            <p className="text-gray-400">Please wait while we compare the images</p>
                        </motion.div>
                    )}

                    {/* Success Screen */}
                    {step === "success" && verificationResult && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-12 space-y-4"
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", duration: 0.5 }}
                            >
                                <CheckCircle className="w-24 h-24 text-green-400 mx-auto" />
                            </motion.div>
                            <h3 className="text-2xl font-bold text-white">Verification Successful!</h3>
                            <p className="text-gray-300">
                                Similarity Score: <span className="font-bold text-green-400">
                                    {(verificationResult.similarity_score * 100).toFixed(1)}%
                                </span>
                            </p>
                            <p className="text-sm text-gray-400">Redirecting to next step...</p>
                        </motion.div>
                    )}

                    {/* Failed Screen */}
                    {step === "failed" && (
                        <motion.div
                            key="failed"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-12 space-y-6"
                        >
                            <AlertCircle className="w-24 h-24 text-red-400 mx-auto" />
                            <h3 className="text-2xl font-bold text-white">Verification Failed</h3>
                            {verificationResult && (
                                <p className="text-gray-300">
                                    Similarity Score: <span className="font-bold text-red-400">
                                        {(verificationResult.similarity_score * 100).toFixed(1)}%
                                    </span>
                                </p>
                            )}
                            <p className="text-gray-400">
                                {error || "The faces don't match. Please ensure you're using your own ID."}
                            </p>

                            <div className="flex gap-3">
                                <Button
                                    onClick={handleRetry}
                                    className="flex-1 bg-blue-500 hover:bg-blue-600"
                                >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Try Again
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={onSkip}
                                    className="flex-1"
                                >
                                    Skip for now
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Error Message */}
                {error && step !== "failed" && (
                    <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}
            </motion.div>

            {/* Hidden canvas for photo capture */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}