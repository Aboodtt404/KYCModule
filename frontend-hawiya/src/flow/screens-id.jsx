import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { C, F, btnPrimary, btnGhost, h1, arSub, spinner } from '@/theme';
import { Card, CardFrame, IconBadge, Mono, Row, TitleAr, BusyScreen } from '@/components/ui';
import { detectFields } from '@/lib/ocr';
import { buzz, grabSmallBlob, hasTorch, setTorch } from '@/lib/camera';

const Pad = ({ children, style }) => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '22px 24px 30px', ...style }}>{children}</div>
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

export function Welcome({ begin }) {
  const steps = [
    ['Scan your national ID — front & back', 'امسح بطاقتك من الأمام والخلف'],
    ['Take a selfie with a short head turn', 'التقط صورة سيلفي مع حركة رأس بسيطة'],
    ['Confirm your phone by SMS code', 'أكد رقم هاتفك برسالة نصية']
  ];
  return (
    <Pad style={{ padding: '0 26px 30px' }}>
      <div style={{ paddingTop: 46 }}>
        <motion.div initial={{ scale: 0.5, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          style={{ width: 64, height: 64, borderRadius: 22, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.display, fontSize: 34, fontWeight: 800, color: C.surface }}>هـ</motion.div>
        <div style={{ ...h1(38), marginTop: 22 }}>Verify your<br />identity</div>
        <div dir="rtl" style={{ ...arSub(22), marginTop: 6 }}>تحقق من هويتك في دقائق</div>
      </div>
      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {steps.map(([en, ar], i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.12, duration: 0.4, ease: 'easeOut' }}
            style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 38, height: 38, borderRadius: 13, background: '#fff', boxShadow: '0 2px 8px rgba(61,44,34,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: C.primary, flex: 'none' }}>{i + 1}</div>
            <div style={{ fontSize: 13.5 }}>{en}<div dir="rtl" style={{ fontSize: 12, color: C.inkSoft }}>{ar}</div></div>
          </motion.div>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ fontSize: 11, lineHeight: 1.6, color: C.inkSoft, marginBottom: 14 }}>
        By continuing you consent to processing of your ID data for verification. Your consent is logged; you can request deletion at any time. Face images are never stored.
      </div>
      <button onClick={begin} style={btnPrimary}>Begin · ابدأ</button>
    </Pad>
  );
}

export function SvcDown({ begin, error }) {
  return (
    <Pad style={{ alignItems: 'center', justifyContent: 'center', padding: '0 30px 30px', textAlign: 'center' }}>
      <IconBadge bg={C.errBg} fg={C.errFg} size={74}>!</IconBadge>
      <div style={{ ...h1(30), marginTop: 20 }}>Verification is temporarily unavailable</div>
      <div dir="rtl" style={arSub()}>الخدمة غير متاحة مؤقتًا</div>
      <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 14, lineHeight: 1.6 }}>
        {error || "Our document reader isn't responding. Nothing was submitted — please try again in a few minutes."}
      </div>
      <button onClick={begin} style={{ ...btnPrimary, width: 'auto', marginTop: 26, background: C.cocoa, borderRadius: 14, padding: '14px 34px', fontSize: 14, boxShadow: 'none' }}>
        Try again · حاول مجددًا
      </button>
      <Mono style={{ fontSize: 10, color: C.inkFaint, marginTop: 18 }}>GET /health → unreachable</Mono>
    </Pad>
  );
}

