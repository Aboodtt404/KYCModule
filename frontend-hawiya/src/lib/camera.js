// Camera helpers — getUserMedia lifecycle + frame grabs.
// hiRes: request 4K for the ID-side captures — the PDF417 strip on the back is
// ~2px/module at 1080p (undecodable); ideal constraints degrade gracefully on
// phones that can't deliver it.
export async function openCamera(videoEl, facing = 'environment', { hiRes = false } = {}) {
  const dims = hiRes
    ? { width: { ideal: 3840 }, height: { ideal: 2160 } }
    : { width: { ideal: 1920 }, height: { ideal: 1080 } };
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: facing, ...dims },
    audio: false
  });
  videoEl.srcObject = stream;
  await videoEl.play().catch(() => {});
  // Close-up captures (the barcode strip) need the lens actively refocusing;
  // a no-op wherever the constraint is unsupported.
  try {
    await stream.getVideoTracks()[0]?.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
  } catch { /* unsupported */ }
  return stream;
}

export function closeCamera(videoEl) {
  const stream = videoEl?.srcObject;
  if (stream) stream.getTracks().forEach((t) => t.stop());
  if (videoEl) videoEl.srcObject = null;
}

// Full-resolution JPEG Blob (for the OCR endpoints — raw bytes body)
export function grabBlob(videoEl, quality = 0.92) {
  const c = document.createElement('canvas');
  c.width = videoEl.videoWidth; c.height = videoEl.videoHeight;
  c.getContext('2d').drawImage(videoEl, 0, 0);
  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', quality));
}

// Full-resolution base64 (no data: prefix — verify-face contract)
export function grabB64(videoEl, quality = 0.92) {
  const c = document.createElement('canvas');
  c.width = videoEl.videoWidth; c.height = videoEl.videoHeight;
  c.getContext('2d').drawImage(videoEl, 0, 0);
  return c.toDataURL('image/jpeg', quality).replace(/^data:[^,]*,/, '');
}

// Cheap focus score: Laplacian variance on a downscaled grayscale frame.
// Only meaningful RELATIVE to other frames of the same scene/device.
function focusScore(videoEl, maxW = 240) {
  const scale = Math.min(1, maxW / videoEl.videoWidth);
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(videoEl.videoWidth * scale));
  c.height = Math.max(2, Math.round(videoEl.videoHeight * scale));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(videoEl, 0, 0, c.width, c.height);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  const w = c.width, h = c.height;
  const g = new Float32Array(w * h);
  for (let i = 0, p = 0; i < g.length; i++, p += 4)
    g[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  let sum = 0, sum2 = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w];
      sum += v; sum2 += v * v; n++;
    }
  }
  const mean = sum / n;
  return sum2 / n - mean * mean;
}

// Sample several frames over ~1s and keep the SHARPEST one — beats a single
// shutter grab whenever the hand is still settling (motion blur was the top
// capture-quality failure in office testing).
export async function grabSharpestBlob(videoEl, { samples = 5, intervalMs = 180, quality = 0.92 } = {}) {
  let best = null, bestScore = -1;
  for (let i = 0; i < samples; i++) {
    const score = focusScore(videoEl);
    if (score > bestScore) {
      bestScore = score;
      best = await grabBlob(videoEl, quality);
    }
    if (i < samples - 1) await new Promise((r) => setTimeout(r, intervalMs));
  }
  return best;
}

// Decode a camera JPEG into upright pixels and re-encode. ImageCapture stills
// carry EXIF orientation that server-side cv2.imread IGNORES — without this the
// OCR pipeline can receive a sideways card. Longest edge capped: 12MP adds
// nothing over ~3200px for OCR/barcode but triples upload time.
async function normalizeBlob(blob, maxEdge = 3200, quality = 0.92) {
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', quality));
  } finally {
    bmp.close();
  }
}

// Best available still for the ID sides: ImageCapture.takePhoto() uses the FULL
// photo sensor (typically 3-4x the video stream's resolution — what makes the
// back strip's PDF417 resolvable) with autofocus. Falls back to the
// sharpest-of-N video grab wherever takePhoto is unsupported (iOS Safari).
export async function grabStillBlob(videoEl, opts = {}) {
  const track = videoEl?.srcObject?.getVideoTracks?.()[0];
  if (track && typeof window !== 'undefined' && 'ImageCapture' in window) {
    try {
      const ic = new ImageCapture(track);
      const caps = await ic.getPhotoCapabilities().catch(() => null);
      const settings = {};
      if (caps?.imageWidth?.max) settings.imageWidth = caps.imageWidth.max;
      if (caps?.imageHeight?.max) settings.imageHeight = caps.imageHeight.max;
      const shot = await Promise.race([
        ic.takePhoto(settings).catch(() => ic.takePhoto()),
        new Promise((r) => setTimeout(() => r(null), 2500)),
      ]);
      if (shot) {
        const norm = await normalizeBlob(shot).catch(() => null);
        if (norm) return norm;
      }
    } catch { /* fall through to video grab */ }
  }
  return grabSharpestBlob(videoEl, opts);
}

// Downscaled JPEG Blob for live detection frames (payload size)
export function grabSmallBlob(videoEl, maxW = 480, quality = 0.7) {
  const scale = Math.min(1, maxW / videoEl.videoWidth);
  const c = document.createElement('canvas');
  c.width = Math.round(videoEl.videoWidth * scale);
  c.height = Math.round(videoEl.videoHeight * scale);
  c.getContext('2d').drawImage(videoEl, 0, 0, c.width, c.height);
  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', quality));
}

// Downscaled base64 for liveness challenge frames (payload size)
export function grabChallengeB64(videoEl, maxW = 480, quality = 0.7) {
  const scale = Math.min(1, maxW / videoEl.videoWidth);
  const c = document.createElement('canvas');
  c.width = Math.round(videoEl.videoWidth * scale);
  c.height = Math.round(videoEl.videoHeight * scale);
  c.getContext('2d').drawImage(videoEl, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality).replace(/^data:[^,]*,/, '');
}

// Tiny haptic tick — capture confirmations feel physical on phones that support it.
export function buzz(ms = 30) {
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
}

// Torch (rear flash) — capability depends on device/browser; both helpers are
// safe no-ops when unsupported.
export function hasTorch(videoEl) {
  try {
    const track = videoEl?.srcObject?.getVideoTracks?.()[0];
    return !!track?.getCapabilities?.().torch;
  } catch { return false; }
}

export async function setTorch(videoEl, on) {
  try {
    const track = videoEl?.srcObject?.getVideoTracks?.()[0];
    if (!track?.getCapabilities?.().torch) return false;
    await track.applyConstraints({ advanced: [{ torch: !!on }] });
    return true;
  } catch { return false; }
}
