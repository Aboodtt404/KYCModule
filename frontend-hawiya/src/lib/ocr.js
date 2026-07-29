// OCR service client — see docs/BACKEND-PIPELINE.md for the full contract.
const BASE =
  import.meta.env.VITE_OCR_SERVER_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '');

async function jsonOrThrow(res) {
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON error page */ }
  if (!res.ok) {
    const msg = body?.error || `Service error (HTTP ${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.code = body?.error_code;
    throw err;
  }
  return body;
}

export async function health(timeoutMs = 4000) {
  const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error('unhealthy');
  return res.json();
}

// blob: raw image bytes (Blob) → front-of-card extraction + verdict
export function readFront(blob, signal) {
  return fetch(`${BASE}/egyptian-id`, { method: 'POST', body: blob, signal }).then(jsonOrThrow);
}

export function readBack(blob, signal) {
  return fetch(`${BASE}/egyptian-id-back`, { method: 'POST', body: blob, signal }).then(jsonOrThrow);
}

// base64 strings WITHOUT the data: prefix
export function verifyFace(idImageB64, liveImageB64, challengeFramesB64, signal) {
  return fetch(`${BASE}/verify-face`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id_image: idImageB64,
      live_image: liveImageB64,
      challenge_frames: challengeFramesB64 || []
    }),
    signal
  }).then(jsonOrThrow);
}

// Dedicated barcode-strip re-scan (user fills the frame with the black strip)
export function readStrip(blob, signal) {
  return fetch(`${BASE}/barcode-strip`, { method: 'POST', body: blob, signal }).then(jsonOrThrow);
}

// Tilt-under-torch burst (document liveness) — base64 frames WITHOUT prefix.
// ABSTAIN/log-only signal; callers must continue the flow whatever the result.
export function holoCheck(framesB64, signal) {
  return fetch(`${BASE}/holo-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frames: framesB64 }),
    signal
  }).then(jsonOrThrow);
}

export const stripDataUrl = (dataUrl) => dataUrl.replace(/^data:[^,]*,/, '');

// Live capture guidance: card + field boxes on a downscaled viewfinder frame.
// Returns {card: [x,y,w,h]|null, fields: [{name, box}]} normalized to the sent frame.
export function detectFields(blob, signal) {
  return fetch(`${BASE}/detect-fields`, { method: 'POST', body: blob, signal }).then(jsonOrThrow);
}

// Live session-step mirror (desktop watches the phone's progress).
export function reportStep(sessionId, step) {
  if (!sessionId) return;
  fetch(`${BASE}/session-step`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, step })
  }).catch(() => { /* mirror is best-effort */ });
}

export async function getStep(sessionId, signal) {
  const res = await fetch(`${BASE}/session-step/${encodeURIComponent(sessionId)}`, { signal });
  if (!res.ok) return null;
  return (await res.json()).step || null;
}
