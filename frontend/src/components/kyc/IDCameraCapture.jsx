import React, { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "../ui/button";
import { Camera, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

const OCR_SERVER_URL = "http://194.31.150.154:5000";

export function IDCameraCapture({ onCapture, onCancel, isOpen }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const detectionIntervalRef = useRef(null);
    const abortControllersRef = useRef([]);  // Track ALL active abort controllers
    const isCapturingRef = useRef(false);  // Use ref for immediate updates
    const activeRequestsRef = useRef(0);  // Track number of active requests

    const [isCapturing, setIsCapturing] = useState(false);
    const [error, setError] = useState(null);
    const [detection, setDetection] = useState(null);
    const [isDetecting, setIsDetecting] = useState(false);
    const [autoCapturing, setAutoCapturing] = useState(false);
    const [showingFields, setShowingFields] = useState(false);

    // Start camera
    const startCamera = async () => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment", // Use back camera for ID cards
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Camera error:", err);
            setError("Unable to access camera. Please check permissions.");
            setIsCapturing(false);
        }
    };

    // Stop camera
    const stopCamera = () => {
        console.log('🛑 ============ STOP CAMERA CALLED ============');
        console.log('🛑 Active requests before stop:', activeRequestsRef.current);

        // Set this FIRST so in-flight requests see it immediately
        isCapturingRef.current = false;
        console.log('🛑 Set isCapturingRef.current = FALSE');

        if (streamRef.current) {
            console.log('🛑 Stopping camera stream...');
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (detectionIntervalRef.current) {
            console.log('🛑 Clearing detection interval...');
            clearInterval(detectionIntervalRef.current);
            detectionIntervalRef.current = null;
            console.log('🛑 Interval cleared ✓');
        }

        // Abort ALL in-flight requests immediately
        if (abortControllersRef.current.length > 0) {
            console.log(`🛑 Aborting ${abortControllersRef.current.length} in-flight requests...`);
            abortControllersRef.current.forEach((controller, index) => {
                try {
                    controller.abort();
                    console.log(`   ✓ Aborted request ${index + 1}`);
                } catch (err) {
                    console.log(`   ⚠️ Abort error for request ${index + 1}:`, err.message);
                }
            });
            abortControllersRef.current = [];  // Clear the array
            console.log('🛑 All requests aborted ✓');
        }

        console.log('🛑 ============ STOP COMPLETE ============');
    };

    // Send frame to backend for detection
    const detectIDCard = async () => {
        // CRITICAL: Check if camera is still active (use ref for immediate value)
        if (!isCapturingRef.current) {
            console.log('🚫 SKIPPED: isCapturingRef.current is FALSE - camera stopped');
            return;
        }

        if (!videoRef.current || autoCapturing) {
            return; // Silent skip for these conditions
        }

        // CRITICAL: Don't send new requests if one is already in progress
        if (activeRequestsRef.current > 0) {
            console.log('⏳ Waiting for previous request to complete... (Active: ' + activeRequestsRef.current + ')');
            return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video.readyState !== video.HAVE_ENOUGH_DATA) {
            console.log('⏳ Video not ready yet');
            return;
        }

        console.log('🎥 Starting detection request...');
        activeRequestsRef.current += 1;
        console.log('📊 Active requests:', activeRequestsRef.current);
        setIsDetecting(true);

        // Create new AbortController for this request and add to array
        let abortController = new AbortController();
        abortControllersRef.current.push(abortController);

        try {

            // Draw video frame to canvas
            const context = canvas.getContext("2d");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Convert canvas to blob (JPEG)
            const blob = await new Promise((resolve) => {
                canvas.toBlob(resolve, "image/jpeg", 0.8);
            });

            if (!blob || !isCapturingRef.current) {
                // Don't return early - let finally block handle cleanup
                console.log('⚠️ Blob creation failed or camera stopped');
            } else {
                // Send to backend for detection
                const arrayBuffer = await blob.arrayBuffer();
                const response = await fetch(`${OCR_SERVER_URL}/detect-id-card`, {
                    method: "POST",
                    headers: { "Content-Type": "image/jpeg" },
                    body: arrayBuffer,
                    signal: abortController.signal,
                });

                // Check if still capturing before processing response
                if (!isCapturingRef.current) {
                    console.log('❌ Camera stopped, ignoring detection result');
                } else if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Detection result:', {
                        detected: result.detected,
                        fields: result.field_count,
                        ready: result.ready_for_capture,
                        message: result.message
                    });
                    setDetection(result);

                    // Auto-capture INSTANTLY when all 5 fields detected
                    if (result.ready_for_capture && !autoCapturing && !showingFields) {
                        console.log('🎯 ALL REQUIREMENTS MET! Capturing instantly:', {
                            fields: result.field_count,
                            digits: result.id_digits.length,
                            photo: result.photo?.detected,
                            fieldSummary: result.field_summary
                        });
                        setShowingFields(true);
                        setAutoCapturing(true);

                        // Stop detection loop immediately
                        if (detectionIntervalRef.current) {
                            clearInterval(detectionIntervalRef.current);
                            detectionIntervalRef.current = null;
                        }

                        // Capture immediately - pass detection result directly (state update is async!)
                        setTimeout(() => {
                            capturePhoto(result);  // Pass result directly instead of relying on state
                        }, 100);
                    }
                }
            }
        } catch (err) {
            // Ignore abort errors (expected when canceling)
            if (err.name === 'AbortError') {
                console.log('🚫 Detection request aborted');
            } else {
                console.error("❌ Detection error:", err);
                if (isCapturingRef.current) {
                    setDetection({
                        detected: false,
                        message: "Detection failed. Check connection.",
                    });
                }
            }
        } finally {
            // Remove this controller from the array
            const index = abortControllersRef.current.indexOf(abortController);
            if (index > -1) {
                abortControllersRef.current.splice(index, 1);
            }

            activeRequestsRef.current -= 1;
            console.log('📊 Active requests (after):', activeRequestsRef.current);
            setIsDetecting(false);
        }
    };

    // Capture final photo
    const capturePhoto = (detectionData = null) => {
        // Use passed detection data or fall back to state (for manual captures)
        const currentDetection = detectionData || detection;

        // Safety check: Only capture if ready_for_capture is true
        // (Backend validates: 4 required fields + 14 digits + photo, firstName optional)
        if (!currentDetection || !currentDetection.detected || !currentDetection.ready_for_capture ||
            !currentDetection.id_digits || currentDetection.id_digits.length !== 14) {
            console.warn('Capture aborted - missing requirements:', {
                detected: currentDetection?.detected,
                readyForCapture: currentDetection?.ready_for_capture,
                fieldCount: currentDetection?.field_count,
                digitCount: currentDetection?.id_digits?.length,
                photoDetected: currentDetection?.photo?.detected
            });
            setAutoCapturing(false);
            setShowingFields(false);
            return;
        }

        console.log('📸 Capturing photo - all requirements met!', {
            fields: currentDetection.field_count,
            digits: currentDetection.id_digits.length,
            photo: currentDetection.photo?.detected
        });

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
            (blob) => {
                if (blob) {
                    const file = new File([blob], "id-card.jpg", { type: "image/jpeg" });
                    console.log('✅ Photo captured successfully, closing camera');

                    // Clean up states before closing
                    setAutoCapturing(false);
                    setShowingFields(false);
                    setDetection(null);

                    onCapture(file);
                    stopCamera();
                    setIsCapturing(false);
                }
            },
            "image/jpeg",
            0.95
        );
    };

    // Handle start capture
    const handleStartCapture = async () => {
        console.log('🎬 Starting fresh camera session');

        // Reset all states first to ensure clean start
        setDetection(null);
        setAutoCapturing(false);
        setShowingFields(false);
        setIsDetecting(false);
        setError(null);

        // Set BOTH state and ref immediately
        setIsCapturing(true);
        isCapturingRef.current = true;
        console.log('✅ Set isCapturing to true (state + ref)');

        await startCamera();
        console.log('✅ Camera started');

        // Small delay before starting detection to ensure camera is ready
        setTimeout(() => {
            console.log('🔄 Starting detection interval...');
            console.log('🔍 isCapturingRef.current =', isCapturingRef.current);
            // Start detection loop (every 500ms)
            detectionIntervalRef.current = setInterval(() => {
                console.log('⏰ Detection interval tick');
                detectIDCard();
            }, 500);
        }, 500);
    };

    // Handle stop capture
    const handleStopCapture = () => {
        console.log('🛑 Stopping camera and resetting all states');

        // Stop camera and clear interval (this sets isCapturingRef.current = false)
        stopCamera();

        // Reset ALL states completely  
        setIsCapturing(false);
        // Note: isCapturingRef.current already set to false in stopCamera()
        setDetection(null);
        setAutoCapturing(false);
        setShowingFields(false);
        setIsDetecting(false);
        setError(null);
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => stopCamera();
    }, []);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Scan Your ID Card
                    </h3>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            console.log('❌ User clicked X - canceling');
                            handleStopCapture();
                            onCancel();
                        }}
                        disabled={autoCapturing}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                    </div>
                )}

                {!isCapturing ? (
                    /* Pre-capture state */
                    <div className="text-center py-8">
                        <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <Camera className="w-16 h-16 text-white" />
                        </div>
                        <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                            Ready to Scan
                        </h4>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            Show your ID card to the camera.
                            <br />
                            We'll detect it and capture automatically when clear.
                        </p>
                        <Button onClick={handleStartCapture} className="w-full" size="lg">
                            <Camera className="w-5 h-5 mr-2" />
                            Start Camera
                        </Button>
                    </div>
                ) : (
                    /* Camera active */
                    <div className="space-y-4">
                        {/* Video Preview with Overlay */}
                        <div className="relative bg-black rounded-lg overflow-hidden">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-96 object-cover"
                            />

                            {/* Capturing Flash Overlay */}
                            {autoCapturing && (
                                <div className="absolute inset-0 bg-white animate-pulse"></div>
                            )}

                            {/* Scanning Indicator - Only show when no ID detected */}
                            {!detection?.detected && !autoCapturing && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="bg-black/70 backdrop-blur-sm px-6 py-4 rounded-2xl">
                                        <div className="flex items-center gap-3">
                                            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                                            <p className="text-white text-lg font-medium">
                                                Scanning for ID card...
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Status Bar - User Friendly */}
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 rounded-lg p-4 border border-blue-100 dark:border-gray-700">
                            <div className="space-y-3">
                                {/* Main Status */}
                                <div className="flex items-center gap-3">
                                    {autoCapturing ? (
                                        <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 animate-pulse" />
                                    ) : isDetecting ? (
                                        <Loader2 className="w-6 h-6 text-blue-500 animate-spin flex-shrink-0" />
                                    ) : detection?.ready_for_capture ? (
                                        <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                                    ) : detection?.detected ? (
                                        <AlertCircle className="w-6 h-6 text-yellow-500 flex-shrink-0" />
                                    ) : (
                                        <Camera className="w-6 h-6 text-gray-400 flex-shrink-0" />
                                    )}

                                    <div className="flex-1">
                                        <p className="text-base font-semibold text-gray-900 dark:text-white">
                                            {autoCapturing
                                                ? "Capturing perfect shot..."
                                                : detection?.message || "Initializing camera..."}
                                        </p>
                                    </div>
                                </div>

                                {/* Detection Details */}
                                {detection?.detected && !autoCapturing && (
                                    <div className="space-y-2">
                                        {/* Fields Detected */}
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600 dark:text-gray-400">Fields Detected:</span>
                                            <span className={`font-bold ${detection.field_count === 5 ? 'text-green-600' : 'text-yellow-600'}`}>
                                                {detection.field_count}/5
                                            </span>
                                        </div>

                                        {/* Field List */}
                                        {detection?.field_summary && (
                                            <div className="flex flex-wrap gap-2">
                                                {Object.entries(detection.field_summary).map(([field, count]) => {
                                                    const fieldLabels = {
                                                        firstName: "First Name",
                                                        lastName: "Last Name",
                                                        nid: "National ID",
                                                        address: "Address",
                                                        serial: "Serial"
                                                    };
                                                    return count > 0 && (
                                                        <div
                                                            key={field}
                                                            className="flex items-center gap-1 px-3 py-1 bg-white dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-600"
                                                        >
                                                            <CheckCircle className="w-3 h-3 text-green-500" />
                                                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                                                {fieldLabels[field] || field}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* ID Digits - Highlighted with count */}
                                        {detection.id_digits && detection.id_digits.length > 0 && (
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-gray-600 dark:text-gray-400">National ID:</span>
                                                    <span className={`font-bold ${detection.id_digits.length === 14 ? 'text-green-600' : 'text-orange-600'}`}>
                                                        {detection.id_digits.length}/14 digits
                                                    </span>
                                                </div>
                                                <div className="text-center">
                                                    <span className="font-mono font-bold text-lg text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded">
                                                        {detection.id_digits.map(d => d.digit).join('')}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Image Quality */}
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600 dark:text-gray-400">Image Quality:</span>
                                            <span className={`font-bold ${detection.quality.quality_score >= 70 ? 'text-green-600' :
                                                detection.quality.quality_score >= 50 ? 'text-yellow-600' :
                                                    'text-red-600'
                                                }`}>
                                                {detection.quality.quality_score}%
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Cancel Button */}
                        <div className="flex justify-center">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    console.log('🚫 User clicked Cancel button');
                                    handleStopCapture();
                                    onCancel();
                                }}
                                disabled={autoCapturing}
                                className="w-full"
                            >
                                {autoCapturing ? "Capturing..." : "Cancel"}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Hidden canvas for frame capture */}
                <canvas ref={canvasRef} className="hidden" />
            </div>
        </div>
    );
}
