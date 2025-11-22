"use client";
import React, { useState, useRef, useEffect } from "react";
import { Loader2, Camera, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { verifyFace } from "../../services/faceVerification";

const createCameraManager = () => ({
    stream: null, isStarting: false, isStarted: false, videoElement: null,
    async start(videoElement, { onReady, onError }) {
        if (this.isStarted || this.isStarting) { return; }
        this.isStarting = true; this.videoElement = videoElement;
        try {
            // iOS-friendly constraints
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: "user",
                    width: { ideal: 1920, max: 4096 }, 
                    height: { ideal: 1080, max: 4096 } 
                }, 
                audio: false 
            });
            if (!this.videoElement) { this.stop(); return; }
            this.videoElement.srcObject = this.stream;
            this.videoElement.onloadedmetadata = async () => {
                try {
                    await new Promise(resolve => setTimeout(resolve, 150));
                    await this.videoElement.play();
                    this.isStarted = true; this.isStarting = false; onReady();
                } catch (playErr) { onError(playErr.message || "Failed to play video."); this.stop(); }
            };
            // iOS fallback
            this.videoElement.oncanplay = () => {
                if (!this.isStarted) {
                    this.isStarted = true; this.isStarting = false; onReady();
                }
            };
        } catch (err) { this.isStarting = false; onError(err.message || "Camera access denied."); this.stop(); }
    },
    stop() {
        if (this.stream) { this.stream.getTracks().forEach(track => track.stop()); }
        if (this.videoElement) { this.videoElement.srcObject = null; }
        this.stream = null; this.isStarted = false; this.isStarting = false; this.videoElement = null;
    },
});

