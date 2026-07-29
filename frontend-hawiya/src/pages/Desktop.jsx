import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { C, F, btnPrimary, btnGhost, h1, arSub } from '@/theme';
import { Card, Chip, Mono, Row, Wordmark } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { agentReady, kycActor } from '@/lib/agent';
import { getStep } from '@/lib/ocr';

const uuid = () =>
  crypto.randomUUID ? crypto.randomUUID() :
  Math.random().toString(16).slice(2) + '-' + Math.random().toString(16).slice(2);


const STEP_LABEL = {
  'welcome': 'Opening the flow…', 'front-cap': 'Scanning the front of the ID…',
  'front-proc': 'Reading the front of the ID…', 'verdict-accept': 'Front verified ✓',
  'verdict-abstain': 'Confirming details…', 'verdict-reject': 'Front needs a retake…',
  'back-cap': 'Scanning the back of the ID…', 'back-proc': 'Reading the back…',
  'back-review': 'Back read ✓', 'back-mismatch': 'Re-scanning the back…',
  'selfie-intro': 'Getting ready for the selfie…', 'selfie-cap': 'Taking the liveness selfie…',
  'face-proc': 'Matching face to ID…', 'face-ok': 'Face verified ✓',
  'liveness-fail': 'Retrying the selfie…', 'phone': 'Entering phone number…',
  'otp': 'Entering the SMS code…', 'review': 'Reviewing before submit…',
  'submitting': 'Submitting…', 'status': 'Submitted ✓'
};

const SESSION_UI = {
  pending: { bg: C.shell, dot: C.inkFaint, fg: '#7a6752', anim: 'pulse 2s infinite', title: 'Waiting for your phone…', sub: 'Scan the code to begin — this page updates automatically' },
  in_progress: { bg: C.warnBg, dot: C.accent, fg: C.warnFg, anim: 'pulse 1.2s infinite', title: 'In progress on your phone', sub: 'Verification steps are running — keep this window open' },
  completed: { bg: C.okBg, dot: C.okFg, fg: C.okFg, anim: 'none', title: 'Verification complete', sub: 'Your phone finished all checks — review and submit below' },
  expired: { bg: C.errBg, dot: C.errFg, fg: C.errFg, anim: 'none', title: 'Session expired', sub: 'Sessions last 24 h — generate a new code to continue' },
  cancelled: { bg: C.errBg, dot: C.errFg, fg: C.errFg, anim: 'none', title: 'Session cancelled', sub: 'Generate a new code to try again' }
};

