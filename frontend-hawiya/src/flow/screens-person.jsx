import React, { useState } from 'react';
import { C, F, btnPrimary, btnGhost, h1, arSub } from '@/theme';
import { BusyScreen, Card, IconBadge, Mono, Row, TitleAr } from '@/components/ui';

const Pad = ({ children, style }) => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '26px 26px 30px', ...style }}>{children}</div>
);

const ErrorNote = ({ error }) => {
  if (!error) return null;
  const msg = typeof error === 'string' ? error : error.msg;
  const detail = typeof error === 'string' ? '' : error.detail;
  return (
    <div style={{ marginTop: 12, background: C.errBg, borderRadius: 12, padding: '10px 14px', fontSize: 12.5, color: C.errFg }}>
      {msg}
      {detail ? <div style={{ marginTop: 5, fontSize: 9.5, opacity: 0.6, fontFamily: 'monospace' }}>{detail}</div> : null}
    </div>
  );
};

export function SelfieIntro({ startSelfie, error }) {
  const tips = [
    ['☀', 'Find even light, remove glasses & hats'],
    ['↺', "You'll slowly turn your head — this proves you're really there"],
    ['🔒', 'Compared to your ID photo, then discarded — never stored']
  ];
  return (
    <Pad>
      <div style={{ alignSelf: 'center', width: 120, height: 120, borderRadius: '50%', border: `3px dashed ${C.primary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 14 }}>
        <div style={{ width: 92, height: 92, borderRadius: '50%', background: C.shell, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkFaint, fontSize: 11 }}>selfie</div>
      </div>
      <div style={{ ...h1(29), marginTop: 22, textAlign: 'center' }}>Take a quick selfie</div>
      <div dir="rtl" style={{ ...arSub(18), textAlign: 'center' }}>التقط صورة سيلفي سريعة</div>
      <ErrorNote error={error} />
      <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {tips.map(([icon, text], i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#fff', borderRadius: 14, padding: '12px 16px', boxShadow: '0 2px 8px rgba(61,44,34,.05)' }}>
            <span style={{ fontSize: 16 }}>{icon}</span><span style={{ fontSize: 13 }}>{text}</span>
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <button onClick={startSelfie} style={btnPrimary}>I'm ready · أنا مستعد</button>
    </Pad>
  );
}

const PROMPTS = [
  ['Look straight ahead', 'انظر للأمام مباشرة'],
  ['Slowly turn left…', 'أدر رأسك يسارًا ببطء…'],
  ['Now turn right…', 'الآن إلى اليمين…'],
  ['Almost done…', 'أوشكنا على الانتهاء…'],
  ['Perfect!', 'ممتاز!']
];

// Language-free motion guide: a head glyph that tilts the way we're asking.
const HEAD_TILT = [0, 0, -24, 24, 0];   // deg per framesDone (index = frames captured)

function HeadGuide({ framesDone }) {
  const deg = HEAD_TILT[Math.min(framesDone, 4)];
  return (
    <div style={{ position: 'absolute', left: '50%', bottom: 54, transform: 'translateX(-50%)', width: 44, height: 44,
      borderRadius: 14, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 24, display: 'inline-block', transition: 'transform .9s cubic-bezier(.45,0,.25,1)',
        transform: `perspective(80px) rotateY(${deg}deg)` }}>🙂</span>
    </div>
  );
}

export function SelfieCapture({ videoRef, framesDone }) {
  const [en, ar] = PROMPTS[Math.min(framesDone, 4)];
  return (
    <Pad style={{ padding: '22px 24px 30px' }}>
      <div style={{ marginTop: 4, flex: 1, background: C.dark, borderRadius: 20, position: 'relative', overflow: 'hidden', minHeight: 420 }}>
        <video ref={videoRef} autoPlay playsInline muted
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%,rgba(245,166,35,.12),transparent 60%)' }} />
        <div style={{ position: 'absolute', left: '50%', top: '44%', transform: 'translate(-50%,-50%)', width: 210, height: 270, borderRadius: '50%',
          border: `3px solid ${framesDone >= 4 ? '#7bbf7e' : C.accent}`,
          boxShadow: framesDone > 0 ? `0 0 0 5px rgba(123,191,126,${0.12 + framesDone * 0.12})` : 'none',
          transition: 'box-shadow .6s ease, border-color .6s ease' }} />
        <HeadGuide framesDone={framesDone} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: '9%', textAlign: 'center', fontFamily: F.display, fontSize: 23, fontWeight: 700, color: C.surface }}>{en}</div>
        <div dir="rtl" style={{ position: 'absolute', left: 0, right: 0, top: '16%', textAlign: 'center', fontSize: 14, color: '#d8c7b2' }}>{ar}</div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 20, display: 'flex', justifyContent: 'center', gap: 9 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: framesDone >= i ? C.accent : 'rgba(250,243,234,.25)' }} />
          ))}
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 12, color: C.inkSoft, paddingTop: 16 }}>
        Capturing {framesDone} of 4 movement frames · liveness check
      </div>
    </Pad>
  );
}

export function FaceProcessing() {
  return (
    <BusyScreen en="Matching you to your ID…" ar="جارٍ المطابقة مع صورة البطاقة…">
      <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 22 }}>Usually ~10 seconds · عادةً ١٠ ثوانٍ تقريبًا</div>
    </BusyScreen>
  );
}

const LIVENESS_COPY = {
  no_motion: {
    title: 'We need to see you move', ar: 'لم نرصد حركة كافية',
    body: 'The photo matched your ID, but the movement frames looked static',
    code: 'no_motion',
    tip: <>This time: turn your head <b>slowly and fully</b> from one side to the other while the dots fill.</>
  },
  identity_changed: {
    title: 'Same person, please', ar: 'يجب أن يبقى نفس الشخص',
    body: 'A different face appeared during the movement check',
    code: 'identity_changed',
    tip: <>Make sure <b>only you</b> are in frame for the whole check.</>
  },
  low_sharpness: {
    title: "The image was too blurry", ar: 'الصورة غير واضحة',
    body: 'The selfie was not sharp enough to trust',
    code: 'low_sharpness',
    tip: <>Find brighter light, clean the lens, and hold the phone still.</>
  },
  no_match: {
    title: "That doesn't look like your ID photo", ar: 'الوجه لا يطابق صورة البطاقة',
    body: 'The selfie did not match the photo on the ID closely enough',
    code: 'below_threshold',
    tip: <>Remove glasses/hats, face the camera straight on, and use even lighting.</>
  },
  no_face: {
    title: "We couldn't find a face", ar: 'لم نتمكن من رصد وجه',
    body: 'No face was detected in the selfie or movement frames',
    code: 'ERR_NO_FACE',
    tip: <>Keep your whole face inside the oval, in good light.</>
  },
  server: {
    title: 'Something went wrong', ar: 'حدث خطأ ما',
    body: 'The verification service had a hiccup — nothing was saved',
    code: 'ERR_SERVER',
    tip: <>Please try again in a moment.</>
  }
};

export function LivenessFail({ livenessReason, startSelfie, faceResult }) {
  const copy = LIVENESS_COPY[livenessReason] || LIVENESS_COPY.no_motion;
  const score = faceResult?.similarity_score;
  const threshold = faceResult?.threshold ?? 50;
  const showScore = livenessReason === 'no_match' && typeof score === 'number';
  return (
    <Pad>
      <IconBadge bg={C.warnBg} fg={C.warnFg}>↺</IconBadge>
      <TitleAr en={copy.title} ar={copy.ar} size={29} />
      <Card style={{ marginTop: 16, padding: '16px 18px', borderRadius: 16 }}>
        <div style={{ fontSize: 11, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 }}>What happened</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
          {copy.body} <Mono style={{ fontSize: 11, color: C.inkFaint }}>({copy.code})</Mono>. This protects you from someone using a printed photo.
        </div>
        {showScore && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.inkSoft, marginTop: 14 }}>
              <span>How close you got</span>
              <Mono style={{ fontWeight: 600, color: C.warnFg }}>{score.toFixed(1)} — needs {threshold}</Mono>
            </div>
            <div style={{ position: 'relative', height: 8, background: C.line, borderRadius: 99, marginTop: 8 }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(score, 100)}%`, background: C.warnFg, borderRadius: 99 }} />
              <div style={{ position: 'absolute', left: `${threshold}%`, top: -4, bottom: -4, width: 2, background: C.primary }} />
            </div>
          </>
        )}
      </Card>
      <div style={{ marginTop: 14, fontSize: 13, color: C.inkSoft, lineHeight: 1.7 }}>{copy.tip}</div>
      <div style={{ flex: 1 }} />
      <button onClick={startSelfie} style={btnPrimary}>Try again · حاول مجددًا</button>
    </Pad>
  );
}

