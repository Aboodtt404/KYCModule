import React, { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Camera, X, Check } from "lucide-react";

export function IDCameraCapture({ onCapture, onCancel, isOpen }) {
    const [mode, setMode] = useState('camera'); // 'camera' or 'preview'
    const [preview, setPreview] = useState(null);
    const [capturedBlob, setCapturedBlob] = useState(null);
    const [cameraReady, setCameraReady] = useState(false);
    const [error, setError] = useState(null);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const hasStartedCamera = useRef(false);

    const startCamera = async () => {
        if (hasStartedCamera.current || streamRef.current) return;
        hasStartedCamera.current = true;
        setError(null);
        setCameraReady(false);

        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error("Camera not available. Please use HTTPS or localhost, or use the 'Upload File' option instead.");
            }
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment",
                    width: { ideal: 1920, max: 4096 },
                    height: { ideal: 1080, max: 4096 },
                },
                audio: false,
            });

            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;

                const handleVideoReady = async () => {
                    try {
                        await new Promise(resolve => setTimeout(resolve, 150));
                        await videoRef.current.play();
                        setCameraReady(true);
                    } catch (_err) {
                        setCameraReady(true);
                    }
                };

                videoRef.current.onloadedmetadata = handleVideoReady;
                videoRef.current.oncanplay = () => {
                    if (!cameraReady) setCameraReady(true);
                };
            }
        } catch (err) {
            hasStartedCamera.current = false;
            setError(err.message || "Camera access denied");
            setTimeout(() => { onCancel(); }, 2000);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraReady(false);
        hasStartedCamera.current = false;
    };

    useEffect(() => {
        if (isOpen) startCamera();
        return () => { if (streamRef.current) stopCamera(); };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleCaptureFromCamera = () => {
        if (!videoRef.current || !canvasRef.current || !cameraReady) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            if (blob) {
                setCapturedBlob(blob);
                const previewUrl = URL.createObjectURL(blob);
                setPreview(previewUrl);
                setMode('preview');
            }
        }, "image/jpeg", 0.95);
    };

    const handleConfirm = () => {
        if (capturedBlob) {
            const file = new File([capturedBlob], `id-card-${Date.now()}.jpg`, { type: "image/jpeg" });
            stopCamera();
            onCapture(file);
        }
    };

    const handleRetake = () => {
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        setCapturedBlob(null);
        setMode('camera');
    };

    const handleCancel = () => {
        if (preview) URL.revokeObjectURL(preview);
        stopCamera();
        setPreview(null);
        setCapturedBlob(null);
        onCancel();
    };

    return (
        <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900/95 backdrop-blur-sm border-b border-white/5">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2.5">
                    {mode === 'camera' && <>
                        <span className="w-7 h-7 rounded-lg bg-brand-500/15 ring-1 ring-brand-400/30 flex items-center justify-center">
                            <Camera className="w-4 h-4 text-brand-300" />
                        </span>
                        <span>Capture ID Card</span>
                    </>}
                    {mode === 'preview' && <>
                        <span className="w-7 h-7 rounded-lg bg-brand-500/15 ring-1 ring-brand-400/30 flex items-center justify-center">
                            <Check className="w-4 h-4 text-brand-300" />
                        </span>
                        <span>Review Image</span>
                    </>}
                </h3>
                <button onClick={handleCancel} aria-label="Close camera" className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Camera Mode */}
            {mode === 'camera' && (
                <div className="flex-1 relative flex flex-col">
                    <div className="flex-1 relative bg-black overflow-hidden">
                        <video ref={videoRef} autoPlay playsInline muted
                            webkit-playsinline="true" x-webkit-airplay="allow"
                            className="w-full h-full object-cover"
                            style={{ WebkitTransform: 'translateZ(0)' }}
                        />
                        <canvas ref={canvasRef} className="hidden" />

                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/40"></div>
                            <div className="relative w-[85%] max-w-md aspect-[85.6/53.98] z-10">
                                <div className="absolute inset-0 border-3 border-white rounded-2xl shadow-lg"></div>
                                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-brand-400 rounded-tl-2xl"></div>
                                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-brand-400 rounded-tr-2xl"></div>
                                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-brand-400 rounded-bl-2xl"></div>
                                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-brand-400 rounded-br-2xl"></div>
                            </div>
                            {/* Instruction pill — anchored to the camera view so it can never overlap the buttons */}
                            <div className="absolute bottom-4 inset-x-0 z-10 flex justify-center px-4">
                                <p className="bg-black/60 backdrop-blur-sm text-white font-medium text-xs sm:text-sm px-4 py-2 rounded-full shadow-lg">
                                    Position ID Card in Frame
                                </p>
                            </div>
                        </div>

                        {!cameraReady && !error && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/90">
                                <div className="text-center px-4">
                                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-400 mx-auto mb-3"></div>
                                    <p className="text-white text-sm font-medium">Initializing camera...</p>
                                    <p className="text-white/60 text-xs mt-2">This should only take a moment</p>
                                </div>
                            </div>
                        )}

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

                    <div className="p-3 sm:p-4 pb-safe bg-slate-900/95 backdrop-blur-sm border-t border-white/5" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
                        <div className="flex gap-2 sm:gap-3 max-w-md mx-auto">
                            <button type="button" onClick={handleCancel}
                                onTouchEnd={(e) => { e.preventDefault(); handleCancel(); }}
                                className="px-4 sm:px-6 py-3 sm:py-4 bg-white/10 active:bg-white/30 text-white rounded-xl font-medium transition text-xs sm:text-sm touch-manipulation min-h-[44px] flex items-center justify-center"
                                style={{ WebkitTapHighlightColor: 'transparent' }}>
                                Cancel
                            </button>
                            <button type="button" onClick={handleCaptureFromCamera}
                                onTouchEnd={(e) => { if (cameraReady) { e.preventDefault(); handleCaptureFromCamera(); } }}
                                disabled={!cameraReady}
                                className="flex-1 px-4 sm:px-6 py-3 sm:py-4 bg-brand-500 active:bg-brand-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg touch-manipulation min-h-[44px]"
                                style={{ WebkitTapHighlightColor: 'transparent' }}>
                                <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="text-xs sm:text-sm">Capture</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Mode */}
            {mode === 'preview' && preview && (
                <div className="flex-1 flex flex-col bg-slate-950">
                    <div className="flex-1 relative flex items-center justify-center p-4">
                        <img src={preview} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg" />
                    </div>
                    <div className="p-3 sm:p-4 pb-safe bg-slate-900/95 backdrop-blur-sm border-t border-white/5" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
                        <div className="flex gap-2 sm:gap-3 max-w-md mx-auto">
                            <button onClick={handleRetake}
 className="flex-1 px-4 sm:px-6 py-3 sm:py-4 bg-white/10 active:bg-white/20 text-white rounded-xl font-medium transition touch-manipulation min-h-[44px] flex items-center justify-center text-xs sm:text-sm"
 style={{ WebkitTapHighlightColor: 'transparent' }}>
                                Retake
                            </button>
                            <button onClick={handleConfirm}
 className="flex-1 px-4 sm:px-6 py-3 sm:py-4 bg-brand-500 active:bg-brand-600 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-lg touch-manipulation min-h-[44px]"
 style={{ WebkitTapHighlightColor: 'transparent' }}>
                                <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="text-xs sm:text-sm">Use This</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
