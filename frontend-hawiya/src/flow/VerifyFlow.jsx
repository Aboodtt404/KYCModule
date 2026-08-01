import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { C } from '@/theme';
import { Wordmark, StepDots } from '@/components/ui';
import { health, holoCheck, readFront, readBack, readPassport, readStrip, reportStep, verifyFace } from '@/lib/ocr';
import { agentReady, kycActor, smsActor } from '@/lib/agent';
import { buzz, closeCamera, cropCenterBand, grabB64, grabChallengeB64, grabStillBlob, openCamera } from '@/lib/camera';
import { humanError } from '@/lib/errors';
import {
  Welcome, SvcDown, CaptureScreen, FrontProcessing, VerdictReject, VerdictAccept,
  VerdictAbstain, BackProcessing, BackMismatch, BackReview, HoloCheck,
  StripScan, StripProcessing, PassportProcessing, PassportReview
} from './screens-id';
import {
  SelfieIntro, SelfieCapture, FaceProcessing, LivenessFail, FaceOk,
  PhoneScreen, OtpScreen, DuplicateScreen, ReviewScreen, Submitting, StatusScreen
} from './screens-person';

const uuid = () =>
  crypto.randomUUID ? crypto.randomUUID() :
  'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

const PHASE = (step) =>
  /^(front|verdict|passport)/.test(step) ? 1 :
  /^back/.test(step) ? 2 :
  /^(selfie|face|liveness)/.test(step) ? 3 :
  /^(phone|otp)/.test(step) ? 4 :
  /^(review|submitting|duplicate)/.test(step) ? 5 : 0;