export function FaceOk({ faceResult, go }) {
  const score = faceResult?.similarity_score ?? 0;
  const threshold = faceResult?.threshold ?? 50;
  return (
    <Pad>
      <IconBadge bg={C.okBg} fg={C.okFg}>✓</IconBadge>
      <TitleAr en="It's really you" ar="تم التحقق من وجهك" />
      <Card style={{ marginTop: 18, padding: 18, borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.inkSoft }}>
          <span>Face match</span>
          <Mono style={{ fontWeight: 600, color: C.okFg }}>{score.toFixed(1)} / 100</Mono>
        </div>
        <div style={{ position: 'relative', height: 8, background: C.line, borderRadius: 99, marginTop: 10 }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(score, 100)}%`, background: C.okFg, borderRadius: 99 }} />
          <div style={{ position: 'absolute', left: `${threshold}%`, top: -4, bottom: -4, width: 2, background: C.primary }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: C.inkFaint, marginTop: 6 }}>
          <span>0</span><span style={{ color: C.primary }}>threshold {threshold}</span><span>100</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.inkSoft, marginTop: 14 }}>
          <span>Liveness</span>
          <span style={{ fontWeight: 600, color: C.okFg }}>
            {faceResult?.liveness_mode === 'active' ? 'Active — motion confirmed' : 'Passive — sharpness ok'}
          </span>
        </div>
        <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 12, lineHeight: 1.5 }}>
          Your selfie and movement frames have been discarded.
        </div>
      </Card>
      <div style={{ flex: 1 }} />
      <button onClick={() => go('phone')} style={btnPrimary}>Continue · متابعة</button>
    </Pad>
  );
}

export function PhoneScreen({ phone, setPhone, sendOtp, skipPhone, error }) {
  return (
    <Pad>
      <div style={h1(29)}>Confirm your phone</div>
      <div dir="rtl" style={arSub(18)}>أكد رقم هاتفك</div>
      <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 12, lineHeight: 1.6 }}>
        We'll text you a 6-digit code. Standard SMS rates may apply.
      </div>
      <ErrorNote error={error} />
      <div style={{ marginTop: 20, background: '#fff', borderRadius: 16, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 10px rgba(61,44,34,.06)' }}>
        <span style={{ fontSize: 14, fontWeight: 600, padding: '10px 12px 10px 12px', color: C.inkSoft, borderRight: `1px solid ${C.line}` }}>🇪🇬 +20</span>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="100 123 4567"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, fontFamily: F.mono, padding: '10px 4px', background: 'none', color: C.ink }} />
      </div>
      <div style={{ flex: 1 }} />
      <button onClick={sendOtp} disabled={phone.replace(/\D/g, '').length < 9}
        style={{ ...btnPrimary, opacity: phone.replace(/\D/g, '').length < 9 ? 0.5 : 1 }}>
        Send code · أرسل الرمز
      </button>
      <button onClick={skipPhone} style={{ ...btnGhost, marginTop: 10 }}>
        Skip for now · تخطَّ الآن
      </button>
    </Pad>
  );
}

export function OtpScreen({ phone, sendOtp, submitOtp, otpError, setOtpError }) {
  const [otp, setOtp] = useState('');
  const tap = (k) => {
    if (k === '⌫') { setOtp((o) => o.slice(0, -1)); setOtpError(false); return; }
    if (k === '' || otp.length >= 6) return;
    const next = otp + k;
    setOtp(next);
    if (next.length === 6) setTimeout(() => { submitOtp(next); setOtp(''); }, 350);
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return (
    <Pad style={{ paddingBottom: 26 }}>
      <div style={h1(29)}>Enter the code</div>
      <div dir="rtl" style={arSub(18)}>أدخل الرمز المرسل</div>
      <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 8 }}>
        Sent to <Mono>+20 {phone}</Mono> ·{' '}
        <button onClick={sendOtp} style={{ ...btnGhost, color: C.primary, fontWeight: 600, padding: 0 }}>Resend</button>
      </div>
      <div style={{ display: 'flex', gap: 9, justifyContent: 'center', marginTop: 22, animation: otpError ? 'shake .35s' : 'none' }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{
            width: 46, height: 56, background: '#fff', borderRadius: 14,
            border: `2px solid ${otpError ? C.errFg : otp.length === i ? C.primary : C.lineStrong}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: F.mono, fontSize: 22, fontWeight: 600
          }}>{otp[i] || ''}</div>
        ))}
      </div>
      {otpError && (
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12.5, color: C.errFg, fontWeight: 500 }}>
          That code didn't match — try again · الرمز غير صحيح
        </div>
      )}
      <div style={{ flex: 1 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9 }}>
        {keys.map((k, i) => (
          <button key={i} onClick={() => tap(k)} style={{
            border: 'none', background: k === '' ? 'transparent' : k === '⌫' ? C.shell : '#fff',
            borderRadius: 14, padding: 15, fontSize: 19, fontWeight: 600, fontFamily: F.mono,
            cursor: k === '' ? 'default' : 'pointer', color: C.ink
          }}>{k}</button>
        ))}
      </div>
    </Pad>
  );
}

