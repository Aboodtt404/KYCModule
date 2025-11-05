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
    const hasStartedCamera = useRef(false); // Simplified single guard

    // Start camera - ONLY CALLED ONCE
    const startCamera = async () => {
        if (hasStartedCamera.current || streamRef.current) {
            console.log('❌ BLOCKED: Camera start rejected. hasStartedCamera:', hasStartedCamera.current, 'streamRef:', !!streamRef.current);
            return;
        }
        console.log('🎥 [ID] Starting camera - FIRST AND ONLY TIME');
        hasStartedCamera.current = true;
        setError(null);
        setCameraReady(false);

        try {
            // iOS-friendly constraints - simplified for better compatibility
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment", // Simplified for iOS
                    width: { ideal: 1920, max: 4096 },
                    height: { ideal: 1080, max: 4096 },
                },
                audio: false,
            });
            
            streamRef.current = stream;
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                
                // iOS Safari needs both loadedmetadata and canplay events
                const handleVideoReady = async () => {
                    try {
                        // Small delay helps iOS Safari initialize properly
                        await new Promise(resolve => setTimeout(resolve, 150));
                        await videoRef.current.play();
                        setCameraReady(true);
                        console.log('✅ [ID] Camera ready and playing');
                    } catch (err) {
                        console.error('[ID] Error playing video:', err);
                        setCameraReady(true); // Still set ready to allow capture attempt
                    }
                };
                
                videoRef.current.onloadedmetadata = handleVideoReady;
                // Fallback for iOS which sometimes only fires canplay
                videoRef.current.oncanplay = () => {
                    if (!cameraReady) {
                        console.log('📱 iOS fallback: canplay event fired');
                        setCameraReady(true);
                    }
                };
            }
        } catch (err) {
            console.error("❌ [ID] Camera error:", err);
            hasStartedCamera.current = false; // Allow retry on error
            setError(err.message || "Camera access denied");
            setTimeout(() => { onCancel(); }, 2000);
        }
    };

    // Stop camera
    const stopCamera = () => {
        if (streamRef.current) {
            console.log('🛑 [ID] Stopping camera...');
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraReady(false);
        hasStartedCamera.current = false; // Reset for next time component is used
    };

    // Unified effect to manage camera based on the `isOpen` prop
    useEffect(() => {
        if (isOpen) {
            startCamera();
        }

        // The cleanup function will be called when the component unmounts OR when `isOpen` becomes false.
        // This ensures the camera is always stopped when the component is hidden or closed.
        return () => {
            if (streamRef.current) {
                stopCamera();
            }
        };
    }, [isOpen]);

    if (!isOpen) return null;

    // Capture photo from video
    const handleCaptureFromCamera = () => {
        if (!videoRef.current || !canvasRef.current || !cameraReady) {
            console.log('Camera not ready');
            return;
        }

        console.log('Capturing photo...');
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            if (blob) {
                console.log('Photo captured, blob size:', blob.size);
                setCapturedBlob(blob);
                const previewUrl = URL.createObjectURL(blob);
                setPreview(previewUrl);
                // DON'T stop camera here - keep it running
                setMode('preview');
            }
        }, "image/jpeg", 0.95);
    };

    // Confirm and return captured image
    const handleConfirm = () => {
        if (capturedBlob) {
            console.log('Confirming capture...');
            const file = new File([capturedBlob], `id-card-${Date.now()}.jpg`, { 
                type: "image/jpeg" 
            });
            stopCamera(); // Stop camera before closing
            onCapture(file);
        }
    };

    const handleRetake = () => {
        console.log('Retaking photo...');
        if (preview) {
            URL.revokeObjectURL(preview);
        }
        setPreview(null);
        setCapturedBlob(null);
        setMode('camera');
        // Camera is still running, just switch back to camera view
    };

    const handleCancel = () => {
        console.log('Cancelling...');
        if (preview) {
            URL.revokeObjectURL(preview);
        }
        stopCamera();
        setPreview(null);
        setCapturedBlob(null);
        onCancel();
    };

    return (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-3 bg-black/50 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    {mode === 'camera' && (
                        <>
                            <Camera className="w-4 h-4" />
                            <span>Capture ID Card</span>
                        </>
                    )}
                    {mode === 'preview' && (
                        <>
                            <Check className="w-4 h-4" />
                            <span>Review Image</span>
                        </>
                    )}
                </h3>
                <button 
                    onClick={handleCancel} 
                    className="p-2 text-white hover:bg-white/10 rounded-full transition"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Camera Mode - Fullscreen */}
            {mode === 'camera' && (
                <div className="flex-1 relative flex flex-col">
                    <div className="flex-1 relative bg-black">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            webkit-playsinline="true"
                            x-webkit-airplay="allow"
                            className="w-full h-full object-cover"
                            style={{ WebkitTransform: 'translateZ(0)' }}
                        />
                        <canvas ref={canvasRef} className="hidden" />
                        
                        {/* ID Card Frame Overlay */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
                            {/* Semi-transparent overlay outside the frame */}
                            <div className="absolute inset-0 bg-black/40"></div>
                            
                            {/* ID Card Frame - Credit card aspect ratio */}
                            <div className="relative w-full max-w-md aspect-[85.6/53.98] z-10">
                                {/* Frame border */}
                                <div className="absolute inset-0 border-3 border-white rounded-2xl shadow-lg"></div>
                                
                                {/* Corner markers */}
                                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl"></div>
                                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-2xl"></div>
                                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-2xl"></div>
                                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl"></div>
                                
                                {/* Instruction text */}
                                <div className="absolute -bottom-16 left-0 right-0 text-center">
                                    <p className="text-white font-semibold text-sm mb-1">
                                        Position ID Card in Frame
                                    </p>
                                    <p className="text-white/80 text-xs">
                                        Ensure good lighting • Keep card flat
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

                        {/* Capture Button - Bottom Fixed with iOS-safe area */}
                        <div className="p-4 pb-safe bg-black/50 backdrop-blur-sm" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                            <div className="flex gap-3 max-w-md mx-auto">
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    onTouchEnd={(e) => { e.preventDefault(); handleCancel(); }}
                                    className="px-6 py-3 bg-white/10 active:bg-white/30 text-white rounded-full font-medium transition text-sm touch-manipulation"
                                    style={{ WebkitTapHighlightColor: 'transparent' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCaptureFromCamera}
                                    onTouchEnd={(e) => {
                                        if (cameraReady) {
                                            e.preventDefault();
                                            handleCaptureFromCamera();
                                        }
                                    }}
                                    disabled={!cameraReady}
                                    className="flex-1 px-6 py-4 bg-emerald-500 active:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-full font-bold transition flex items-center justify-center gap-2 shadow-lg touch-manipulation"
                                    style={{ WebkitTapHighlightColor: 'transparent' }}
                                >
                                    <Camera className="w-5 h-5" />
                                    Capture
                                </button>
                            </div>
                        </div>
                </div>
            )}

            {/* Preview Mode - Fullscreen */}
            {mode === 'preview' && preview && (
                <div className="flex-1 flex flex-col bg-black">
                    <div className="flex-1 relative flex items-center justify-center p-4">
                        <img
                            src={preview}
                            alt="Preview"
                            className="max-w-full max-h-full object-contain rounded-lg"
                        />
                    </div>

                    {/* Action Buttons - Bottom Fixed */}
                    <div className="p-4 bg-black/50 backdrop-blur-sm">
                        <div className="flex gap-3 max-w-md mx-auto">
                            <button
                                onClick={handleRetake}
                                className="flex-1 px-6 py-4 bg-white/10 hover:bg-white/20 text-white rounded-full font-medium transition"
                            >
                                Retake
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="flex-1 px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full font-bold transition flex items-center justify-center gap-2 shadow-lg"
                            >
                                <Check className="w-5 h-5" />
                                Use This
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
