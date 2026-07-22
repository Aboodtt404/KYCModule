"use client";
import React, { useState, useRef, useEffect } from "react";
import { Loader2, Camera, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { verifyFace } from "../../services/faceVerification";
import { useActor } from "@/hooks/useActor";

const createCameraManager = () => ({
    stream: null, isStarting: false, isStarted: false, videoElement: null,
    async start(videoElement, { onReady, onError }) {
        if (this.isStarted || this.isStarting) { return; }
        this.isStarting = true; this.videoElement = videoElement;
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                onError("Camera not available. This feature requires HTTPS or localhost. Please use the file upload option instead.");
                return;
            }
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

// Compute grayscale standard deviation as a sharpness proxy (ported from Android SDK best-frame logic)
function computeSharpness(imageData) {
    const d = imageData.data;
    let sum = 0, n = 0;
    for (let i = 0; i < d.length; i += 16) {
        sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        n++;
    }
    const mean = sum / n;
    let variance = 0;
    for (let i = 0; i < d.length; i += 16) {
        const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        variance += (g - mean) ** 2;
    }
    return { stdDev: Math.sqrt(variance / n), mean };
}

function getQualityWarning(mean, stdDev) {
    if (mean < 40)   return "Image is too dark — move to a better-lit area.";
    if (mean > 220)  return "Image is overexposed — avoid direct light sources.";
    if (stdDev < 18) return "Image appears blurry — hold your device steady.";
    return null;
}

const FaceVerificationStep = ({ idFaceImage, onVerified, onSkip, submissionId }) => {
    const { actor } = useActor();
    const [step, setStep] = useState("consent"); // consent → instruction → camera
  const [error, setError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
    const [cameraReady, setCameraReady] = useState(false);
    const [qualityWarning, setQualityWarning] = useState(null);
    const [consentPending, setConsentPending] = useState(false);
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [challengeFrames, setChallengeFrames] = useState([]);
    const [challengePrompt, setChallengePrompt] = useState(null);
    const MAX_ATTEMPTS = 3;
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

    useEffect(() => {
        return () => { setCapturedImage(null); setChallengeFrames([]); };
    }, []);

  // Downscaled JPEG grab for liveness challenge frames — keeps the request payload small.
  const grabChallengeFrame = (video, maxW = 480, quality = 0.7) => {
    const scale = Math.min(1, maxW / video.videoWidth);
    const c = document.createElement("canvas");
    c.width = Math.round(video.videoWidth * scale);
    c.height = Math.round(video.videoHeight * scale);
    c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", quality);
  };

  // Best-frame capture: take 3 frames 250 ms apart and keep the sharpest.
  // Mirrors Android SDK's CaptureActivity best-frame selection (face_quality comparison).
  // Preceded by an active liveness challenge: 3 frames during a guided head turn.
  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;

    // Active liveness challenge sequence. Abort quietly if the camera goes away
    // mid-sequence (user pressed Cancel/Escape, component unmounted).
    const cameraAlive = () => videoRef.current && videoRef.current.videoWidth > 0;
    const frames = [];
    const sequence = [
      ["Look straight at the camera", 1200],
      ["Slowly turn your head to the LEFT", 1800],
      ["Now look straight again", 1500],
    ];
    for (const [prompt, holdMs] of sequence) {
      setChallengePrompt(prompt);
      await new Promise(r => setTimeout(r, holdMs));
      if (!cameraAlive()) { setChallengePrompt(null); return; }
      frames.push(grabChallengeFrame(videoRef.current));
    }
    setChallengePrompt(null);
    setChallengeFrames(frames);

    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");

    let bestDataUrl = null;
    let bestStdDev = -1;
    let bestMean = 128;
    const cx = Math.floor(canvas.width / 4);
    const cy = Math.floor(canvas.height / 4);
    const sw = Math.floor(canvas.width / 2);
    const sh = Math.floor(canvas.height / 2);

    for (let i = 0; i < 3; i++) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const { stdDev, mean } = computeSharpness(ctx.getImageData(cx, cy, sw, sh));
      if (stdDev > bestStdDev) {
        bestStdDev = stdDev;
        bestMean = mean;
        bestDataUrl = canvas.toDataURL("image/jpeg");
      }
      if (i < 2) await new Promise(r => setTimeout(r, 250));
    }

    setCapturedImage(bestDataUrl);
    setQualityWarning(getQualityWarning(bestMean, bestStdDev));
    cameraManager.current.stop();
    setStep("preview");
  };

  const handleVerify = async () => {
    if (!capturedImage || !idFaceImage) return;
    setStep("verifying");
    setError(null);
    try {
      const liveImageBase64 = capturedImage.split(",")[1] || capturedImage;
      const idImageBase64 = idFaceImage.split(",")[1] || idFaceImage;
      const challengeBase64 = challengeFrames.map(f => f.split(",")[1]).filter(Boolean);
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Verification timed out. Please try again — this can happen on slow connections.")), 45000)
      );
      const result = await Promise.race([verifyFace(idImageBase64, liveImageBase64, challengeBase64), timeout]);
      setVerificationResult(result.verification_result);
            cameraManager.current.stop();
      if (result.verification_result.is_match) {
        setStep("success");
                setTimeout(onVerified, 2000);
      } else {
        setFailedAttempts(prev => prev + 1);
        if (result.verification_result.liveness_failed) {
          const reason = result.verification_result.liveness_reason;
          if (reason === "no_motion") {
            setError("We couldn't detect any head movement. Please follow the on-screen prompts and turn your head when asked — don't hold up a photo.");
          } else if (reason === "identity_changed") {
            setError("A different face was detected during the check. Please make sure the same person stays in frame the whole time.");
          } else {
            setError("Selfie doesn't look like a live person. Please ensure you are not holding up a photo, and that you have good lighting.");
          }
        }
        setStep("failed");
      }
    } catch (err) {
            cameraManager.current.stop();
            setFailedAttempts(prev => prev + 1);
            setError(err.message || "Face verification failed.");
      setStep("failed");
    }
  };
  
  const handleRetry = () => {
        cameraManager.current.stop();
    setCapturedImage(null);
    setChallengeFrames([]);
    setChallengePrompt(null);
    setVerificationResult(null);
    setError(null);
    setStep("instruction");
  };

  const handleConsent = async () => {
    setConsentPending(true);
    try {
      if (actor?.log_consent_event) {
        await actor.log_consent_event(submissionId || "unknown");
      }
      setStep("instruction");
    } catch (err) {
      setError("Could not record your consent. Please check your connection and try again.");
    } finally {
      setConsentPending(false);
    }
  };

  const ConsentScreen = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 text-center">
      <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
        <Camera className="w-7 h-7 text-blue-400" />
      </div>
      <h3 className="text-lg font-bold text-white">Biometric Data Consent</h3>
      <div className="text-left bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-gray-300 space-y-2">
        <p>To complete identity verification, we need to:</p>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li>Capture a live selfie using your camera</li>
          <li>Compare your face against your ID photo</li>
          <li>Store the verification result on the ICP blockchain</li>
        </ul>
        <p className="text-gray-400 text-xs mt-3">
          Your face image is used only for this verification. It is processed locally and the result — not the raw image — is stored on-chain.
        </p>
      </div>
      <div className="flex gap-3">
        <button
 onClick={onSkip}
 className="flex-1 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-medium text-sm active:bg-white/20"
 >
          Decline
        </button>
        <button
 onClick={handleConsent}
 disabled={consentPending}
 className="flex-1 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 active:bg-brand-700 transition-colors text-white font-semibold text-sm disabled:opacity-60"
 >
          {consentPending ? "Recording…" : "I Agree & Continue"}
        </button>
      </div>
    </motion.div>
  );

  const renderContent = () => {
    switch (step) {
            case "consent":     return <ConsentScreen />;
            case "instruction": return <InstructionScreen onStart={() => setStep("camera")} idFaceImage={idFaceImage} />;
            case "camera": return <CameraScreen videoRef={videoRef} onCapture={handleCapture} onCancel={handleRetry} cameraReady={cameraReady} error={error} challengePrompt={challengePrompt} />;
            case "preview": return <PreviewScreen image={capturedImage} onConfirm={handleVerify} onRetry={() => setStep("camera")} qualityWarning={qualityWarning} />;
            case "verifying": return <LoadingScreen text="Verifying..." />;
            case "success": return <ResultScreen isSuccess={true} result={verificationResult} />;
            case "failed": return <ResultScreen isSuccess={false} result={verificationResult} error={error} onRetry={failedAttempts < MAX_ATTEMPTS ? handleRetry : null} attemptsLeft={MAX_ATTEMPTS - failedAttempts} onSkip={onSkip} />;
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
    <p className="text-xs sm:text-sm text-brand-300/90 px-2">
      After you press Capture, you'll be asked to briefly turn your head — this proves you're a real person and not a photo.
    </p>
    <button
 onClick={onStart}
 className="w-full py-3 sm:py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white font-semibold transition-colors transform active:scale-[0.98] touch-manipulation min-h-[44px] text-sm sm:text-base"
 disabled={!idFaceImage}
 style={{ WebkitTapHighlightColor: 'transparent' }}
 >
      {idFaceImage ? "Start Camera" : "Cannot Proceed (No ID Photo)"}
    </button>
  </motion.div>
);

const CameraScreen = ({ videoRef, onCapture, onCancel, cameraReady, error, challengePrompt }) => {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);
  return (
  <motion.div
    key="camera"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    role="dialog"
    aria-modal="true"
    aria-label="Selfie camera capture"
    className="fixed inset-0 bg-slate-950 z-[100] flex flex-col"
  >
    {/* Header */}
    <div className="flex items-center justify-between px-4 py-3 bg-slate-900/95 backdrop-blur-sm border-b border-white/5">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <Camera className="w-4 h-4" />
        <span>Take a Selfie</span>
      </h3>
      <button
 onClick={onCancel}
 aria-label="Close camera"
 className="p-2 text-white hover:bg-white/10 rounded-xl transition"
 >
        <X className="w-5 h-5" />
      </button>
    </div>

    {/* Camera View - Fullscreen */}
    <div className="flex-1 relative flex flex-col">
      <div className="flex-1 relative bg-black overflow-hidden">
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
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-12 h-6 border-t-4 border-brand-400 rounded-t-full"></div>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-12 h-6 border-b-4 border-brand-400 rounded-b-full"></div>
            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-6 h-12 border-l-4 border-brand-400 rounded-l-full"></div>
            <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-6 h-12 border-r-4 border-brand-400 rounded-r-full"></div>
          </div>

          {/* Instruction pill — anchored to the camera view so it can never overlap the buttons */}
          <div className="absolute bottom-4 inset-x-0 z-10 flex justify-center px-4" aria-live="assertive">
            {challengePrompt ? (
              <p className="bg-brand-600/90 backdrop-blur-sm text-white font-bold text-sm sm:text-base px-5 py-2 rounded-full shadow-lg animate-pulse text-center">
                {challengePrompt}
              </p>
            ) : (
              <p className="bg-black/60 backdrop-blur-sm text-white font-medium text-xs sm:text-sm px-4 py-2 rounded-full shadow-lg text-center">
                Position your face in frame · Good lighting
              </p>
            )}
          </div>
        </div>

        {/* Loading indicator */}
        {!cameraReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90">
            <div className="text-center px-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-400 mx-auto mb-3"></div>
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
      <div className="p-3 sm:p-4 pb-safe bg-slate-900/95 backdrop-blur-sm border-t border-white/5" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="flex gap-2 sm:gap-3 max-w-md mx-auto">
        <button
 onClick={onCancel}
 className="px-4 sm:px-6 py-3 sm:py-4 bg-white/10 active:bg-white/20 text-white rounded-xl font-medium transition text-xs sm:text-sm touch-manipulation min-h-[44px] flex items-center justify-center"
 style={{ WebkitTapHighlightColor: 'transparent' }}
 >
          Cancel
        </button>
        <button
 onClick={onCapture}
 disabled={!cameraReady || !!challengePrompt}
 className="flex-1 px-4 sm:px-6 py-3 sm:py-4 bg-brand-500 active:bg-brand-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg touch-manipulation min-h-[44px]"
 style={{ WebkitTapHighlightColor: 'transparent' }}
 >
            <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-xs sm:text-sm">{challengePrompt ? "Follow the prompt…" : "Capture"}</span>
        </button>
        </div>
      </div>
    </div>
  </motion.div>
  );
};

const PreviewScreen = ({ image, onConfirm, onRetry, qualityWarning }) => {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onRetry(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onRetry]);
  return (
  <motion.div
    key="preview"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    role="dialog"
    aria-modal="true"
    aria-label="Selfie preview review"
    className="fixed inset-0 bg-slate-950 z-[100] flex flex-col"
  >
    {/* Header */}
    <div className="flex items-center justify-between px-4 py-3 bg-slate-900/95 backdrop-blur-sm border-b border-white/5">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <Check className="w-4 h-4" />
        <span>Review Selfie</span>
      </h3>
    </div>

    {/* Preview Image - Fullscreen */}
    <div className="flex-1 flex flex-col bg-slate-950">
      <div className="flex-1 relative flex flex-col items-center justify-center p-4">
        <p className="text-white text-base font-medium mb-3">Is this picture clear?</p>
        <img
          src={image}
          alt="Captured selfie"
          className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-2xl"
        />
        {qualityWarning && (
          <div className="mt-3 flex items-start gap-2 bg-yellow-500/15 border border-yellow-500/30 rounded-lg px-3 py-2 text-sm text-yellow-300 max-w-sm">
            <span className="shrink-0 mt-0.5">⚠</span>
            <span>{qualityWarning} Please retake for best results.</span>
          </div>
        )}
      </div>

      {/* Action Buttons - Bottom Fixed */}
      <div className="p-3 sm:p-4 pb-safe bg-slate-900/95 backdrop-blur-sm border-t border-white/5" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="flex gap-2 sm:gap-3 max-w-md mx-auto">
      <button
 onClick={onRetry}
 className="flex-1 px-4 sm:px-6 py-3 sm:py-4 bg-white/10 active:bg-white/20 text-white rounded-xl font-medium transition touch-manipulation min-h-[44px] flex items-center justify-center text-xs sm:text-sm"
 style={{ WebkitTapHighlightColor: 'transparent' }}
 >
        Retake
      </button>
      <button
 onClick={onConfirm}
 disabled={!!qualityWarning}
 className="flex-1 px-4 sm:px-6 py-3 sm:py-4 bg-brand-500 active:bg-brand-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg touch-manipulation min-h-[44px]"
 style={{ WebkitTapHighlightColor: 'transparent' }}
 >
            <Check className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className="text-xs sm:text-sm">{qualityWarning ? "Retake Required" : "Yes, looks good"}</span>
      </button>
        </div>
      </div>
    </div>
  </motion.div>
  );
};

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

const ResultScreen = ({ isSuccess, result, error, onRetry, attemptsLeft, onSkip }) => (
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
    {error && <p className="text-red-400 text-sm">{error}</p>}
    {!isSuccess && onRetry && (
      <div className="space-y-2">
        {attemptsLeft > 0 && (
          <p className="text-yellow-400 text-xs">{attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining</p>
        )}
        <button
 onClick={onRetry}
 className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold transition hover:bg-blue-700"
 >
          Try Again
        </button>
      </div>
    )}
    {!isSuccess && !onRetry && (
      <div className="space-y-3">
        <p className="text-sm text-gray-300 bg-white/5 rounded-lg p-3">
          Face verification could not be completed after {3} attempts. You may skip this step and a reviewer will manually verify your identity.
        </p>
        <button
 onClick={onSkip}
 className="w-full py-3 rounded-xl bg-white/10 border border-white/20 text-white font-medium transition hover:bg-white/20"
 >
          Skip Face Verification
        </button>
      </div>
    )}
  </motion.div>
);

export { FaceVerificationStep };
