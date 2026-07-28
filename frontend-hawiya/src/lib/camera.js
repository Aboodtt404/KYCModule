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