export function CaptureScreen({ title, ar, caption, onShutter, videoRef, error, liveGuide = false, autoCapture = true }) {
  const [detect, setDetect] = useState(null);
  const [steady, setSteady] = useState(0);   // consecutive stable-card ticks
  const busyRef = useRef(false);
  const lastBoxRef = useRef(null);
  const steadyRef = useRef(0);
  const firedRef = useRef(false);
  const shutterRef = useRef(onShutter);
  shutterRef.current = onShutter;   // parent re-creates the handler each render

  // Live field labels + document-scanner auto-shutter: poll the detector with
  // downscaled viewfinder frames; when the card box is confidently detected and
  // STABLE for 3 consecutive ticks, capture automatically (grabSharpestBlob +
  // the server blur gate handle focus). Never overlaps requests.
  useEffect(() => {
    if (!liveGuide && !autoCapture) return undefined;
    firedRef.current = false;
    steadyRef.current = 0;
    const t = setInterval(async () => {
      const v = videoRef.current;
      if (!v || !v.videoWidth || busyRef.current || firedRef.current) return;
      busyRef.current = true;
      try {
        const blob = await grabSmallBlob(v);
        const res = await detectFields(blob, AbortSignal.timeout(3000));
        setDetect(res?.card ? res : null);
        const box = res?.card && (res.conf ?? 0) >= 0.55 ? res.card : null;
        const prev = lastBoxRef.current;
        lastBoxRef.current = box;
        const stable = box && prev &&
          Math.abs(box[0] - prev[0]) < 0.04 && Math.abs(box[1] - prev[1]) < 0.04 &&
          Math.abs(box[2] - prev[2]) < 0.10 && Math.abs(box[3] - prev[3]) < 0.10 &&
          box[2] > 0.4;                       // card fills a sane share of frame
        steadyRef.current = stable ? steadyRef.current + 1 : 0;
        setSteady(steadyRef.current);
        if (autoCapture && steadyRef.current >= 3 && !firedRef.current) {
          firedRef.current = true;
          buzz(40);
          shutterRef.current();
        }
      } catch { setDetect(null); steadyRef.current = 0; setSteady(0); }
      finally { busyRef.current = false; }
    }, 700);
    return () => clearInterval(t);
  }, [liveGuide, autoCapture, videoRef]);

  // Torch: capability appears only after the stream starts — probe on a timer.
  const [torchable, setTorchable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  useEffect(() => {
    setTorchOn(false);
    const t = setInterval(() => setTorchable(hasTorch(videoRef.current)), 1000);
    return () => clearInterval(t);
  }, [videoRef]);
  const toggleTorch = async () => {
    const next = !torchOn;
    if (await setTorch(videoRef.current, next)) setTorchOn(next);
  };

  const holdMsg = steady >= 3 ? 'Capturing… · جارٍ الالتقاط' : steady > 0 ? 'Hold still… · اثبت مكانك' : null;
  return (
    <Pad>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <div style={h1(28)}>{title}</div>
          <div dir="rtl" style={arSub(18)}>{ar}</div>
        </div>
        {torchable && (
          <button onClick={toggleTorch} aria-label="Toggle flashlight"
            style={{ border: `1.5px solid ${torchOn ? C.primary : C.line}`, background: torchOn ? C.warnBg : '#fff',
                     borderRadius: 12, width: 42, height: 42, fontSize: 19, cursor: 'pointer', flex: 'none' }}>
            🔦
          </button>
        )}
      </div>
      <ErrorNote error={error} />
      <CardFrame videoRef={videoRef} caption={holdMsg || caption} detect={detect} showZones={liveGuide} />
      <div style={{ position: 'relative', alignSelf: 'center', marginTop: 20 }}>
        <div style={{
          position: 'absolute', inset: -7, borderRadius: '50%', pointerEvents: 'none',
          background: `conic-gradient(${steady >= 3 ? C.okFg : C.accent} ${(Math.min(steady, 3) / 3) * 360}deg, transparent 0deg)`,
          opacity: steady > 0 ? 1 : 0, transition: 'opacity .25s ease',
          WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px))',
          mask: 'radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px))'
        }} />
        <button onClick={onShutter} aria-label="Capture" style={{
          width: 72, height: 72, borderRadius: '50%', background: '#fff', display: 'block',
          border: `5px solid ${steady >= 3 ? C.okFg : C.primary}`, cursor: 'pointer',
          transform: steady >= 3 ? 'scale(1.06)' : 'scale(1)',
          transition: 'border-color .3s ease, transform .3s ease',
          boxShadow: '0 6px 16px rgba(194,65,12,.3)'
        }} />
      </div>
    </Pad>
  );
}

// Field zones lighting up in reading order during the scan reveal. Stage 1
// lights the name/address zones one by one; stage 2 lights the NID row.
const REVEAL_ZONES = [
  { label: 'الاسم', box: [0.35, 0.24, 0.60, 0.13], atStage: 1, delay: 0 },
  { label: 'العائلة', box: [0.35, 0.38, 0.60, 0.13], atStage: 1, delay: 500 },
  { label: 'العنوان', box: [0.35, 0.52, 0.60, 0.20], atStage: 1, delay: 1000 },
  { label: 'الرقم القومي', box: [0.15, 0.75, 0.80, 0.17], atStage: 2, delay: 0 },
];