const FaceVerificationStep = ({ idFaceImage, onVerified, onSkip }) => {
    const [step, setStep] = useState("instruction");
  const [error, setError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
    const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
    const cameraManager = useRef(null);
    if (!cameraManager.current) { cameraManager.current = createCameraManager(); }

    useEffect(() => {
        const manager = cameraManager.current;
        const handleCameraReady = () => { setCameraReady(true); setError(null); };
        const handleCameraError = (errMsg) => { setError(errMsg); setCameraReady(false); setTimeout(() => setStep("failed"), 2000); };
        
        if (step === "camera" && videoRef.current) {
            manager.start(videoRef.current, { onReady: handleCameraReady, onError: handleCameraError });
        }
        
        return () => { manager.stop(); setCameraReady(false); };
    }, [step]);

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
            cameraManager.current.stop();
      setStep("preview");
    }
  };

  const handleVerify = async () => {
    if (!capturedImage || !idFaceImage) return;
    setStep("verifying");
    setError(null);
    try {
      const liveImageBase64 = capturedImage.split(",")[1] || capturedImage;
      const idImageBase64 = idFaceImage.split(",")[1] || idFaceImage;
      const result = await verifyFace(idImageBase64, liveImageBase64);
      setVerificationResult(result.verification_result);
            cameraManager.current.stop();
      if (result.verification_result.is_match) {
        setStep("success");
                setTimeout(onVerified, 2000);
            } else { setStep("failed"); }
    } catch (err) {
            cameraManager.current.stop();
            setError(err.message || "Face verification failed.");
      setStep("failed");
    }
  };
  
  const handleRetry = () => {
        cameraManager.current.stop();
    setCapturedImage(null);
    setVerificationResult(null);
    setError(null);
    setStep("instruction");
  };

  const renderContent = () => {
    switch (step) {
            case "instruction": return <InstructionScreen onStart={() => setStep("camera")} idFaceImage={idFaceImage} />;
            case "camera": return <CameraScreen videoRef={videoRef} onCapture={handleCapture} onCancel={handleRetry} cameraReady={cameraReady} error={error} />;
            case "preview": return <PreviewScreen image={capturedImage} onConfirm={handleVerify} onRetry={() => setStep("camera")} />;
            case "verifying": return <LoadingScreen text="Verifying..." />;
            case "success": return <ResultScreen isSuccess={true} result={verificationResult} />;
            case "failed": return <ResultScreen isSuccess={false} result={verificationResult} error={error} onRetry={handleRetry} />;
            default: return <div>Invalid step</div>;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 bg-white/10 rounded-2xl">
      <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
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
    className="text-center space-y-4 sm:space-y-6 p-4 sm:p-6"
  >
    <h2 className="text-xl sm:text-2xl font-bold text-white">Face Verification</h2>
    <p className="text-sm sm:text-base text-gray-300 px-2">
      Next, we need to verify your identity by comparing your face with the photo on your ID.
    </p>
    <div className="flex justify-center items-center gap-2 sm:gap-4 flex-wrap">
      <div className="w-24 h-32 sm:w-32 sm:h-40 bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
        {idFaceImage ? (
          <img
            src={idFaceImage}
            alt="Face from ID"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-[10px] sm:text-xs text-gray-400 p-2 text-center">No ID Photo Found</div>
        )}
      </div>
      <div className="text-3xl sm:text-5xl">➡️</div>
      <div className="w-24 h-32 sm:w-32 sm:h-40 bg-gray-700 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
        <Camera className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400" />
        <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-300">Live Selfie</p>
      </div>
    </div>
    <p className="text-xs sm:text-sm text-gray-400 px-2">
      Please position your face in a well-lit area, remove any hats or glasses, and look directly at the camera.
    </p>
    <button
      onClick={onStart}
      className="w-full py-3 sm:py-3.5 rounded-xl bg-emerald-500 active:bg-emerald-600 text-black font-semibold transition transform active:scale-[0.98] touch-manipulation min-h-[44px] text-sm sm:text-base"
      disabled={!idFaceImage}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {idFaceImage ? "Start Camera" : "Cannot Proceed (No ID Photo)"}
    </button>
  </motion.div>
);

const CameraScreen = ({ videoRef, onCapture, onCancel, cameraReady, error }) => (
  <motion.div
    key="camera"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black z-[100] flex flex-col"
  >
    {/* Header */}
    <div className="flex items-center justify-between p-3 bg-black/50 backdrop-blur-sm">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <Camera className="w-4 h-4" />
        <span>Take a Selfie</span>
      </h3>
      <button 
        onClick={onCancel} 
        className="p-2 text-white hover:bg-white/10 rounded-full transition"
      >
        <X className="w-5 h-5" />
      </button>
    </div>

    {/* Camera View - Fullscreen */}
    <div className="flex-1 relative flex flex-col">
      <div className="flex-1 relative bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        
        {/* Face Frame Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
          {/* Semi-transparent overlay outside the frame */}
          <div className="absolute inset-0 bg-black/40"></div>
          
          {/* Face Frame - Circular */}
          <div className="relative w-full max-w-xs aspect-square z-10">
            {/* Circular frame border */}
            <div className="absolute inset-0 border-4 border-white rounded-full shadow-lg"></div>
            
            {/* Corner markers adapted to circle */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-12 h-6 border-t-4 border-emerald-400 rounded-t-full"></div>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-12 h-6 border-b-4 border-emerald-400 rounded-b-full"></div>
            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-6 h-12 border-l-4 border-emerald-400 rounded-l-full"></div>
            <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-6 h-12 border-r-4 border-emerald-400 rounded-r-full"></div>
            
            {/* Instruction text */}
            <div className="absolute -bottom-20 left-0 right-0 text-center">
              <p className="text-white font-semibold text-sm mb-1">
                Position Your Face in Frame
              </p>
              <p className="text-white/80 text-xs">
                Look directly at camera • Good lighting
              </p>
            </div>
          </div>
        </div>

        {/* Loading indicator */}
        {!cameraReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90">
            <div className="text-center px-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400 mx-auto mb-3"></div>
              <p className="text-white text-sm font-medium">Initializing camera...</p>
              <p className="text-white/60 text-xs mt-2">This should only take a moment</p>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90">
            <div className="text-center px-4">
              <div className="text-red-400 text-5xl mb-3">⚠️</div>
              <p className="text-white text-sm font-medium mb-2">Camera Error</p>
              <p className="text-white/70 text-xs">{error}</p>
              <p className="text-white/50 text-xs mt-3">Closing in 2 seconds...</p>
            </div>
          </div>
        )}
      </div>

      {/* Capture Button - Bottom Fixed */}
      <div className="p-3 sm:p-4 pb-safe bg-black/50 backdrop-blur-sm" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="flex gap-2 sm:gap-3 max-w-md mx-auto">
        <button
          onClick={onCancel}
            className="px-4 sm:px-6 py-3 sm:py-3.5 bg-white/10 active:bg-white/20 text-white rounded-full font-medium transition text-xs sm:text-sm touch-manipulation min-h-[44px] flex items-center justify-center"
            style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          Cancel
        </button>
        <button
          onClick={onCapture}
            disabled={!cameraReady}
            className="flex-1 px-4 sm:px-6 py-3 sm:py-4 bg-emerald-500 active:bg-emerald-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-full font-bold transition flex items-center justify-center gap-2 shadow-lg touch-manipulation min-h-[44px]"
            style={{ WebkitTapHighlightColor: 'transparent' }}
        >
            <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-xs sm:text-sm">Capture</span>
        </button>
        </div>
      </div>
    </div>
  </motion.div>
);

const PreviewScreen = ({ image, onConfirm, onRetry }) => (
  <motion.div
    key="preview"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black z-[100] flex flex-col"
  >
    {/* Header */}
    <div className="flex items-center justify-between p-3 bg-black/50 backdrop-blur-sm">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <Check className="w-4 h-4" />
        <span>Review Selfie</span>
      </h3>
    </div>

    {/* Preview Image - Fullscreen */}
    <div className="flex-1 flex flex-col bg-black">
      <div className="flex-1 relative flex flex-col items-center justify-center p-4">
        <p className="text-white text-base font-medium mb-3">Is this picture clear?</p>
        <img 
          src={image} 
          alt="Captured selfie" 
          className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-2xl"
        />
      </div>

      {/* Action Buttons - Bottom Fixed */}
      <div className="p-3 sm:p-4 pb-safe bg-black/50 backdrop-blur-sm" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="flex gap-2 sm:gap-3 max-w-md mx-auto">
      <button
        onClick={onRetry}
            className="flex-1 px-4 sm:px-6 py-3 sm:py-4 bg-white/10 active:bg-white/20 text-white rounded-full font-medium transition touch-manipulation min-h-[44px] flex items-center justify-center text-xs sm:text-sm"
            style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        Retake
      </button>
      <button
        onClick={onConfirm}
            className="flex-1 px-4 sm:px-6 py-3 sm:py-4 bg-emerald-500 active:bg-emerald-600 text-white rounded-full font-bold transition flex items-center justify-center gap-2 shadow-lg touch-manipulation min-h-[44px]"
            style={{ WebkitTapHighlightColor: 'transparent' }}
      >
            <Check className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className="text-xs sm:text-sm">Yes, looks good</span>
      </button>
        </div>
      </div>
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