export default function Desktop() {
  const { isAuthenticated, principal, busy, login } = useAuth();
  const [step, setStep] = useState('login'); // login | hub | qr | done
  const [sessionId, setSessionId] = useState(null);
  const [sess, setSess] = useState('pending');
  const [sessData, setSessData] = useState(null);
  const [hb, setHb] = useState(0);
  const [phoneStep, setPhoneStep] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => { if (isAuthenticated && step === 'login') setStep('hub'); }, [isAuthenticated, step]);
  useEffect(() => () => clearInterval(pollRef.current), []);

  const chooseQr = useCallback(async () => {
    clearInterval(pollRef.current);
    const id = uuid();
    setError(null);
    try {
      await agentReady;
      const res = await kycActor().create_verification_session(id);
      if (res && 'Err' in res) throw new Error(res.Err);
    } catch (e) { setError(e.message); return; }
    setSessionId(id); setSess('pending'); setSessData(null); setHb(0); setPhoneStep(null); setStep('qr');
    pollRef.current = setInterval(async () => {
      try {
        const raw = await kycActor().get_verification_status(id);
        const txt = Array.isArray(raw) ? raw[0] : raw;
        if (!txt) return;
        const st = JSON.parse(txt);
        const done = st.status === 'completed' || (st.completed_at && st.data);
        setSess(done ? 'completed' : st.status || 'pending');
        setHb((h) => h + 1);
        getStep(id).then((ps) => ps && setPhoneStep(ps)).catch(() => {});
        if (done) {
          clearInterval(pollRef.current);
          let data = st.data;
          try { data = typeof data === 'string' ? JSON.parse(data) : data; } catch { /* keep raw */ }
          const kd = data?.kycData || data || {};
          setSessData({ ...kd, ocrData: kd.ocrData || data?.ocrData || {} });
        }
      } catch { /* transient poll error */ }
    }, 3000);
  }, []);

  const submitDesktop = async () => {
    try {
      const res = await kycActor().submit_kyc(sessionId, JSON.stringify({ kycData: sessData }));
      if (res && 'Err' in res) throw new Error(res.Err);
      setStep('done');
    } catch (e) { setError(e.message); }
  };

  const mobileUrl = `${window.location.origin}/mobile-verify/${sessionId}`;
  const sm = SESSION_UI[sess] || SESSION_UI.pending;

  return (
    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 28px 56px' }}>
      <div style={{ width: 980, maxWidth: '100%', background: C.surface, borderRadius: 18, boxShadow: '0 18px 50px rgba(61,44,34,.16)', overflow: 'hidden' }}>
        {step !== 'login' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', background: C.shell, borderBottom: `1px solid ${C.lineStrong}` }}>
            <Wordmark size={20} />
            <div style={{ flex: 1 }} />
            {principal && <Mono style={{ fontSize: 10.5, color: C.inkSoft, background: C.surface, padding: '6px 12px', borderRadius: 99 }}>{principal.slice(0, 5)}…{principal.slice(-3)}</Mono>}
          </div>
        )}

        {step === 'login' && (
          <div style={{ minHeight: 520, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 400, background: '#fff', borderRadius: 22, padding: '38px 34px', boxShadow: '0 4px 20px rgba(61,44,34,.08)', textAlign: 'center' }}>
              <img src="/brand/hawiya-appicon.svg" alt="Hawiya" style={{ width: 58, height: 58, borderRadius: 20, margin: '0 auto', display: 'block', boxShadow: '0 5px 14px rgba(194,65,12,.25)' }} />
              <div style={{ ...h1(30), marginTop: 18 }}>Sign in to verify</div>
              <div dir="rtl" style={arSub(18)}>سجّل الدخول للتحقق</div>
              <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 12, lineHeight: 1.6 }}>
                Your identity on-chain — no passwords, no anchor numbers. Passkey or Google via Internet Identity.
              </div>
              {busy ? (
                <div style={{ marginTop: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 15, borderRadius: 14, background: C.shell, color: C.inkSoft, fontSize: 14 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: '3px solid #d8c7b2', borderTopColor: C.primary, animation: 'spin .8s linear infinite' }} />
                  Waiting for Internet Identity…
                </div>
              ) : (
                <button onClick={login} style={{ marginTop: 26, width: '100%', background: C.cocoa, color: C.surface, border: 'none', borderRadius: 14, padding: 15, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: F.body, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>∞</span>Continue with Internet Identity
                </button>
              )}
              <button onClick={() => setStep('hub')} style={{ ...btnGhost, marginTop: 12, fontSize: 12.5 }}>
                Continue anonymously · بدون تسجيل
              </button>
            </div>
          </div>
        )}

        {step === 'hub' && (
          <div style={{ minHeight: 520, padding: '50px 60px' }}>
            <div style={h1(34)}>How do you want to verify?</div>
            <div dir="rtl" style={arSub(20)}>كيف تريد إتمام التحقق؟</div>
            {error && <div style={{ marginTop: 12, color: C.errFg, fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 22, marginTop: 34, flexWrap: 'wrap' }}>
              <button onClick={chooseQr} style={{ flex: 1, minWidth: 280, textAlign: 'left', background: '#fff', border: `2px solid ${C.primary}`, borderRadius: 22, padding: 30, cursor: 'pointer', fontFamily: F.body, color: C.ink, boxShadow: '0 6px 24px rgba(194,65,12,.12)' }}>
                <div style={{ fontSize: 30 }}>📱</div>
                <div style={{ ...h1(24), marginTop: 12 }}>Continue on your phone</div>
                <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 6, lineHeight: 1.6 }}>
                  Scan a QR code — your phone's camera is better for ID capture and selfies. <b>Recommended.</b>
                </div>
                <div style={{ display: 'inline-block', marginTop: 14, fontSize: 12, fontWeight: 600, color: C.primary }}>Generate QR →</div>
              </button>
              <button onClick={() => navigate('/verify')} style={{ flex: 1, minWidth: 280, textAlign: 'left', background: '#fff', border: `1px solid ${C.lineStrong}`, borderRadius: 22, padding: 30, cursor: 'pointer', fontFamily: F.body, color: C.ink }}>
                <div style={{ fontSize: 30 }}>💻</div>
                <div style={{ ...h1(24), marginTop: 12 }}>Stay on this device</div>
                <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 6, lineHeight: 1.6 }}>
                  Use your webcam. Same steps, right here.
                </div>
              </button>
            </div>
          </div>
        )}

        {step === 'qr' && (
          <div style={{ minHeight: 520, padding: '44px 60px', display: 'flex', gap: 48, flexWrap: 'wrap' }}>
            <div style={{ width: 300, flex: 'none' }}>
              <div style={{ background: '#fff', borderRadius: 22, padding: 24, boxShadow: '0 4px 20px rgba(61,44,34,.08)' }}>
                <div style={{ opacity: sess === 'expired' ? 0.18 : 1, display: 'flex', justifyContent: 'center' }}>
                  <QRCodeSVG value={mobileUrl} size={252} bgColor="#ffffff" fgColor={C.cocoa} />
                </div>
                <Mono style={{ display: 'block', fontSize: 10, color: C.inkSoft, textAlign: 'center', marginTop: 14, wordBreak: 'break-all' }}>
                  /mobile-verify/{sessionId}
                </Mono>
              </div>
              {(sess === 'expired' || sess === 'cancelled') && (
                <button onClick={chooseQr} style={{ marginTop: 14, width: '100%', background: C.cocoa, color: C.surface, border: 'none', borderRadius: 14, padding: 13, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: F.body }}>
                  Generate a new code
                </button>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column' }}>
              <div style={h1(32)}>Scan with your phone</div>
              <div dir="rtl" style={arSub(19)}>امسح الرمز بهاتفك</div>
              <div style={{ marginTop: 22, borderRadius: 18, padding: '18px 22px', background: sm.bg, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: sm.dot, animation: sm.anim, flex: 'none' }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: sm.fg }}>{sm.title}</div>
                  <div style={{ fontSize: 12.5, color: sm.fg, opacity: 0.75, marginTop: 2 }}>{sm.sub}</div>
                </div>
              </div>
              {sess === 'completed' && sessData && (
                <>
                  <Card style={{ marginTop: 18, padding: '6px 0' }}>
                    <Row label="Applicant" value={<span dir="rtl" style={{ fontWeight: 600 }}>{sessData.ocrData?.full_name || '—'}</span>} />
                    <Row label="National ID" value={<Mono style={{ fontSize: 12.5, fontWeight: 600 }}>{sessData.ocrData?.national_id || '—'}</Mono>} />
                    <Row label="Checks" value={
                      <span style={{ color: C.okFg, fontWeight: 600, fontSize: 12.5 }}>
                        ID ✓ · Face ✓ · {sessData.phone_verified ? 'Phone ✓' : <span style={{ color: C.warnFg }}>Phone skipped</span>}
                      </span>} />
                    <Row label="OCR verdict" last value={
                      <Chip fg={sessData.ocrData?.ocr_verdict === 'accept' ? C.okFg : C.warnFg}
                        bg={sessData.ocrData?.ocr_verdict === 'accept' ? C.okBg : C.warnBg}>
                        {(sessData.ocrData?.ocr_verdict || 'abstain').replace(/^./, (c) => c.toUpperCase())}
                      </Chip>} />
                  </Card>
                  {error && <div style={{ marginTop: 10, color: C.errFg, fontSize: 13 }}>{error}</div>}
                  <button onClick={submitDesktop} style={{ ...btnPrimary, marginTop: 18, borderRadius: 14, padding: 15, fontSize: 14 }}>
                    Submit KYC · إرسال
                  </button>
                </>
              )}
              {(sess === 'pending' || sess === 'in_progress') && (
                <>
                  {phoneStep && STEP_LABEL[phoneStep] ? (
                    <div style={{ marginTop: 20, display: 'flex', gap: 10, alignItems: 'center', background: C.okBg, borderRadius: 14, padding: '12px 15px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.okFg, animation: 'pulse 1.4s ease-in-out infinite' }} />
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: C.okFg }}>On phone: {STEP_LABEL[phoneStep]}</div>
                    </div>
                  ) : null}
                  <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: C.inkSoft, lineHeight: 1.6 }}>
                    <div style={{ display: 'flex', gap: 10 }}><span style={{ color: C.primary, fontWeight: 700 }}>1</span>Open your phone camera and scan the code</div>
                    <div style={{ display: 'flex', gap: 10 }}><span style={{ color: C.primary, fontWeight: 700 }}>2</span>Complete ID scan, selfie and SMS steps there</div>
                    <div style={{ display: 'flex', gap: 10 }}><span style={{ color: C.primary, fontWeight: 700 }}>3</span>This page updates live — keep it open</div>
                  </div>
                  <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 18 }}>Session valid for 24 hours · heartbeats every 5 s while your phone works</div>
                </>
              )}
              <div style={{ flex: 1 }} />
              <Mono style={{ fontSize: 10.5, color: C.inkFaint }}>
                session {sessionId} · {sess === 'in_progress' ? `polls: ${hb} · live` : `status: ${sess}`}
              </Mono>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div style={{ minHeight: 520, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
            <div style={{ width: 74, height: 74, borderRadius: 26, background: C.okBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, color: C.okFg, fontWeight: 800, fontFamily: F.display }}>✓</div>
            <div style={{ ...h1(34), marginTop: 20 }}>Submission received</div>
            <div dir="rtl" style={arSub(20)}>تم استلام الطلب</div>
            <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 10 }}>
              Reference <Mono style={{ fontWeight: 600 }}>KYC-{(sessionId || '').slice(0, 4).toUpperCase()}-{(sessionId || '').slice(4, 8).toUpperCase()}</Mono> — under review, usually within 1 business day.
            </div>
            <button onClick={() => { setStep('hub'); setSess('pending'); }} style={{ ...btnGhost, marginTop: 26 }}>Start another verification</button>
          </div>
        )}
      </div>
    </div>
  );
}