function ScanReveal({ shotUrl, stage }) {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 320, aspectRatio: '1.586', alignSelf: 'center', borderRadius: 16, overflow: 'hidden', background: C.dark, boxShadow: '0 10px 30px rgba(61,44,34,.25)' }}>
      <img src={shotUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(.55) saturate(.8)' }} />
      {/* sweeping light beam */}
      <div style={{ position: 'absolute', left: 0, right: 0, height: 46, top: 0, animation: 'scan 2.6s ease-in-out infinite',
        background: 'linear-gradient(180deg, transparent, rgba(245,166,35,.35) 45%, rgba(255,236,200,.55) 50%, rgba(245,166,35,.35) 55%, transparent)' }} />
      {REVEAL_ZONES.map((z) => {
        const on = stage >= z.atStage;
        return (
          <div key={z.label} style={{
            position: 'absolute', left: `${z.box[0] * 100}%`, top: `${z.box[1] * 100}%`,
            width: `${z.box[2] * 100}%`, height: `${z.box[3] * 100}%`,
            border: '1.5px solid rgba(123,191,126,.95)', borderRadius: 7,
            background: 'rgba(123,191,126,.14)',
            opacity: on ? 1 : 0, transform: on ? 'scale(1)' : 'scale(1.12)',
            transition: `opacity .5s ease ${z.delay}ms, transform .5s ease ${z.delay}ms`,
          }}>
            <span dir="rtl" style={{ position: 'absolute', top: -1, right: 5, fontSize: 9, fontWeight: 700, color: '#bfe8c1' }}>
              {z.label} {on ? '✓' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function FrontProcessing({ stage, healthOnly = false, shotUrl = null }) {
  const items = ['Detecting card & fields', 'Extracting Arabic text', 'Running integrity checks'];
  const mark = (i) => (stage > i ? '✓' : stage === i ? '●' : '○');
  const color = (i) => (stage > i ? C.okFg : stage === i ? C.primary : C.inkFaint);
  return (
    <BusyScreen en={healthOnly ? 'One moment…' : 'Reading your ID…'} ar={healthOnly ? 'لحظة من فضلك…' : 'جارٍ قراءة البطاقة…'}>
      {!healthOnly && shotUrl && (
        <div style={{ marginTop: 20, alignSelf: 'stretch', display: 'flex', flexDirection: 'column' }}>
          <ScanReveal shotUrl={shotUrl} stage={stage} />
        </div>
      )}
      {!healthOnly && (
        <>
          <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 12, alignSelf: 'stretch' }}>
            {items.map((label, i) => (
              <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'center', fontSize: 13, color: color(i) }}>
                <span style={{ width: 20, textAlign: 'center' }}>{mark(i)}</span>{label}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 26 }}>This usually takes 10–20 seconds</div>
        </>
      )}
    </BusyScreen>
  );
}

function reasonsFrom(front) {
  const checks = front?.verification?.checks;
  if (Array.isArray(checks)) {
    const bad = checks.filter((c) => c && c.passed === false && c.reason).map((c) => c.reason);
    if (bad.length) return bad;
  }
  return ["The national ID check digit doesn't add up — this usually means a digit was misread or the card is damaged."];
}

export function VerdictReject({ front, go }) {
  return (
    <Pad style={{ padding: '26px 26px 30px' }}>
      <IconBadge bg={C.errBg} fg={C.errFg}>✕</IconBadge>
      <TitleAr en="We couldn't verify this ID" ar="تعذّر التحقق من هذه البطاقة" />
      <Card style={{ marginTop: 18, padding: '16px 18px', borderRadius: 16 }}>
        <div style={{ fontSize: 11, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 }}>Why it failed</div>
        {reasonsFrom(front).map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: i ? 8 : 10 }}>
            <span style={{ color: C.errFg, fontWeight: 700 }}>·</span>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>{r}</div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 8 }}>
          <span style={{ color: C.errFg, fontWeight: 700 }}>·</span>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>Try brighter, even lighting and hold the card flat.</div>
        </div>
      </Card>
      <div style={{ marginTop: 14, background: C.warnBg, borderRadius: 14, padding: '12px 16px', fontSize: 12, color: C.warnFg, lineHeight: 1.5 }}>
        <b>Nothing was saved.</b> A rejected scan is never stored or submitted.
      </div>
      <div style={{ flex: 1 }} />
      <button onClick={() => go('front-cap')} style={btnPrimary}>Scan again · إعادة المسح</button>
    </Pad>
  );
}

