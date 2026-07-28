import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { C, F, h1, btnGhost } from '@/theme';
import { Chip, Mono, Wordmark } from '@/components/ui';
import { useAuth } from '@/lib/auth';

const VERDICT_STYLE = {
  accept: [C.okFg, C.okBg], abstain: [C.warnFg, C.warnBg], reject: [C.errFg, C.errBg]
};
const STATUS_FG = { pending: '#b45309', approved: C.okFg, rejected: C.errFg };

const tabStyle = (on) => ({
  border: 'none', borderRadius: 99, padding: '7px 15px', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: F.body,
  background: on ? C.cocoa : 'none', color: on ? C.surface : C.inkSoft
});

const parse = (txt) => { try { return JSON.parse(txt); } catch { return null; } };

export default function Admin() {
  const { actor, isAuthenticated, isAdmin, principal, login, busy } = useAuth();
  const [tab, setTab] = useState('subs');

  if (!isAuthenticated) {
    return (
      <Shell tab={tab} setTab={setTab} principal={null}>
        <div style={{ padding: 60, textAlign: 'center' }}>
          <div style={h1(26)}>Admin sign-in required</div>
          <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 8 }}>Authenticate with Internet Identity to open the console.</div>
          <button onClick={login} disabled={busy} style={{ marginTop: 22, background: C.cocoa, color: C.surface, border: 'none', borderRadius: 14, padding: '14px 30px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: F.body }}>
            {busy ? 'Waiting for Internet Identity…' : 'Sign in with Internet Identity'}
          </button>
        </div>
      </Shell>
    );
  }
  if (!isAdmin) {
    return (
      <Shell tab={tab} setTab={setTab} principal={principal}>
        <div style={{ padding: 60, textAlign: 'center' }}>
          <div style={h1(26)}>Not an admin</div>
          <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 8 }}>
            Principal <Mono style={{ fontSize: 11 }}>{principal}</Mono> is not on the admin list.
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell tab={tab} setTab={setTab} principal={principal}>
      {tab === 'subs' && <Submissions actor={actor} />}
      {tab === 'sessions' && <Sessions actor={actor} />}
      {tab === 'audit' && <Audit actor={actor} />}
      {tab === 'clients' && <Clients actor={actor} />}
    </Shell>
  );
}

