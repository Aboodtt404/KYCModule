import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { C, btnPrimary, h1, arSub, spinner } from '@/theme';
import { IconBadge } from '@/components/ui';
import { agentReady, kycActor, withRetry } from '@/lib/agent';
import VerifyFlow from '@/flow/VerifyFlow';

// QR-handoff target: validate the session, keep 5s heartbeats while the user works,
// and let VerifyFlow finish with complete_verification(sessionId, data).
export default function MobileVerify() {
  const { sessionId } = useParams();
  const [valid, setValid] = useState(null);
  const hbRef = useRef(null);
  const doneRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await agentReady;
        const ok = await withRetry(() => kycActor().verify_session(sessionId));
        if (cancelled) return;
        setValid(!!ok);
        if (ok) {
          const beat = () => kycActor().mark_verification_in_progress(sessionId).catch(() => {});
          beat();
          hbRef.current = setInterval(() => { if (!doneRef.current) beat(); }, 5000);
        }
      } catch {
        if (!cancelled) setValid(false);
      }
    })();
    return () => { cancelled = true; clearInterval(hbRef.current); };
  }, [sessionId]);

  if (valid === null) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.surface, gap: 18 }}>
        <div style={spinner()} />
        <div style={{ fontSize: 14, color: C.inkSoft }}>Loading verification…</div>
      </div>
    );
  }

  if (valid === false) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: C.surface, padding: '0 30px', textAlign: 'center' }}>
        <IconBadge bg={C.errBg} fg={C.errFg} size={74}>!</IconBadge>
        <div style={{ ...h1(30), marginTop: 20 }}>Session unavailable</div>
        <div dir="rtl" style={arSub()}>الجلسة غير متاحة</div>
        <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 14, lineHeight: 1.6 }}>
          This link may have expired (sessions last 24 hours) or was already used.
          Generate a fresh QR code on your desktop and scan it again.
        </div>
        <button onClick={() => window.location.reload()} style={{ ...btnPrimary, width: 'auto', marginTop: 26, padding: '14px 34px' }}>
          Retry · إعادة المحاولة
        </button>
      </div>
    );
  }

  return <VerifyFlow sessionId={sessionId} onCompleted={() => { doneRef.current = true; clearInterval(hbRef.current); }} />;
}
