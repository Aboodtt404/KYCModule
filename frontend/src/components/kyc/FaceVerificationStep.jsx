"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, Camera, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { verifyFace } from "../../services/faceVerification";

const FaceVerificationStep = ({ idFaceImage, onVerified, onSkip }) => {
  const [step, setStep] = useState("instruction"); // instruction, camera, preview, verifying, success, failed
  const [error, setError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Could not access the camera. Please check your browser permissions.");
      setStep("failed");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (step === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    return stopCamera;
  }, [step, startCamera, stopCamera]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg");
      setCapturedImage(dataUrl);
      setStep("preview");
    }
  };

  const handleVerify = async () => {
    if (!capturedImage || !idFaceImage) return;

    setStep("verifying");
    setError(null);

    try {
      // Ensure both images are raw base64 strings
      const liveImageBase64 = capturedImage.split(",")[1] || capturedImage;
      const idImageBase64 = idFaceImage.split(",")[1] || idFaceImage;

      const result = await verifyFace(idImageBase64, liveImageBase64);
      setVerificationResult(result.verification_result);

      if (result.verification_result.is_match) {
        setStep("success");
        setTimeout(onVerified, 2000); // Auto-proceed after 2 seconds
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
    setCapturedImage(null);
    setVerificationResult(null);
    setError(null);
    setStep("instruction");
  };

  const renderContent = () => {
    switch (step) {
      case "instruction":
        return (
          <InstructionScreen
            onStart={() => setStep("camera")}
            idFaceImage={idFaceImage}
          />
        );
      case "camera":
        return (
          <CameraScreen
            videoRef={videoRef}
            onCapture={handleCapture}
            onCancel={handleRetry}
          />
        );
      case "preview":
        return (
          <PreviewScreen
            image={capturedImage}
            onConfirm={handleVerify}
            onRetry={() => setStep("camera")}
          />
        );
      case "verifying":
        return <LoadingScreen text="Verifying..." />;
      case "success":
        return <ResultScreen isSuccess={true} result={verificationResult} />;
      case "failed":
        return (
          <ResultScreen
            isSuccess={false}
            result={verificationResult}
            error={error}
            onRetry={handleRetry}
          />
        );
      default:
        return <div>Invalid step</div>;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 bg-white/10 rounded-2xl">
      <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
      {/* A canvas for capturing the image, hidden from view */}
      <canvas ref={canvasRef} style={{ display: "none" }}></canvas>
    </div>
  );
};

// --- Child Components for each step ---

const InstructionScreen = ({ onStart, idFaceImage }) => (
  <motion.div
    key="instruction"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="text-center space-y-6 p-6"
  >
    <h2 className="text-2xl font-bold text-white">Face Verification</h2>
    <p className="text-gray-300">
      Next, we need to verify your identity by comparing your face with the photo on your ID.
    </p>
    <div className="flex justify-center items-center gap-4">
      <div className="w-32 h-40 bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center">
        {idFaceImage ? (
          <img
            src={idFaceImage}
            alt="Face from ID"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-xs text-gray-400 p-2">No ID Photo Found</div>
        )}
      </div>
      <div className="text-5xl">➡️</div>
      <div className="w-32 h-40 bg-gray-700 rounded-lg flex flex-col items-center justify-center">
        <Camera className="w-12 h-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-300">Live Selfie</p>
      </div>
    </div>
    <p className="text-sm text-gray-400">
      Please position your face in a well-lit area, remove any hats or glasses, and look directly at the camera.
    </p>
    <button
      onClick={onStart}
      className="w-full py-3 rounded-xl bg-emerald-500 text-black font-semibold transition transform hover:scale-105"
      disabled={!idFaceImage}
    >
      {idFaceImage ? "Start Camera" : "Cannot Proceed (No ID Photo)"}
    </button>
  </motion.div>
);

const CameraScreen = ({ videoRef, onCapture, onCancel }) => (
  <motion.div
    key="camera"
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    className="space-y-4"
  >
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      <div className="absolute inset-0 border-8 border-white/50 rounded-lg" />
    </div>
    <div className="flex gap-4">
        <button
          onClick={onCancel}
          className="w-full py-3 rounded-xl bg-gray-600 text-white font-semibold transition hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={onCapture}
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold transition hover:bg-blue-700"
        >
          Capture
        </button>
    </div>
  </motion.div>
);

const PreviewScreen = ({ image, onConfirm, onRetry }) => (
  <motion.div
    key="preview"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="space-y-4"
  >
    <h3 className="text-xl font-semibold text-center text-white">Is this picture clear?</h3>
    <img src={image} alt="Captured selfie" className="w-full aspect-video object-cover rounded-lg" />
    <div className="flex gap-4">
      <button
        onClick={onRetry}
        className="w-full py-3 rounded-xl bg-gray-600 text-white font-semibold transition hover:bg-gray-700"
      >
        Retake
      </button>
      <button
        onClick={onConfirm}
        className="w-full py-3 rounded-xl bg-emerald-500 text-black font-semibold transition hover:bg-emerald-600"
      >
        Yes, looks good
      </button>
    </div>
  </motion.div>
);

const LoadingScreen = ({ text }) => (
  <motion.div
    key="loading"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="flex flex-col items-center justify-center space-y-4 p-12"
  >
    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
    <p className="text-lg text-white font-semibold">{text}</p>
  </motion.div>
);

const ResultScreen = ({ isSuccess, result, error, onRetry }) => (
  <motion.div
    key="result"
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.8 }}
    className="text-center space-y-4 p-6"
  >
    {isSuccess ? (
      <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto ring-4 ring-green-500">
        <Check className="w-12 h-12 text-green-400" />
      </div>
    ) : (
      <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto ring-4 ring-red-500">
        <X className="w-12 h-12 text-red-400" />
      </div>
    )}
    <h2 className="text-2xl font-bold">
      {isSuccess ? "Verification Successful!" : "Verification Failed"}
    </h2>
    {result && (
      <p className="text-sm text-gray-400">
        Similarity Score:{" "}
        <span className="font-bold text-white">
          {(result.similarity_score * 100).toFixed(2)}%
        </span>
        <br />
        (Required: {(result.threshold * 100).toFixed(2)}%)
      </p>
    )}
    {error && <p className="text-red-400">{error}</p>}
    {!isSuccess && (
      <button
        onClick={onRetry}
        className="w-full py-3 mt-4 rounded-xl bg-blue-600 text-white font-semibold transition hover:bg-blue-700"
      >
        Try Again
      </button>
    )}
  </motion.div>
);

export { FaceVerificationStep };