function Shell({ tab, setTab, principal, children }) {
  return (
    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 28px 56px' }}>
      <div style={{ width: 1080, maxWidth: '100%', background: C.surface, borderRadius: 18, boxShadow: '0 18px 50px rgba(61,44,34,.16)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '15px 26px', borderBottom: `1px solid ${C.lineStrong}`, background: '#fff', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <Wordmark size={23} />
            <span style={{ fontSize: 13, color: C.inkSoft }}>admin</span>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setTab('subs')} style={tabStyle(tab === 'subs')}>Submissions</button>
            <button onClick={() => setTab('sessions')} style={tabStyle(tab === 'sessions')}>Sessions</button>
            <button onClick={() => setTab('audit')} style={tabStyle(tab === 'audit')}>Audit log</button>
            <button onClick={() => setTab('clients')} style={tabStyle(tab === 'clients')}>API clients</button>
          </div>
          {principal && <Mono style={{ fontSize: 10, color: C.inkSoft, background: C.shell, padding: '5px 10px', borderRadius: 99 }}>admin · {principal.slice(0, 5)}…{principal.slice(-3)}</Mono>}
        </div>
        {children}
      </div>
    </div>
  );
}

const PAGE = 20;

function Submissions({ actor }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState([0, 0, 0]);
  const [page, setPage] = useState(0);

  const load = useCallback(async (p = page) => {
    const [c, res] = await Promise.all([
      actor.get_kyc_status_counts(),
      actor.get_kyc_submissions_page(BigInt(p * PAGE), BigInt(PAGE))
    ]);
    setCounts(c.map(Number));
    const [tot, entries] = Array.isArray(res) ? res : [res[0], res[1]];
    setTotal(Number(tot));
    setRows(entries.map(([id, json]) => {
      const j = parse(json) || {};
      const k = j.kycData || j;
      const o = k.ocrData || k;
      return {
        id,
        name: o.full_name || o.first_name || '—',
        nid: o.national_id || '—',
        verdict: (o.ocr_verdict || k.ocr_verdict || 'abstain').toLowerCase(),
        status: (j.status || k.status || 'pending').toLowerCase(),
        when: k.timestamp || j.submitted_at || ''
      };
    }));
  }, [actor, page]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const decide = async (id, status) => {
    try {
      const res = await actor.update_kyc_status(id, status);
      if (res && 'Err' in res) throw new Error(res.Err);
      await load();
    } catch (e) { alert(e.message); }
  };

  const stat = (label, n, color) => (
    <div style={{ flex: 1, background: '#fff', borderRadius: 16, padding: '15px 19px', boxShadow: '0 2px 8px rgba(61,44,34,.05)' }}>
      <div style={{ fontSize: 11, color: C.inkSoft }}>{label}</div>
      <div style={{ fontFamily: F.display, fontSize: 30, fontWeight: 800, color }}>{n}</div>
    </div>
  );

  return (
    <>
      <div style={{ display: 'flex', gap: 14, padding: '20px 26px 0' }}>
        {stat('Pending', counts[0], C.ink)}{stat('Approved', counts[1], C.okFg)}{stat('Rejected', counts[2], C.primary)}
      </div>
      <div style={{ margin: '16px 26px 26px', background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 8px rgba(61,44,34,.05)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1.4fr 1fr 1fr 1.3fr', padding: '12px 20px', fontSize: 11, color: C.inkSoft, borderBottom: `1px solid ${C.line}` }}>
          <span>Applicant</span><span>National ID</span><span>OCR verdict</span><span>Status</span><span style={{ textAlign: 'right' }}>Actions</span>
        </div>
        {rows.length === 0 && <div style={{ padding: '26px 20px', fontSize: 13, color: C.inkFaint }}>No submissions yet.</div>}
        {rows.map((r) => {
          const [vFg, vBg] = VERDICT_STYLE[r.verdict] || VERDICT_STYLE.abstain;
          return (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1.7fr 1.4fr 1fr 1fr 1.3fr', padding: '13px 20px', fontSize: 13, alignItems: 'center', borderBottom: '1px solid #faf5ec' }}>
              <span dir="rtl" style={{ fontWeight: 600, textAlign: 'left' }}>{r.name}</span>
              <Mono style={{ fontSize: 12, color: C.inkSoft }}>{r.nid}</Mono>
              <span><Chip fg={vFg} bg={vBg}>{r.verdict.replace(/^./, (c) => c.toUpperCase())}</Chip></span>
              <span style={{ fontSize: 12, fontWeight: 500, color: STATUS_FG[r.status] || C.inkSoft }}>{r.status.replace(/^./, (c) => c.toUpperCase())}</span>
              <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                {r.status === 'pending' ? (
                  <>
                    <button onClick={() => decide(r.id, 'approved')} style={{ border: `1px solid ${C.okLine}`, background: C.okBg, color: C.okFg, borderRadius: 99, padding: '5px 14px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: F.body }}>Approve</button>
                    <button onClick={() => decide(r.id, 'rejected')} style={{ border: `1px solid ${C.errLine}`, background: C.errBg, color: C.errFg, borderRadius: 99, padding: '5px 14px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: F.body }}>Reject</button>
                  </>
                ) : <span style={{ fontSize: 11, color: C.inkFaint }}>decided</span>}
              </span>
            </div>
          );
        })}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', fontSize: 11.5, color: C.inkSoft }}>
          <span>Showing {rows.length} of {total}</span>
          <span style={{ display: 'flex', gap: 12 }}>
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} style={{ ...btnGhost, fontSize: 11.5, opacity: page === 0 ? 0.4 : 1 }}>← Prev</button>
            <button disabled={(page + 1) * PAGE >= total} onClick={() => setPage((p) => p + 1)} style={{ ...btnGhost, fontSize: 11.5, color: C.primary, fontWeight: 600, opacity: (page + 1) * PAGE >= total ? 0.4 : 1 }}>Next →</button>
          </span>
        </div>
      </div>
    </>
  );
}

const SESSION_CHIP = {
  pending: [C.inkSoft, C.shell], in_progress: [C.warnFg, C.warnBg],
  completed: [C.okFg, C.okBg], cancelled: [C.errFg, C.errBg], expired: [C.errFg, C.errBg]
};

function Sessions({ actor }) {
  const [rows, setRows] = useState([]);
  const load = useCallback(async () => {
    const res = await actor.get_all_verification_sessions();
    setRows(res.map(([id, json]) => {
      const j = parse(json) || {};
      return { id, status: (j.status || 'pending').toLowerCase(), created: j.created_at, hb: j.last_heartbeat || j.updated_at };
    }));
  }, [actor]);
  useEffect(() => { load().catch(() => {}); }, [load]);

  const fmt = (ns) => {
    if (!ns) return '—';
    const ms = Number(BigInt(ns) / 1000000n);
    const mins = Math.round((Date.now() - ms) / 60000);
    return mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
  };

  return (
    <div style={{ margin: '20px 26px 26px', background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 8px rgba(61,44,34,.05)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr', padding: '12px 20px', fontSize: 11, color: C.inkSoft, borderBottom: `1px solid ${C.line}` }}>
        <span>Session</span><span>Status</span><span>Created</span><span>Last activity</span>
      </div>
      {rows.length === 0 && <div style={{ padding: '26px 20px', fontSize: 13, color: C.inkFaint }}>No sessions.</div>}
      {rows.map((r) => {
        const [fg, bg] = SESSION_CHIP[r.status] || SESSION_CHIP.pending;
        return (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr', padding: '13px 20px', fontSize: 12.5, alignItems: 'center', borderBottom: '1px solid #faf5ec' }}>
            <Mono style={{ fontSize: 11.5 }}>{r.id}</Mono>
            <span><Chip fg={fg} bg={bg}>{r.status.replace('_', ' ').replace(/^./, (c) => c.toUpperCase())}</Chip></span>
            <span style={{ color: C.inkSoft }}>{fmt(r.created)}</span>
            <Mono style={{ color: C.inkSoft, fontSize: 11.5 }}>{fmt(r.hb)}</Mono>
          </div>
        );
      })}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px' }}>
        <button onClick={() => actor.cleanup_expired_sessions().then(load).catch(() => {})}
          style={{ border: `1px solid ${C.lineStrong}`, background: C.surface, color: C.inkSoft, borderRadius: 99, padding: '6px 16px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: F.body }}>
          Clean up expired
        </button>
      </div>
    </div>
  );
}

function Audit({ actor }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    actor.get_audit_log(BigInt(50)).then((res) => {
      setRows(res.map(([a, b]) => {
        const j = parse(b);
        return { ts: a, kind: j?.kind || j?.event || '', msg: j ? (j.msg || j.message || b) : b };
      }));
    }).catch(() => {});
  }, [actor]);

  return (
    <div style={{ margin: '20px 26px 26px', background: C.cocoa, borderRadius: 18, padding: '20px 24px', boxShadow: '0 2px 8px rgba(61,44,34,.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: '#c7b6a4', fontWeight: 600 }}>Append-only audit trail</span>
      </div>
      {rows.length === 0 && <div style={{ fontFamily: F.mono, fontSize: 11.5, color: '#a08b76' }}>audit log is empty</div>}
      {rows.map((a, i) => (
        <div key={i} style={{ fontFamily: F.mono, fontSize: 11.5, lineHeight: 2, color: '#e8dccb', wordBreak: 'break-all' }}>
          <span style={{ color: '#a08b76' }}>{a.ts}</span>{'  '}
          {a.kind && <span style={{ color: C.accent }}>{a.kind}{'  '}</span>}
          {String(a.msg).slice(0, 160)}
        </div>
      ))}
    </div>
  );
}

function Clients({ actor }) {
  const [rows, setRows] = useState([]);
  const [fresh, setFresh] = useState(null); // {id, secret} shown once

  const load = useCallback(async () => {
    const res = await actor.list_api_clients();
    setRows(res.map(([id, json]) => {
      const j = parse(json) || {};
      return { id, name: j.name || id, url: j.redirect_url || j.url || '', status: (j.status || 'active').toLowerCase() };
    }));
  }, [actor]);
  useEffect(() => { load().catch(() => {}); }, [load]);

  const register = async () => {
    const name = prompt('Client name?');
    if (!name) return;
    const url = prompt('Redirect / callback URL?') || '';
    try {
      const res = await actor.register_api_client(name, url, '');
      if (res && 'Err' in res) throw new Error(res.Err);
      const [id, secret] = res.Ok;
      setFresh({ id, secret });
      await load();
    } catch (e) { alert(e.message); }
  };

  return (
    <div style={{ margin: '20px 26px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={register} style={{ border: 'none', background: C.primary, color: '#fff7ef', borderRadius: 99, padding: '9px 20px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: F.body }}>
          + Register client
        </button>
      </div>
      {rows.length === 0 && <div style={{ fontSize: 13, color: C.inkFaint, padding: '10px 4px' }}>No API clients registered.</div>}
      {rows.map((c) => (
        <div key={c.id} style={{ background: '#fff', borderRadius: 18, padding: '18px 22px', boxShadow: '0 2px 8px rgba(61,44,34,.05)', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: C.shell, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.display, fontWeight: 800, fontSize: 18, color: C.inkSoft }}>{c.name[0]?.toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
            <Mono style={{ fontSize: 11, color: C.inkSoft, marginTop: 2, display: 'block' }}>{c.id}{c.url ? ` · ${c.url}` : ''}</Mono>
          </div>
          {fresh?.id === c.id && (
            <Mono style={{ fontSize: 10.5, color: C.warnFg, background: C.warnBg, padding: '6px 12px', borderRadius: 10 }}>
              secret shown once: {fresh.secret}
            </Mono>
          )}
          <Chip fg={c.status === 'active' ? C.okFg : C.errFg} bg={c.status === 'active' ? C.okBg : C.errBg}>
            {c.status.replace(/^./, (ch) => ch.toUpperCase())}
          </Chip>
        </div>
      ))}
    </div>
  );
}
