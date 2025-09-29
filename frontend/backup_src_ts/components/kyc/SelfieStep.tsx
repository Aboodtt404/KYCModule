"use client";
import React, { useEffect, useRef, useState } from "react";
import GlassCard from "./GlassCard";
import { Button } from "@/components/ui/button";

export default function SelfieStep({
  onNext,
  onCapture,
}: {
  onNext: () => void;
  onCapture?: (blob: Blob) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);

  useEffect(() => {
    async function start() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 } },
          audio: false,
        });
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (e) {
        console.error("camera error", e);
      }
    }
    start();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function capture() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.9);
    setCaptured(data);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture?.(blob);
      },
      "image/jpeg",
      0.9
    );
  }

  return (
    <GlassCard className="flex flex-col gap-4 items-center">
      <div className="relative w-full h-64 bg-black/30 rounded-lg overflow-hidden">
        {!captured ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <img src={captured} className="w-full h-full object-cover" />
        )}

        {/* simple wireframe overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-36 h-44 border-2 border-dashed border-white/30 rounded-lg" />
        </div>
      </div>

      {!captured ? (
        <Button onClick={capture} className="w-full">
          Capture Selfie
        </Button>
      ) : (
        <div className="w-full flex gap-2">
          <Button
            onClick={() => {
              setCaptured(null);
            }}
            className="w-1/2"
          >
            Retake
          </Button>
          <Button
            onClick={() => {
              onNext();
            }}
            className="w-1/2"
          >
            Use Photo
          </Button>
        </div>
      )}
    </GlassCard>
  );
}