const spaceNid = (nid) => (nid || '').replace(/^(\d)(\d{2})(\d{2})(\d{2})(\d{7})$/, '$1 $2 $3 $4 $5');

function IdSummaryCard({ front, nidColor }) {
  return (
    <Card style={{ marginTop: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: `1px solid ${C.line}` }}>
        {front?.face_image
          ? <img src={`data:image/jpeg;base64,${front.face_image}`} alt="" style={{ width: 44, height: 44, borderRadius: 13, objectFit: 'cover' }} />
          : <div style={{ width: 44, height: 44, background: C.shell, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkFaint, fontSize: 10 }}>صورة</div>}
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600 }}>{front?.first_name || front?.full_name || '—'}</div>
          <div dir="rtl" style={{ fontSize: 13.5, color: C.inkSoft }}>{front?.full_name || ''}</div>
        </div>
      </div>
      <Row label="الرقم القومي" last
        value={<Mono style={{ fontSize: 13, fontWeight: 600, color: nidColor }}>{spaceNid(front?.national_id)}</Mono>} />
    </Card>
  );
}

export function VerdictAccept({ front, go }) {
  return (
    <Pad style={{ padding: '26px 26px 30px' }}>
      <IconBadge bg={C.okBg} fg={C.okFg}>✓</IconBadge>
      <TitleAr en="ID verified" ar="تم التحقق من البطاقة" />
      <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 10, lineHeight: 1.6 }}>
        Every field was independently corroborated — no confirmation needed.
      </div>
      <IdSummaryCard front={front} nidColor={C.okFg} />
      <div style={{ flex: 1 }} />
      <button onClick={() => go('back-cap')} style={btnPrimary}>Continue · متابعة</button>
    </Pad>
  );
}

