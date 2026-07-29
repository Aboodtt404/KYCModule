import React from 'react';
import { C, F, cardStyle, h1, arSub, spinner } from '@/theme';

// Brand wordmark
export const Wordmark = ({ size = 22, onDark = false }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.42) }}>
    <img src={onDark ? '/brand/hawiya-mark-dark.svg' : '/brand/hawiya-mark.svg'} alt=""
      style={{ width: Math.round(size * 1.15), height: Math.round(size * 1.15), display: 'block' }} />
    <div style={{ fontFamily: F.display, fontSize: size, fontWeight: 800, lineHeight: 1, color: C.primary }}>
      hawiya <span style={{ fontWeight: 400, color: onDark ? C.surface : C.ink }}>· هوية</span>
    </div>
  </div>
);

// 5-dot phase progress (welcome→ID→back→face→phone→submit)
export const StepDots = ({ phase }) => (
  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} style={{
        width: 8, height: 8, borderRadius: '50%',
        background: i < phase ? C.primary : i === phase ? C.accent : '#e7d8c7'
      }} />
    ))}
  </div>
);

// Rounded verdict / status icon block
export const IconBadge = ({ children, bg, fg, size = 64 }) => (
  <div style={{
    width: size, height: size, borderRadius: Math.round(size * 0.34), background: bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: Math.round(size * 0.47), color: fg, fontWeight: 800, fontFamily: F.display
  }}>{children}</div>
);

export const TitleAr = ({ en, ar, size = 30, arSize, center = false }) => (
  <div style={center ? { textAlign: 'center' } : undefined}>
    <div style={{ ...h1(size), marginTop: 18 }}>{en}</div>
    <div dir="rtl" style={arSub(arSize || Math.round(size * 0.63))}>{ar}</div>
  </div>
);

export const Card = ({ style, children }) => (
  <div style={{ ...cardStyle, ...style }}>{children}</div>
);

export const Row = ({ label, value, last = false, valueStyle }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '11px 18px', borderBottom: last ? 'none' : `1px solid ${C.line}`
  }}>
    <span style={{ fontSize: 12, color: C.inkSoft }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 500, ...valueStyle }}>{value}</span>
  </div>
);

export const Mono = ({ children, style }) => (
  <span style={{ fontFamily: F.mono, ...style }}>{children}</span>
);

export const Chip = ({ children, fg, bg }) => (
  <span style={{
    fontSize: 11, fontWeight: 600, color: fg, background: bg,
    padding: '3px 10px', borderRadius: 99, alignSelf: 'center'
  }}>{children}</span>
);

export const BusyScreen = ({ en, ar, children }) => (
  <div style={{
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '0 34px 40px'
  }}>
    <div style={spinner()} />
    <div style={{ ...h1(26), marginTop: 24, textAlign: 'center' }}>{en}</div>
    <div dir="rtl" style={arSub(17)}>{ar}</div>
    {children}
  </div>
);

// Static field zones for the Egyptian NID front — fractions of the CARD GUIDE frame.
// The layout is fixed, so labels can be drawn before any detection arrives.
const FRONT_ZONES = [
  { key: 'photo', en: 'photo', ar: 'الصورة', box: [0.03, 0.22, 0.28, 0.55] },
  { key: 'firstName', en: 'First name', ar: 'الاسم الأول', box: [0.35, 0.24, 0.62, 0.13] },
  { key: 'lastName', en: 'Family name', ar: 'اسم العائلة', box: [0.35, 0.38, 0.62, 0.13] },
  { key: 'address', en: 'Address', ar: 'العنوان', box: [0.35, 0.52, 0.62, 0.2] },
  { key: 'nid', en: 'National ID', ar: 'الرقم القومي', box: [0.15, 0.78, 0.82, 0.15] }
];

const FIELD_LABELS = {
  firstName: ['First name', 'الاسم الأول'],
  lastName: ['Family name', 'اسم العائلة'],
  address: ['Address', 'العنوان'],
  nid: ['National ID', 'الرقم القومي']
};

