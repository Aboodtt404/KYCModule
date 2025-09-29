"use client";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, X } from "lucide-react";
export function CameraCapture({ onCapture, onCancel, isOpen }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [error, setError] = useState(null);
    const startCamera = async () => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "user",
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                },
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        }
        catch (err) {
            console.error("Camera error:", err);
            setError("Unable to access camera. Please check permissions.");
            setIsCapturing(false);
        }
    };
    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    };
    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current)
            return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context)
            return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
                onCapture(file);
                stopCamera();
                setIsCapturing(false);
            }
        }, "image/jpeg", 0.8);
    };
    const handleStartCapture = () => {
        setIsCapturing(true);
        startCamera();
    };
    const handleStopCapture = () => {
        setIsCapturing(false);
        stopCamera();
    };
    // 🔑 Always clean up when unmounting
    useEffect(() => {
        return () => stopCamera();
    }, []);
    if (!isOpen)
        return null;
    return (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Take a Selfie</h3>
          <Button variant="ghost" size="sm" onClick={() => {
            handleStopCapture();
            onCancel();
        }}>
            <X className="w-4 h-4"/>
          </Button>
        </div>

        {error && (<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>)}

        {!isCapturing ? (<div className="text-center">
            <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <Camera className="w-16 h-16 text-gray-400"/>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Click to start camera and take a selfie
            </p>
            <Button onClick={handleStartCapture} className="w-full">
              <Camera className="w-4 h-4 mr-2"/>
              Start Camera
            </Button>
          </div>) : (<div className="space-y-4">
            <div className="relative">
              <video ref={videoRef} autoPlay playsInline className="w-full h-64 bg-gray-900 rounded-lg object-cover"/>
              <div className="absolute inset-0 border-4 border-white rounded-lg pointer-events-none">
                {/* Overlay corners */}
                <div className="absolute top-2 left-2 w-8 h-8 border-2 border-white rounded-full"></div>
                <div className="absolute top-2 right-2 w-8 h-8 border-2 border-white rounded-full"></div>
                <div className="absolute bottom-2 left-2 w-8 h-8 border-2 border-white rounded-full"></div>
                <div className="absolute bottom-2 right-2 w-8 h-8 border-2 border-white rounded-full"></div>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button onClick={capturePhoto} className="flex-1">
                <Camera className="w-4 h-4 mr-2"/>
                Capture Photo
              </Button>
              <Button variant="outline" onClick={handleStopCapture}>
                <RotateCcw className="w-4 h-4"/>
              </Button>
            </div>
          </div>)}

        <canvas ref={canvasRef} className="hidden"/>
      </div>
    </div>);
}
