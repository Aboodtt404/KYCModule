"use client";
import React, { useState, useEffect, useRef } from "react";
import GlassCard from "./GlassCard";
import ThreeHero from "./ThreeHero";
import { Button } from "@/components/ui/button";
import { Loader2, Camera, Upload, X } from "lucide-react";
import { IDCameraCapture } from "./IDCameraCapture";
import { useCheckDuplicateId } from "../../hooks/useQueries";
import { isDemoMode } from "@/demo/demoMode";
import { DEMO_OCR_RESULT, generateDemoFaceImage } from "@/demo/demoData";

// OCR processing stages shown to the user
const OCR_STAGES = [
  { id: 'quality',   label: 'Checking image quality…',    pct: 10 },
  { id: 'uploading', label: 'Sending to OCR server…',     pct: 30 },
  { id: 'analyzing', label: 'Analysing document…',        pct: 60 },
  { id: 'extracting',label: 'Extracting fields…',         pct: 85 },
  { id: 'verifying', label: 'Checking for duplicates…',   pct: 95 },
];

export default function DocumentStep({ submissionId, onNext, onUploaded, onReset }) {
  const [type, setType] = useState("id");
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [captureMode, setCaptureMode] = useState(null); // 'camera' or 'upload'
  const [validationError, setValidationError] = useState(null);
  const [ocrStage, setOcrStage] = useState(null);     // current stage object
  const [elapsed, setElapsed] = useState(0);           // seconds since OCR started
  // National-ID flow is two-sided: capture front, then the mandatory back.
  const [side, setSide] = useState("front");           // 'front' | 'back'
  const [frontResult, setFrontResult] = useState(null);// {ocrData, file, faceImage} from the front pass
  const abortRef = useRef(null);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);
  const checkDuplicateId = useCheckDuplicateId();

  // Cleanup timer on unmount
  useEffect(() => () => { clearInterval(timerRef.current); }, []);

  function startTimer() {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
  }
  function stopTimer() { clearInterval(timerRef.current); }

  function cancelOcr() {
    abortRef.current?.abort();
    stopTimer();
    setIsProcessing(false);
    setOcrStage(null);
    setElapsed(0);
  }

  // Cleanup effect to ensure camera is off when component unmounts
  useEffect(() => {
    return () => {
      if (showCamera) {
        setShowCamera(false);
      }
    };
  }, [showCamera]);

  function handleFile(f) {
    setFile(f);
    setCaptureMode('upload');
    setValidationError(null); // Clear error on new file
    if (onUploaded) onUploaded(f); // ✅ now always safe
  }

  function handleCameraCapture(capturedFile) {
    setFile(capturedFile);
    setCaptureMode('camera');
    setShowCamera(false);
    setValidationError(null); // Clear error on new capture
    if (onUploaded) onUploaded(capturedFile);
  }

  // Validate extracted data for Unknown fields
  function validateOCRData(ocrData, docType) {
    const criticalFields = docType === "id" 
      ? ["full_name", "national_id", "birth_date"]
      : ["full_name", "birth_date"];
    
    const unknownFields = criticalFields.filter(
      field => !ocrData[field] || ocrData[field] === "Unknown" || ocrData[field].trim() === ""
    );

    return {
      isValid: unknownFields.length === 0,
      unknownFields
    };
  }

  // ── Image quality gate ──────────────────────────────────────────────────────
  async function checkImageQuality(imgFile) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(imgFile);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const { naturalWidth: w, naturalHeight: h } = img;

        // Minimum resolution: 400 × 300 px
        if (w < 400 || h < 300) {
          return resolve({ ok: false, reason: `Image too small (${w}×${h}px). Minimum is 400×300 px. Please retake a clearer photo.` });
        }

        // Blur detection via Laplacian variance on a canvas sample
        const canvas = document.createElement('canvas');
        const scale  = Math.min(1, 320 / w);
        canvas.width  = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Grayscale → Laplacian kernel → variance
        const grey = [];
        for (let i = 0; i < data.length; i += 4) {
          grey.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        }
        const cw = canvas.width;
        let sum = 0, sumSq = 0, count = 0;
        for (let y = 1; y < canvas.height - 1; y++) {
          for (let x = 1; x < cw - 1; x++) {
            const lap =
              -grey[(y-1)*cw+(x-1)] - grey[(y-1)*cw+x] - grey[(y-1)*cw+(x+1)]
              - grey[y*cw+(x-1)]   + 8*grey[y*cw+x]   - grey[y*cw+(x+1)]
              - grey[(y+1)*cw+(x-1)] - grey[(y+1)*cw+x] - grey[(y+1)*cw+(x+1)];
            sum   += lap;
            sumSq += lap * lap;
            count++;
          }
        }
        const variance = (sumSq - (sum * sum) / count) / count;

        // Threshold: variance < 80 indicates significant blur
        if (variance < 80) {
          return resolve({ ok: false, reason: `Image appears blurry (score: ${variance.toFixed(0)}). Please retake the photo with better lighting and hold the camera steady.` });
        }

        resolve({ ok: true });
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve({ ok: true }); }; // skip on error
      img.src = url;
    });
  }

  async function handleProcessDocument() {
    if (!file) return;

    // Client-side guards — catch obvious bad input before hitting the server
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith("image/")) {
      setValidationError("Please upload an image file (JPEG, PNG, or WebP).");
      return;
    }
    const MAX_SIZE_MB = 10;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setValidationError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is ${MAX_SIZE_MB} MB.`);
      return;
    }

    setIsProcessing(true);
    setValidationError(null);
    setOcrStage(OCR_STAGES[0]);
    startTimer();

    // Demo mode: simulate the OCR pipeline with canned data — no server needed
    if (isDemoMode()) {
      for (const stage of OCR_STAGES) {
        setOcrStage(stage);
        await new Promise(r => setTimeout(r, 300));
      }
      stopTimer(); setIsProcessing(false); setOcrStage(null);
      if (type === "id" && side === "back") {
        onNext(
          { ...frontResult.ocrData, serial_number: frontResult.ocrData.serial || "", ...DEMO_OCR_RESULT.back },
          frontResult.file, frontResult.faceImage,
        );
        return;
      }
      const demoOcr = { ...DEMO_OCR_RESULT, face_image: generateDemoFaceImage() };
      if (type === "id") {
        setFrontResult({ ocrData: demoOcr, file, faceImage: demoOcr.face_image });
        setSide("back"); setFile(null); setCaptureMode(null); setValidationError(null);
        return;
      }
      onNext(demoOcr, file, demoOcr.face_image);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const autoAbortTimer = setTimeout(() => controller.abort(), 90_000);

    try {
      // Stage 0 — Quick OCR server health check (3s timeout)
      // Catches the case where the server is down before wasting the user's time
      // Explicit env override (production) — otherwise same-origin: the dev server
      // proxies the OCR routes, so this works from localhost, tunnels, and phones.
      const OCR_BASE = import.meta.env.VITE_OCR_SERVER_URL || process.env.VITE_OCR_SERVER_URL || window.location.origin;
      if (!OCR_BASE) {
        stopTimer(); setOcrStage(null); setIsProcessing(false);
        setValidationError('OCR server URL is not configured. Please contact support@mercaturaforum.com.');
        return;
      }
      try {
        const hc = await fetch(`${OCR_BASE}/health`, { signal: AbortSignal.timeout(3000) });
        if (!hc.ok) throw new Error('unhealthy');
      } catch {
        stopTimer(); setOcrStage(null); setIsProcessing(false);
        setValidationError(
          'The identity verification service is temporarily unavailable. Please try again in a few minutes or contact support@mercaturaforum.com.'
        );
        return;
      }

      // Stage 1 — Quality gate (local, instant)
      setOcrStage(OCR_STAGES[0]);
      const quality = await checkImageQuality(file);
      if (!quality.ok) {
        setValidationError(quality.reason);
        stopTimer(); setIsProcessing(false); setOcrStage(null);
        return;
      }

      // Stage 2 — Prepare payload
      setOcrStage(OCR_STAGES[1]);
      const arrayBuffer = await file.arrayBuffer();
      const isBack = type === "id" && side === "back";
      const ocrEndpoint = isBack
        ? `${OCR_BASE}/egyptian-id-back`
        : type === "id"
          ? `${OCR_BASE}/egyptian-id`
          : `${OCR_BASE}/passport`;

      // Stage 3 — Send to OCR server
      setOcrStage(OCR_STAGES[2]);
      const response = await fetch(ocrEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "image/jpeg",
          "X-Submission-ID": submissionId,
        },
        body: arrayBuffer,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OCR server error ${response.status}: ${errorText || 'Server returned an error'}`);
      }
      
      // Stage 4 — Parse results
      setOcrStage(OCR_STAGES[3]);
      const result = await response.json();

      // ── Back-of-card pass: merge back fields into the front result, then advance
      if (isBack) {
        if (!result.success) throw new Error(result.error || "Could not read the back of the card");
        const back = result.extracted_data || {};
        const merged = {
          ...frontResult.ocrData,
          // Factory/serial number comes from the FRONT (رقم المصنع); the back's
          // big number is the NID, kept as a cross-check.
          serial_number:  frontResult.ocrData.serial || "",
          national_id_back: back.national_id || "",
          marital_status: back.marital_status || "",
          occupation:     back.occupation     || "",
          issue_date:     back.issue_date     || "",
          expiry_date:    back.expiry_date    || "",
        };
        stopTimer(); setOcrStage(null); setIsProcessing(false);
        onNext(merged, frontResult.file, frontResult.faceImage);
        return;
      }

      if (result.success && result.extracted_data) {
        const extractedData = result.extracted_data;
        // Use empty string instead of "Unknown" so ReviewStep shows editable blank inputs
        const ocrData = {
          full_name:   extractedData.full_name   || "",
          national_id: extractedData.national_id || "",
          birth_date:  extractedData.birth_date  || "",
          address:     extractedData.address     || "",
          governorate: extractedData.governorate || "",
          gender:      extractedData.gender      || "",
          serial:      extractedData.serial      || "",
          first_name:  extractedData.first_name  || "",
          second_name: extractedData.second_name || "",
          face_image:  (extractedData.face_image?.length > 1000) ? extractedData.face_image : null,
        };

        // Soft warning: tell the user which fields OCR missed so they can correct
        // them in ReviewStep — don't hard-block, OCR is best-effort
        const validation = validateOCRData(ocrData, type);
        if (!validation.isValid) {
          const fieldNames = validation.unknownFields
            .map(f => f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
            .join(', ');
          setValidationError(
            `⚠️ Could not auto-read: ${fieldNames}. You can fill these in manually on the next screen.`
          );
          // Still proceed — don't return early
        }

        // Hard-block only for confirmed duplicate ID
        // Stage 5 — Duplicate check
        setOcrStage(OCR_STAGES[4]);
        if (ocrData.national_id) {
          const isDuplicate = await checkDuplicateId.mutateAsync(ocrData.national_id);
          if (isDuplicate) {
            setValidationError(
              "This National ID has already been submitted. Please wait for verification."
            );
            setTimeout(() => { onReset(); }, 3000);
            setIsProcessing(false);
            return;
          }
        }

        stopTimer(); setOcrStage(null); setIsProcessing(false);

        if (type === "id") {
          // Front captured — now require the mandatory back of the card.
          setFrontResult({ ocrData, file, faceImage: extractedData.face_image });
          setSide("back");
          setFile(null);
          setCaptureMode(null);
          setValidationError(null);
        } else {
          // Passport is single-sided.
          onNext(ocrData, file, extractedData.face_image);
        }
      } else {
        throw new Error(result.error || "OCR failed");
      }
    } catch (error) {
      // Provide specific error messages based on error type
      let errorMessage = `Failed to process ${type === "id" ? "ID" : "passport"}. `;
      
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        errorMessage += "Request timed out. The server may be slow or unresponsive. Please try again.";
      } else if (error.message?.includes('Failed to fetch')) {
        // Check if it's a certificate error
        if (window.location.protocol === 'https:') {
          errorMessage += "SSL Certificate error. Please visit the OCR server URL directly in your browser and accept the security certificate, then try again.";
        } else {
          errorMessage += "Cannot connect to the OCR server. Please check if the server is running and try again.";
        }
      } else if (error.message?.includes('ERR_CONNECTION_RESET') || error.message?.includes('ERR_CONNECTION_REFUSED')) {
        errorMessage += "Cannot connect to the OCR server. Please check if the server is running and try again.";
      } else if (error.message?.includes('network')) {
        errorMessage += "Network error. Please check your internet connection and try again.";
      } else {
        errorMessage += error.message || "Please ensure the image is clear and try again.";
      }
      
      if (error.name !== 'AbortError') setValidationError(errorMessage);
    } finally {
      clearTimeout(autoAbortTimer);
      stopTimer(); setOcrStage(null); setIsProcessing(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Remove ThreeHero on mobile for better space usage */}
      <div className="hidden sm:block">
        <ThreeHero className="h-36 md:h-52" />
      </div>
      <GlassCard className="p-3 sm:p-6">
        {/* Validation Error Display */}
        {validationError && (
          <div className="mb-3 p-2.5 bg-red-500/20 border border-red-500 rounded-lg text-red-200">
            <p className="font-semibold text-xs">⚠️ Validation Failed</p>
            <p className="text-[11px] mt-0.5">{validationError}</p>
          </div>
        )}

        {/* Two-sided ID progress banner (back is mandatory) */}
        {type === "id" && side === "back" && (
          <div className="mb-3 p-3 rounded-xl bg-brand-500/10 border border-brand-400/30 flex items-start gap-2.5">
            <span className="text-brand-300 text-base leading-none mt-0.5">✓</span>
            <div>
              <p className="text-sm font-semibold text-white">Front captured. Now the back of your card.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Flip your National ID over and capture the back — it has the serial number, marital status, and occupation. This step is required.
              </p>
            </div>
          </div>
        )}

        {/* Document Type Selector — hidden once we're on the back step */}
        {side === "front" && (
        <div className="flex gap-2 justify-center">
          {[
            { key: "id", label: "🪪 National ID" },
            { key: "passport", label: "🛂 Passport" },
          ].map((doc) => (
            <button
 key={doc.key}
 className={`flex-1 p-2.5 sm:p-3 rounded-xl transition text-xs sm:text-sm font-medium touch-manipulation min-h-[40px] flex items-center justify-center ${type === doc.key
 ?"bg-brand-600 text-white font-semibold shadow-sm active:bg-brand-700"
 :"bg-white/10 active:bg-white/20 text-white"
 }`}
 onClick={() => setType(doc.key)}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {doc.label}
            </button>
          ))}
        </div>
        )}

        {/* Camera + Upload buttons */}
        {!file && (
          <div className="mt-4 flex gap-2">
            {/* Camera capture */}
            <button
              onClick={() => setShowCamera(true)}
              className="flex-1 py-4 sm:py-5 rounded-xl text-sm font-bold bg-brand-600 hover:bg-brand-500 active:bg-brand-700 shadow-sm transition-colors flex items-center justify-center gap-2 touch-manipulation min-h-[48px] text-white"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Camera className="w-5 h-5 flex-shrink-0" />
              <div className="text-left">
                <div className="text-xs sm:text-sm">Take Photo</div>
                <div className="text-[10px] font-normal text-white/80">Open camera</div>
              </div>
            </button>

            {/* File upload from device */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-4 sm:py-5 rounded-xl text-sm font-bold bg-white/10 border border-white/20 text-white shadow-lg transition-all flex items-center justify-center gap-2 touch-manipulation min-h-[48px] hover:bg-white/20 active:bg-white/25"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Upload className="w-5 h-5 flex-shrink-0" />
              <div className="text-left">
                <div className="text-xs sm:text-sm">Upload File</div>
                <div className="text-[10px] font-normal text-white/80">From device</div>
              </div>
            </button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setFile(f);
                setCaptureMode('upload');
                setValidationError(null);
                if (onUploaded) onUploaded(f);
                // Reset so the same file can be re-selected if needed
                e.target.value = '';
              }}
            />
          </div>
        )}

        {/* File details + process button */}
        {file && (
          <div className="mt-4 space-y-3">
            {/* Preview - Compact */}
            <div className="bg-white/5 rounded-lg p-2.5">
              <img
                src={URL.createObjectURL(file)}
                alt="Preview"
                className="w-full h-36 object-contain rounded-lg mb-2"
              />
              <div className="flex items-center justify-between text-[11px] text-gray-200">
                <span className="truncate max-w-[70%]">{file.name}</span>
                <span className="text-gray-400">
                  {(file.size / 1000).toFixed(1)} KB
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-green-400">
                {captureMode === 'upload'
                  ? <><Upload className="w-3 h-3" /><span>Uploaded from device</span></>
                  : <><Camera className="w-3 h-3" /><span>Captured with camera</span></>
                }
              </div>
            </div>

            {/* OCR progress overlay */}
            {isProcessing && ocrStage && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-white font-medium">
                    <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
                    {ocrStage.label}
                  </div>
                  <span className="text-xs text-gray-400">{elapsed}s</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div
                    className="bg-brand-400 h-1.5 rounded-full transition-all duration-700"
                    style={{ width: `${ocrStage.pct}%` }}
                  />
                </div>
                {elapsed > 20 && (
                  <p className="text-[11px] text-yellow-300">
                    Taking longer than usual — large images may take up to 60 s.
                  </p>
                )}
                <button
                  onClick={cancelOcr}
                  className="w-full text-xs text-gray-400 hover:text-red-400 flex items-center justify-center gap-1 py-1"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            )}

            {/* Actions - Mobile Optimized */}
            <div className="flex gap-2">
              <button
 onClick={handleProcessDocument}
 disabled={isProcessing}
 className="flex-1 py-3 sm:py-4 bg-brand-500 active:bg-brand-600 disabled:bg-gray-600 text-white rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-lg touch-manipulation min-h-[44px]"
 style={{ WebkitTapHighlightColor: 'transparent' }}
 >
                {isProcessing ? (
                  <span className="text-xs opacity-70">Analysing…</span>
                ) : (
                  (type === "id" && side === "back") ? "Process Back of Card" : "Process Document"
                )}
              </button>
              <button
                onClick={() => {
                  if (file) {
                    URL.revokeObjectURL(URL.createObjectURL(file));
                  }
                  setFile(null);
                  setCaptureMode(null);
                  setShowCamera(false);
                }}
                disabled={isProcessing}
                className="px-4 sm:px-5 py-3 sm:py-4 bg-white/10 active:bg-white/20 disabled:bg-gray-600 text-white rounded-xl font-medium text-xs sm:text-sm transition touch-manipulation min-h-[44px] flex items-center justify-center"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                Retake
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Camera Modal - Simplified to rely on isOpen */}
        <IDCameraCapture
          isOpen={showCamera}
          onCapture={handleCameraCapture}
          onCancel={() => setShowCamera(false)}
        />
    </div>
  );
}