// The whole user verification journey. When `sessionId` is provided (QR handoff
// target) the final submit calls complete_verification instead of submit_kyc.
export default function VerifyFlow({ sessionId = null, onCompleted = null }) {
  const [step, setStep] = useState('welcome');
  const [procStage, setProcStage] = useState(-1);
  const [front, setFront] = useState(null);        // extracted_data from /egyptian-id
  const [passport, setPassport] = useState(null);  // data from /passport (docType 'passport')
  const [idFaceB64, setIdFaceB64] = useState(null);
  const [back, setBack] = useState(null);
  const [faceResult, setFaceResult] = useState(null);
  const [livenessReason, setLivenessReason] = useState(null);
  const [addr, setAddr] = useState('');
  const [fixes, setFixes] = useState({});   // user corrections at review — flagged in the payload
  const [phone, setPhone] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpError, setOtpError] = useState(false);
  const [error, setError] = useState(null);
  const [framesDone, setFramesDone] = useState(0);
  const [reference, setReference] = useState(null);
  const [redirectUrl, setRedirectUrl] = useState(null); // partner sessions: return-to-app leg
  const [shotUrl, setShotUrl] = useState(null);   // captured frame, shown during the scan reveal
  const videoRef = useRef(null);
  const timersRef = useRef([]);
  const abortRef = useRef(null);
  const holoRef = useRef(null);   // tilt-challenge result — log-only, rides in the payload

  const later = (ms, fn) => timersRef.current.push(setTimeout(fn, ms));
  useEffect(() => () => {
    timersRef.current.forEach(clearTimeout);
    abortRef.current?.abort();
    closeCamera(videoRef.current);
  }, []);

  const go = useCallback((s) => { setError(null); setStep(s); }, []);

  // Desktop mirror: when this flow was opened from a QR session, report each
  // step so the desktop page can narrate progress live. Labels only.
  useEffect(() => { reportStep(sessionId, step); }, [sessionId, step]);

  // ── entry: health gate ───────────────────────────────────────────────────
  const begin = async () => {
    go('front-proc-health');
    try { await health(); go('front-cap'); }
    catch { go('svc-down'); }
  };
  const beginPassport = async () => {
    go('front-proc-health');
    try { await health(); go('passport-cap'); }
    catch { go('svc-down'); }
  };

  // ── passport data page ─────────────────────────────────────────────────
  const capturePassport = async () => {
    const video = videoRef.current;
    setError(null);
    const blob = video && video.videoWidth ? await grabStillBlob(video) : null;
    if (!blob) { setError('Camera is still starting — give it a second and try again. · الكاميرا لا تزال تبدأ — انتظر لحظة وحاول مجددًا.'); return; }
    closeCamera(video);
    go('passport-proc');
    const ctl = new AbortController(); abortRef.current = ctl;
    try {
      const res = await readPassport(blob, ctl.signal);
      if (!res.success || !res.data) throw new Error(res.error || 'Could not read the passport');
      setPassport(res.data);
      setIdFaceB64(res.data.face_image || null);
      go('passport-review');
    } catch (e) {
      go('passport-cap');
      setError(humanError(e, 'ocr'));
    }
  };

  // ── camera lifecycle per capture step ───────────────────────────────────
  useEffect(() => {
    if (!['front-cap', 'back-cap', 'selfie-cap', 'holo-check', 'strip-cap', 'passport-cap'].includes(step)) return undefined;
    const facing = step === 'selfie-cap' ? 'user' : 'environment';
    // The step-transition animation mounts the screen (and its <video>) a beat
    // AFTER the step changes — retry until the element exists.
    let cancelled = false;
    const tryOpen = (attempt = 0) => {
      if (cancelled) return;
      const v = videoRef.current;
      if (v) {
        // ID sides open at 4K when the phone supports it — the back strip's
        // PDF417 needs the pixels; the selfie pipeline doesn't.
        // Open failures RETRY too: Android throws NotReadableError when the
        // previous step's track isn't fully released yet — transient, not a
        // permissions problem.
        openCamera(v, facing, { hiRes: facing === 'environment' }).catch(() => {
          if (cancelled) return;
          if (attempt < 8) setTimeout(() => tryOpen(attempt + 1), 400);
          else setError('Camera unavailable — allow camera access or use HTTPS.');
        });
      } else if (attempt < 30) {
        setTimeout(() => tryOpen(attempt + 1), 100);
      }
    };
    tryOpen();
    return () => { cancelled = true; closeCamera(videoRef.current); };
  }, [step]);

  // ── front of card ────────────────────────────────────────────────────────
  const captureFront = async () => {
    const video = videoRef.current;
    setError(null);
    const blob = video && video.videoWidth ? await grabStillBlob(video) : null;
    if (!blob) { setError('Camera is still starting — give it a second and try again. · الكاميرا لا تزال تبدأ — انتظر لحظة وحاول مجددًا.'); return; }
    closeCamera(video);
    setShotUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
    setProcStage(0); go('front-proc');
    later(1200, () => setProcStage((s) => Math.max(s, 1)));
    later(6000, () => setProcStage((s) => Math.max(s, 2)));
    const ctl = new AbortController(); abortRef.current = ctl;
    try {
      const res = await readFront(blob, ctl.signal);
      setProcStage(3);
      const data = res.extracted_data || {};
      setFront(data);
      setAddr(data.address || '');
      setIdFaceB64(data.face_image || res.face_verification?.face_image || null);
      const verdict = data.verification?.verdict || 'abstain';
      go(`verdict-${['accept', 'abstain', 'reject'].includes(verdict) ? verdict : 'abstain'}`);
    } catch (e) {
      // Quality rejection (blur) → straight back to the camera with the note;
      // anything else is a service problem. go() clears error state — set the
      // message AFTER navigating or it never renders.
      go(/blurry|steady/i.test(e.message) ? 'front-cap' : 'svc-down');
      setError(humanError(e, 'ocr'));
    }
  };

  // ── back of card ─────────────────────────────────────────────────────────
  const captureBack = async () => {
    const video = videoRef.current;
    setError(null);
    stripTriesRef.current = 0;   // fresh back scan → fresh strip attempts
    const blob = video && video.videoWidth ? await grabStillBlob(video) : null;
    if (!blob) { setError('Camera is still starting — give it a second and try again. · الكاميرا لا تزال تبدأ — انتظر لحظة وحاول مجددًا.'); return; }
    closeCamera(video);
    go('back-proc');
    const ctl = new AbortController(); abortRef.current = ctl;
    try {
      const res = await readBack(blob, ctl.signal);
      const b = { ...(res.extracted_data || {}), _barcode: res.barcode || null };
      setBack(b);
      const frontNid = (front?.national_id || '').replace(/\D/g, '');
      const backNid = (b.national_id || '').replace(/\D/g, '');
      // printed-band vs barcode disagreement is fraud-grade, same as front≠back
      if ((frontNid && backNid && frontNid !== backNid) || res.barcode?.nid_mismatch) go('back-mismatch');
      // strip didn't decode from the whole-card frame → offer a dedicated
      // strip-fill scan (3x the pixels-per-module) before the review
      else if (!res.barcode?.decoded) go('strip-cap');
      else go('back-review');
    } catch (e) {
      go('back-cap'); setError(humanError(e, 'ocr'));
    }
  };

  // ── dedicated strip re-scan ──────────────────────────────────────────────
  // Never blocks: any failure lands on the review with the check marked
  // unreadable; a decoded strip that CONTRADICTS the front is a mismatch.
  // Each shutter press grabs a 2-shot burst (independent autofocus attempts)
  // and the first failure earns ONE coached retry — a single silent shot was
  // how the first office test slipped past this step with nothing decoded.
  const stripTriesRef = useRef(0);
  const captureStrip = async () => {
    const video = videoRef.current;
    setError(null);
    if (!video || !video.videoWidth) { setError('Camera is still starting — give it a second and try again. · الكاميرا لا تزال تبدأ — انتظر لحظة وحاول مجددًا.'); return; }
    const shots = [];
    // Crop each still to the viewfinder's center band — the upload contains
    // exactly what the user framed (and the strip screen zooms, so the band
    // carries the full sampling gain).
    const first = await grabStillBlob(video).then(cropCenterBand).catch(() => null);
    if (first) shots.push(first);
    const second = await grabStillBlob(video).then(cropCenterBand).catch(() => null);
    if (second) shots.push(second);
    if (!shots.length) { setError('Camera is still starting — give it a second and try again. · الكاميرا لا تزال تبدأ — انتظر لحظة وحاول مجددًا.'); return; }
    closeCamera(video);
    go('strip-proc');
    let decoded = null;
    for (const blob of shots) {
      try {
        const r = await readStrip(blob);
        if (r.barcode?.decoded) { decoded = r.barcode; break; }
      } catch { /* try the next shot */ }
    }
    if (decoded) {
      setBack((prev) => ({ ...(prev || {}), _barcode: decoded }));
      const stripNid = (decoded.nid || '').replace(/\D/g, '');
      const frontNid = (front?.national_id || '').replace(/\D/g, '');
      go(stripNid && frontNid && stripNid !== frontNid ? 'back-mismatch' : 'back-review');
      return;
    }
    stripTriesRef.current += 1;
    if (stripTriesRef.current < 2) {
      go('strip-cap');   // go() clears error — set the coaching AFTER navigating
      setError("Couldn't read it yet — get closer so the strip fills the frame, then hold steady. · لم نتمكن من قراءته بعد — اقترب أكثر حتى يملأ الشريط الإطار وأمسك الهاتف بثبات.");
    } else {
      go('back-review');
    }
  };

  // ── document liveness (tilt-under-torch) ─────────────────────────────────
  // ABSTAIN/log-only: the flow moves on immediately; the score lands in the
  // submission payload if the request comes back in time.
  const finishHolo = (frames) => {
    go('selfie-intro');
    if (frames?.length >= 3) {
      holoCheck(frames)
        .then((r) => { holoRef.current = r?.holo || null; })
        .catch(() => {});
    }
  };

  // ── selfie + active liveness ─────────────────────────────────────────────
  const startSelfie = () => {
    setFramesDone(0); setLivenessReason(null);
    go('selfie-cap');
    later(600, async () => {
      const video = videoRef.current;
      if (!video) return;
      const frames = [];
      // Each prompt stays up long enough to read AND perform the motion before
      // the frame is grabbed (office feedback: 900ms flashed faster than
      // anyone could read).
      for (let n = 1; n <= 4; n++) {
        await new Promise((r) => setTimeout(r, 2400));
        if (!videoRef.current) return;
        frames.push(grabChallengeB64(video));
        setFramesDone(n);
        buzz(20);
      }
      await new Promise((r) => setTimeout(r, 700));
      const liveB64 = grabB64(video);
      closeCamera(video);
      go('face-proc');
      try {
        const res = await verifyFace(idFaceB64, liveB64, frames);
        const vr = res.verification_result || {};
        setFaceResult(vr);
        if (vr.liveness_failed) { setLivenessReason(vr.liveness_reason); go('liveness-fail'); }
        else if (!vr.is_match) { setLivenessReason('no_match'); go('liveness-fail'); }
        else go('face-ok');
      } catch (e) {
        setLivenessReason(e.code === 'ERR_NO_FACE' ? 'no_face' : 'server');
        go('liveness-fail');
        setError(humanError(e, 'face'));
      }
    });
  };

  // ── phone / OTP ──────────────────────────────────────────────────────────
  const sendOtp = async () => {
    setOtpError(false);
    try {
      await agentReady;
      const res = await smsActor().send_sms(`+20${phone.replace(/\D/g, '')}`);
      if (!res.success) throw new Error(res.message || 'Could not send SMS');
      go('otp');
    } catch (e) { setError(humanError(e, 'sms')); }
  };

  const dupCheckThenReview = async () => {
    const nid = (front?.national_id || '').replace(/\D/g, '');
    let dup = false;
    try { await agentReady; dup = await kycActor().national_id_exists(nid); } catch { /* non-fatal */ }
    go(dup ? 'duplicate' : 'review');
  };

  const submitOtp = async (code) => {
    try {
      const res = await smsActor().verify_otp(`+20${phone.replace(/\D/g, '')}`, code);
      if (!res.success) { setOtpError(true); return; }
      setPhoneVerified(true);
      await dupCheckThenReview();
    } catch (e) { setError(humanError(e, 'sms')); setOtpError(true); }
  };

  // Temporary: SMS provider not configured in this environment — allow skipping.
  const skipPhone = async () => {
    setPhoneVerified(false);
    await dupCheckThenReview();
  };

  // ── submit ───────────────────────────────────────────────────────────────
  const submitKyc = async () => {
    go('submitting');
    await agentReady;
    const id = sessionId || uuid();
    const birth = front?.birth_date || '';
    const ageFrom = (d) => {
      const t = Date.parse(d);
      return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / (365.25 * 24 * 3600 * 1000));
    };
    // Shape must match the canister's KycSubmissionPayload (kycData.ocrData.*);
    // complete_verification additionally validates a TOP-LEVEL ocrData.national_id.
    const userEdited = Object.keys(fixes).filter((k) => fixes[k] !== undefined);
    if (addr && addr !== (front?.address || '')) userEdited.push('address');
    // Passport submissions map MRZ fields into the same payload shape; the
    // NID comes from the VIZ read when found (it is NOT in the Egyptian MRZ).
    const ocrData = passport ? {
      full_name: passport.full_name || '',
      national_id: passport.nid_viz?.nid || '',
      birth_date: passport.birth_date || '',
      age: ageFrom(passport.birth_date || ''),
      address: addr || '',
      governorate: 'غير محدد',
      gender: passport.sex || 'غير محدد',
      serial_number: '',
      document_type: 'passport',
      passport_number: passport.document_number || '',
      nationality: passport.nationality || '',
      expiry_date: passport.expiry_date || '',
      mrz_valid_score: passport.mrz?.valid_score ?? null,
      passport_expired: !!passport.expired,
      ocr_verdict: (passport.verdict || 'abstain').toLowerCase()
    } : {
      full_name: fixes.full_name ?? (front?.full_name || ''),
      national_id: front?.national_id || '',
      birth_date: birth,
      age: ageFrom(birth),
      address: addr || front?.address || '',
      governorate: front?.governorate || 'غير محدد',
      gender: front?.gender || 'غير محدد',
      serial_number: front?.serial || '',
      national_id_back: back?.national_id || '',
      marital_status: back?.marital_status || '',
      occupation: fixes.occupation ?? (back?.occupation || ''),
      issue_date: back?.issue_date || '',
      expiry_date: back?.expiry_date || '',
      ocr_verdict: front?.verification?.verdict || 'abstain'
    };
    const kycData = {
      submissionId: id,
      timestamp: new Date().toISOString(),
      phone: phoneVerified ? `+20${phone.replace(/\D/g, '')}` : '',
      email: '',
      documentFile: '',
      ocrData,
      faceVerified: true,
      phone_verified: phoneVerified,
      face_similarity: faceResult?.similarity_score ?? null,
      liveness_mode: faceResult?.liveness_mode || null,
      status: 'pending',
      user_edited: userEdited,
      document_liveness: holoRef.current?.hint || null,
      strip_decoded: !!back?._barcode?.decoded,
      strip_nid: back?._barcode?.nid || ''
    };
    try {
      const actor = kycActor();
      const res = sessionId
        ? await actor.complete_verification(sessionId, JSON.stringify({ kycData, ocrData }))
        : await actor.submit_kyc(id, JSON.stringify({ kycData }));
      if (res && 'Err' in res) throw new Error(res.Err);
      setReference(`KYC-${id.slice(0, 4).toUpperCase()}-${id.slice(4, 8).toUpperCase()}`);
      // Partner-created sessions carry a return URL — offer the way back.
      if (sessionId) {
        try {
          const raw = await actor.get_verification_status(sessionId);
          const sess = raw?.[0] ? JSON.parse(raw[0]) : (typeof raw === 'string' ? JSON.parse(raw) : null);
          if (sess?.redirect_url && /^https?:\/\//.test(sess.redirect_url)) setRedirectUrl(sess.redirect_url);
        } catch { /* return leg is optional */ }
      }
      go('status');
      onCompleted?.();
    } catch (e) { go('review'); setError(humanError(e, 'submit')); }
  };

  const phase = PHASE(step);
  const showHeader = !['welcome', 'svc-down', 'status', 'submitting'].includes(step);
  // Downstream screens (review etc.) are NID-shaped — give them a compatible
  // view of the passport read. State handlers use the real `front` closure.
  const frontForUi = passport ? {
    full_name: passport.full_name, national_id: passport.nid_viz?.nid || '',
    birth_date: passport.birth_date, gender: passport.sex, address: ''
  } : front;
  const props = {
    go, error, setError, front: frontForUi, back, addr, setAddr, phone, setPhone,
    otpError, setOtpError, framesDone, faceResult, livenessReason, reference,
    videoRef, begin, beginPassport, captureFront, captureBack, startSelfie, sendOtp, submitOtp,
    skipPhone, phoneVerified, submitKyc, sessionId, fixes, setFixes, shotUrl
  };

  return (
    <div style={{
      minHeight: '100dvh', background: C.surface, display: 'flex',
      flexDirection: 'column', maxWidth: 560, margin: '0 auto', width: '100%'
    }}>
      {showHeader && (
        <div style={{ padding: '18px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Wordmark />
          <StepDots phase={phase} />
        </div>
      )}
      <AnimatePresence mode="wait">
      <motion.div key={step}
        initial={{ opacity: 0, x: 26 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -26 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {step === 'welcome' && <Welcome {...props} />}
      {(step === 'svc-down') && <SvcDown {...props} />}
      {step === 'front-proc-health' && <FrontProcessing stage={-1} healthOnly />}
      {step === 'front-cap' && (
        <CaptureScreen {...props} onShutter={captureFront} liveGuide
          title="Front of your ID" ar="الوجه الأمامي للبطاقة"
          caption="Fit the card inside the frame · ضع البطاقة داخل الإطار" />
      )}
      {step === 'front-proc' && <FrontProcessing stage={procStage} shotUrl={shotUrl} />}
      {step === 'passport-cap' && (
        <CaptureScreen {...props} onShutter={capturePassport} autoCapture={false}
          title="Passport data page" ar="صفحة البيانات في الجواز"
          caption="Whole page in frame, no flash — glare hides the code · الصفحة كاملة داخل الإطار بدون فلاش" />
      )}
      {step === 'passport-proc' && <PassportProcessing />}
      {step === 'passport-review' && <PassportReview passport={passport} go={go} />}
      {step === 'verdict-reject' && <VerdictReject {...props} />}
      {step === 'verdict-accept' && <VerdictAccept {...props} />}
      {step === 'verdict-abstain' && <VerdictAbstain {...props} />}
      {step === 'back-cap' && (
        <CaptureScreen {...props} onShutter={captureBack} minFrac={0.6}
          title="Now the back" ar="الوجه الخلفي للبطاقة"
          caption="Get close — the barcode strip needs the pixels · اقترب — الشريط يحتاج وضوحًا عاليًا" />
      )}
      {step === 'back-proc' && <BackProcessing />}
      {step === 'back-mismatch' && <BackMismatch {...props} />}
      {step === 'strip-cap' && (
        <StripScan videoRef={videoRef} error={error}
          onShutter={captureStrip} onSkip={() => go('back-review')} />
      )}
      {step === 'strip-proc' && <StripProcessing />}
      {step === 'back-review' && <BackReview {...props} />}
      {step === 'holo-check' && (
        <HoloCheck videoRef={videoRef} onBurst={finishHolo} onSkip={() => go('selfie-intro')} />
      )}
      {step === 'selfie-intro' && <SelfieIntro {...props} />}
      {step === 'selfie-cap' && <SelfieCapture {...props} />}
      {step === 'face-proc' && <FaceProcessing />}
      {step === 'liveness-fail' && <LivenessFail {...props} />}
      {step === 'face-ok' && <FaceOk {...props} />}
      {step === 'phone' && <PhoneScreen {...props} />}
      {step === 'otp' && <OtpScreen {...props} />}
      {step === 'duplicate' && <DuplicateScreen {...props} />}
      {step === 'review' && <ReviewScreen {...props} />}
      {step === 'submitting' && <Submitting />}
      {step === 'status' && <StatusScreen {...props} redirectUrl={redirectUrl} />}
      </motion.div>
      </AnimatePresence>
    </div>
  );
}
