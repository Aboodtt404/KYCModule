// Hawiya design tokens — extracted from the Claude Design prototype.
export const C = {
  bg: '#efe7d9',        // page backdrop
  surface: '#faf3ea',   // app surface / cards backdrop
  card: '#ffffff',
  ink: '#3d2c22',       // primary text
  inkSoft: '#8a7462',   // secondary text
  inkFaint: '#b09a83',  // tertiary / mono captions
  line: '#f3ebdf',      // hairline dividers
  lineStrong: '#eadfce',
  shell: '#efe4d4',     // muted fills / chips
  primary: '#c2410c',   // burnt orange
  primaryDark: '#9a3412',
  accent: '#f5a623',    // amber
  dark: '#2a2118',      // camera well
  cocoa: '#3d2c22',
  okFg: '#166534', okBg: '#e4f0e2', okLine: '#bcd0bb',
  warnFg: '#7c5205', warnBg: '#fdf0d5', warnChip: '#f5c76e',
  errFg: '#9a3412', errBg: '#fde8dd', errLine: '#eab6a0'
};

export const F = {
  display: "'Zain', sans-serif",
  body: "'Alexandria', sans-serif",
  mono: "'IBM Plex Mono', monospace"
};

export const btnPrimary = {
  background: C.primary, color: '#fff7ef', border: 'none', borderRadius: 16,
  padding: 17, fontFamily: F.body, fontSize: 15, fontWeight: 600, cursor: 'pointer',
  boxShadow: '0 6px 18px rgba(194,65,12,.28)', width: '100%'
};

export const btnDark = {
  background: C.cocoa, color: C.surface, border: 'none', borderRadius: 14,
  padding: '14px 34px', fontFamily: F.body, fontSize: 14, fontWeight: 600, cursor: 'pointer'
};

export const btnGhost = {
  border: 'none', background: 'none', fontSize: 13, color: C.inkSoft,
  cursor: 'pointer', fontFamily: F.body
};

export const cardStyle = {
  background: C.card, borderRadius: 18, boxShadow: '0 2px 12px rgba(61,44,34,.06)'
};

export const h1 = (size = 30) => ({
  fontFamily: F.display, fontSize: size, fontWeight: 800, lineHeight: 1.1
});

export const arSub = (size = 19) => ({
  fontFamily: F.display, fontSize: size, color: C.inkSoft, marginTop: 4
});

export const spinner = (size = 56) => ({
  width: size, height: size, borderRadius: '50%',
  border: '4px solid #eadfce', borderTopColor: C.primary,
  animation: 'spin 1s linear infinite'
});