// Camera viewport with amber corner frame + scanline (ID capture).
// `detect` (optional): {card, fields} with boxes normalized to the video frame —
// when the card is found, field labels snap onto the DETECTED positions and the
// frame locks green; otherwise faint static zones show where each field belongs.
export const CardFrame = ({ videoRef, caption, detect = null, showZones = false }) => {
  const locked = !!detect?.card;
  const frameColor = locked ? '#7bbf7e' : C.accent;
  const corner = (pos) => ({
    position: 'absolute', width: 26, height: 26, transition: 'border-color .3s',
    ...(pos.includes('l') ? { left: -2, borderLeft: `3px solid ${frameColor}` } : { right: -2, borderRight: `3px solid ${frameColor}` }),
    ...(pos.includes('t') ? { top: -2, borderTop: `3px solid ${frameColor}` } : { bottom: -2, borderBottom: `3px solid ${frameColor}` }),
    borderRadius: pos === 'lt' ? '8px 0 0 0' : pos === 'rt' ? '0 8px 0 0' : pos === 'lb' ? '0 0 0 8px' : '0 0 8px 0'
  });

  // Map a box normalized to the raw video frame onto the cover-cropped <video> element.
  const mapBox = (box) => {
    const v = videoRef?.current;
    if (!v || !v.videoWidth) return null;
    const ew = v.clientWidth, eh = v.clientHeight;
    const scale = Math.max(ew / v.videoWidth, eh / v.videoHeight);
    const ox = (v.videoWidth * scale - ew) / 2;
    const oy = (v.videoHeight * scale - eh) / 2;
    const [x, y, w, h] = box;
    return {
      left: x * v.videoWidth * scale - ox,
      top: y * v.videoHeight * scale - oy,
      width: w * v.videoWidth * scale,
      height: h * v.videoHeight * scale
    };
  };

  const liveLabel = (f) => {
    const pos = mapBox(f.box);
    if (!pos) return null;
    const [en, ar] = FIELD_LABELS[f.name] || [f.name, ''];
    return (
      <div key={f.name} style={{
        position: 'absolute', ...pos, border: '1.5px solid rgba(123,191,126,.9)',
        borderRadius: 6, transition: 'all .35s ease', pointerEvents: 'none'
      }}>
        <span style={{
          position: 'absolute', top: -18, right: 0, whiteSpace: 'nowrap',
          fontSize: 10, fontWeight: 600, color: '#eafbe7', background: 'rgba(22,101,52,.85)',
          padding: '2px 7px', borderRadius: 6
        }}>{ar} · {en}</span>
      </div>
    );
  };

  return (
    <div style={{ marginTop: 16, flex: 1, background: C.dark, borderRadius: 20, position: 'relative', overflow: 'hidden', minHeight: 330 }}>
      <video ref={videoRef} autoPlay playsInline muted
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 45%,rgba(245,166,35,.10),transparent 65%)' }} />
      <div style={{ position: 'absolute', left: '9%', right: '9%', top: '50%', transform: 'translateY(-50%)', aspectRatio: '1.586', borderRadius: 12 }}>
        <div style={corner('lt')} /><div style={corner('rt')} /><div style={corner('lb')} /><div style={corner('rb')} />
        {!locked && (
          <div style={{ position: 'absolute', left: '6%', right: '6%', height: 2, background: 'linear-gradient(90deg,transparent,#f5a623,transparent)', animation: 'scan 3s ease-in-out infinite' }} />
        )}
        {showZones && !locked && FRONT_ZONES.map((z) => (
          <div key={z.key} style={{
            position: 'absolute',
            left: `${z.box[0] * 100}%`, top: `${z.box[1] * 100}%`,
            width: `${z.box[2] * 100}%`, height: `${z.box[3] * 100}%`,
            border: '1px dashed rgba(245,166,35,.45)', borderRadius: 6,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
            pointerEvents: 'none'
          }}>
            <span style={{ fontSize: 9, color: 'rgba(250,243,234,.75)', background: 'rgba(42,33,24,.55)', padding: '1px 6px', borderRadius: 5, margin: 2, whiteSpace: 'nowrap' }}>
              {z.ar} · {z.en}
            </span>
          </div>
        ))}
      </div>
      {locked && (detect.fields || []).map(liveLabel)}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 16, textAlign: 'center', fontSize: 12, color: locked ? '#bff0c0' : '#d8c7b2', transition: 'color .3s' }}>
        {locked ? 'Card detected — hold steady · تم رصد البطاقة، اثبت' : caption}
      </div>
    </div>
  );
};

export const ShutterButton = ({ onClick, disabled }) => (
  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 20 }}>
    <button onClick={onClick} disabled={disabled} aria-label="Capture" style={{
      width: 72, height: 72, borderRadius: '50%', background: '#fff',
      border: `5px solid ${C.primary}`, cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.5 : 1, boxShadow: '0 6px 16px rgba(194,65,12,.3)'
    }} />
  </div>
);