export function DuplicateScreen({ front, go }) {
  const nid = front?.national_id || '';
  return (
    <Pad>
      <IconBadge bg={C.warnBg} fg={C.warnFg}>⧉</IconBadge>
      <TitleAr en="This ID is already registered" ar="هذه البطاقة مسجلة بالفعل" size={29} />
      <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 14, lineHeight: 1.7 }}>
        A verification for national ID <Mono style={{ fontSize: 12 }}>{nid.slice(0, 7)}…{nid.slice(-4)}</Mono> already exists.
        You can check its status instead of submitting again.
      </div>
      <div style={{ flex: 1 }} />
      <button onClick={() => go('status')} style={btnPrimary}>Check my status · تحقق من الحالة</button>
      <button onClick={() => window.location.reload()} style={{ ...btnGhost, marginTop: 10 }}>Start over · البدء من جديد</button>
    </Pad>
  );
}

const editInput = {
  width: '100%', border: `1.5px solid ${C.line}`, borderRadius: 10, padding: '9px 12px',
  fontSize: 14, fontFamily: 'inherit', background: '#fff', outline: 'none'
};

export function ReviewScreen({ front, back, addr, setAddr, phone, phoneVerified, submitKyc, error, fixes, setFixes }) {
  const [editing, setEditing] = useState(false);
  const fix = (k, fallback) => fixes?.[k] ?? fallback;
  const setFix = (k) => (e) => setFixes((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Pad style={{ padding: '20px 24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={h1(29)}>Review & submit</div>
        <button onClick={() => setEditing((v) => !v)}
          style={{ border: 'none', background: 'none', color: C.primary, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {editing ? 'Done · تم' : 'Edit · تعديل'}
        </button>
      </div>
      <div dir="rtl" style={arSub(18)}>راجع ثم أرسل</div>
      <ErrorNote error={error} />
      <Card style={{ marginTop: 14, padding: '4px 0' }}>
        <Row label="Name" value={editing
          ? <input dir="rtl" style={editInput} value={fix('full_name', front?.full_name || '')} onChange={setFix('full_name')} />
          : <span dir="rtl" style={{ fontWeight: 600 }}>{fix('full_name', front?.full_name) || '—'}</span>} />
        <Row label="الرقم القومي" value={<Mono style={{ fontSize: 13, fontWeight: 600 }}>{front?.national_id || '—'}</Mono>} />
        <Row label="Birth · Gender" value={`${front?.birth_date || '—'} · ${front?.gender || '—'}`} />
        <Row label="العنوان" value={editing
          ? <input dir="rtl" style={editInput} value={addr} onChange={(e) => setAddr(e.target.value)} />
          : <span dir="rtl">{addr || '—'}</span>} />
        {(back?.occupation || editing) ? <Row label="Occupation" value={editing
          ? <input dir="rtl" style={editInput} value={fix('occupation', back?.occupation || '')} onChange={setFix('occupation')} />
          : <span dir="rtl">{fix('occupation', back?.occupation)}</span>} /> : null}
        <Row label="Phone" value={phoneVerified
          ? <span style={{ color: C.okFg }}>+20 {phone} ✓</span>
          : <span style={{ color: C.warnFg }}>Skipped — verify later</span>} />
        <Row label="Face check" last value={<span style={{ color: C.okFg }}>Matched, live ✓</span>} />
      </Card>
      <div style={{ marginTop: 12, background: C.shell, borderRadius: 14, padding: '12px 16px', fontSize: 11.5, color: '#7a6752', lineHeight: 1.6 }}>
        🔒 Your face images are <b>not</b> included in this submission — only the verification result is stored.
      </div>
      <div style={{ flex: 1 }} />
      <button onClick={submitKyc} style={btnPrimary}>Submit · إرسال</button>
    </Pad>
  );
}

export function Submitting() {
  return (
    <BusyScreen en="Submitting securely…" ar="جارٍ الإرسال بأمان…">
      <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 22 }}>Just a few seconds · ثوانٍ قليلة</div>
    </BusyScreen>
  );
}

export function StatusScreen({ reference, sessionId }) {
  return (
    <Pad style={{ padding: '36px 26px 30px' }}>
      <div style={{ alignSelf: 'center' }}>
        <IconBadge bg={C.okBg} fg={C.okFg} size={74}>✓</IconBadge>
      </div>
      <div style={{ ...h1(32), marginTop: 20, textAlign: 'center' }}>You're all set</div>
      <div dir="rtl" style={{ ...arSub(19), textAlign: 'center' }}>تم استلام طلبك</div>
      {sessionId && (
        <div style={{ textAlign: 'center', fontSize: 13, color: C.inkSoft, marginTop: 10 }}>
          Your desktop has been updated — you can return to it now.
        </div>
      )}
      <Card style={{ marginTop: 22, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: C.inkSoft }}>Reference</span>
          <Mono style={{ fontSize: 12.5, fontWeight: 600 }}>{reference || '—'}</Mono>
        </div>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column' }}>
          <TimelineItem done title="Submitted" sub="Just now — identity checks passed" />
          <TimelineItem active title="Under review" sub="Usually within 1 business day" />
          <TimelineItem title="Decision" sub="We'll text you the result" last />
        </div>
      </Card>
      <div style={{ flex: 1 }} />
    </Pad>
  );
}

function TimelineItem({ done, active, title, sub, last }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%', flex: 'none',
          background: done ? C.okFg : active ? C.warnChip : C.line,
          color: done ? '#fff' : C.warnFg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: done ? 12 : 11, animation: active ? 'pulse 2s infinite' : 'none'
        }}>{done ? '✓' : active ? '●' : ''}</div>
        {!last && <div style={{ width: 2, flex: 1, background: done ? C.okBg : C.line }} />}
      </div>
      <div style={{ paddingBottom: last ? 0 : 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: done || active ? C.ink : C.inkFaint }}>{title}</div>
        <div style={{ fontSize: 11.5, color: done || active ? C.inkSoft : C.inkFaint }}>{sub}</div>
      </div>
    </div>
  );
}
