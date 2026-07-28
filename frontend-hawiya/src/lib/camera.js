// Camera helpers — getUserMedia lifecycle + frame grabs.
export async function openCamera(videoEl, facing = 'environment') {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false
  });
  videoEl.srcObject = stream;
  await videoEl.play().catch(() => {});
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