export function VerdictAbstain({ front, addr, setAddr, go }) {
  const [editing, setEditing] = useState(false);
  return (
    <Pad style={{ padding: '20px 24px 28px' }}>
      <div style={h1(29)}>Almost there — check your details</div>
      <div dir="rtl" style={arSub(18)}>راجع بياناتك قبل المتابعة</div>
      <div style={{ marginTop: 12, background: C.warnBg, borderRadius: 16, padding: '13px 15px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 32, height: 32, borderRadius: 11, background: C.warnChip, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontSize: 15, fontWeight: 800, color: C.warnFg, fontFamily: F.display }}>!</div>
        <div style={{ fontSize: 12, lineHeight: 1.5, color: C.warnFg }}>
          <b>One quick check.</b> The ID passed its integrity checks, but we couldn't corroborate every field — confirm or fix them below.
        </div>
      </div>
      <Card style={{ marginTop: 13, padding: '4px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: `1px solid ${C.line}` }}>
          {front?.face_image
            ? <img src={`data:image/jpeg;base64,${front.face_image}`} alt="" style={{ width: 44, height: 44, borderRadius: 13, objectFit: 'cover' }} />
            : <div style={{ width: 44, height: 44, background: C.shell, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkFaint, fontSize: 10 }}>صورة</div>}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>{front?.first_name || '—'}</div>
            <div dir="rtl" style={{ fontSize: 13.5, color: C.inkSoft }}>{front?.full_name || ''}</div>
          </div>
        </div>
        <Row label="الرقم القومي"
          value={<Mono style={{ fontSize: 13, fontWeight: 600, color: C.primary }}>{spaceNid(front?.national_id)}</Mono>} />
        <Row label="Birth date · الميلاد" value={front?.birth_date || '—'} />
        {editing ? (
          <div style={{ padding: '10px 18px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={addr} onChange={(e) => setAddr(e.target.value)} dir="rtl"
              style={{ flex: 1, border: `1.5px solid ${C.primary}`, borderRadius: 10, padding: '9px 12px', fontSize: 13, background: '#fff7ef', outline: 'none', color: C.ink }} />
            <button onClick={() => setEditing(false)}
              style={{ border: 'none', background: C.primary, color: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: F.body }}>Save</button>
          </div>
        ) : (
          <Row label="العنوان" last value={
            <span dir="rtl" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              {addr || '—'}
              <button dir="ltr" onClick={() => setEditing(true)}
                style={{ border: 'none', background: 'none', fontSize: 11.5, color: C.primary, fontWeight: 600, cursor: 'pointer', fontFamily: F.body, padding: 0 }}>تعديل</button>
            </span>
          } />
        )}
      </Card>
      <div style={{ flex: 1 }} />
      <button onClick={() => go('back-cap')} style={{ ...btnPrimary, padding: 16 }}>Yes, that's me · نعم، هذا أنا</button>
      <button onClick={() => go('front-cap')} style={{ ...btnGhost, marginTop: 10 }}>Scan again · المسح من جديد</button>
    </Pad>
  );
}

export function BackProcessing() {
  return (
    <BusyScreen en="Checking both sides match…" ar="جارٍ مطابقة الوجهين…">
      <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 22 }}>Usually ~5 seconds · عادةً ٥ ثوانٍ تقريبًا</div>
    </BusyScreen>
  );
}

export function BackReview({ front, back, go }) {
  const frontNid = (front?.national_id || '').replace(/\D/g, '');
  const backNid = (back?.national_id || '').replace(/\D/g, '');
  const matched = frontNid && backNid && frontNid === backNid;
  const rows = [
    ['المهنة · Occupation', back?.occupation],
    ['الحالة الاجتماعية · Marital', back?.marital_status],
    ['Issue date', back?.issue_date],
    ['Valid until', back?.expiry_date],
  ].filter(([, v]) => v);
  return (
    <Pad style={{ padding: '26px 26px 30px' }}>
      <IconBadge bg={C.okBg} fg={C.okFg}>✓</IconBadge>
      <TitleAr en="Back of ID read" ar="تمت قراءة ظهر البطاقة" size={29} />
      {matched ? (
        <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', background: C.okBg, borderRadius: 14, padding: '11px 15px', animation: 'stamp .5s ease .35s both' }}>
          <span style={{ fontSize: 16, color: C.okFg }}>⇄</span>
          <div style={{ fontSize: 12.5, color: C.okFg, lineHeight: 1.5 }}>
            <b>Front and back match.</b> The national ID number on both sides is identical — a strong integrity signal.
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 14, background: C.shell, borderRadius: 14, padding: '11px 15px', fontSize: 12, color: C.inkSoft, lineHeight: 1.5 }}>
          The number on the back couldn't be read clearly — your submission will simply be checked manually. Nothing to fix.
        </div>
      )}
      {rows.length > 0 && (
        <Card style={{ marginTop: 14, padding: '4px 0', animation: 'flipIn .5s ease both' }}>
          {rows.map(([label, v], i) => (
            <Row key={label} label={label} last={i === rows.length - 1}
              value={<span dir="rtl">{v}</span>} />
          ))}
        </Card>
      )}
      <div style={{ flex: 1 }} />
      <button onClick={() => go('selfie-intro')} style={btnPrimary}>Continue · متابعة</button>
    </Pad>
  );
}

export function BackMismatch({ front, back, go }) {
  return (
    <Pad style={{ padding: '26px 26px 30px' }}>
      <IconBadge bg={C.warnBg} fg={C.warnFg}>≠</IconBadge>
      <TitleAr en="The back doesn't match the front" ar="الوجه الخلفي لا يطابق الأمامي" size={29} />
      <Card style={{ marginTop: 18, padding: '6px 0', borderRadius: 16 }}>
        <Row label="Front · الأمام" value={<Mono style={{ fontSize: 13, fontWeight: 600 }}>{front?.national_id || '—'}</Mono>} />
        <Row label="Back · الخلف" last value={<Mono style={{ fontSize: 13, fontWeight: 600, color: C.errFg }}>{back?.national_id || '—'}</Mono>} />
      </Card>
      <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 14, lineHeight: 1.6 }}>
        Make sure you're scanning the back of the <b>same card</b>, then try again.
      </div>
      <div style={{ flex: 1 }} />
      <button onClick={() => go('back-cap')} style={btnPrimary}>Re-scan the back · إعادة مسح الخلف</button>
    </Pad>
  );
}
