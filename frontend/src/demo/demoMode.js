// Demo mode — a fully client-side sandbox. While active, all canister calls
// are served by in-memory mock actors seeded with fictional data; NOTHING is
// ever written to the real canister. Works in production builds so the
// deployed site can be demoed safely.

import {
  DEMO_SUBMISSIONS, DEMO_AUDIT_LOG, DEMO_API_CLIENTS,
  DEMO_OTP_CODE, DEMO_API_KEY,
} from './demoData';

const FLAG = 'kyc_demo_mode'; // sessionStorage: '' | 'user' | 'admin' | 'developer'

export function demoRole() {
  try { return sessionStorage.getItem(FLAG) || null; } catch { return null; }
}
export function isDemoMode() { return !!demoRole(); }

export function enableDemo(role) {
  sessionStorage.setItem(FLAG, role);
  buildDemoActors();
  window.dispatchEvent(new Event('demo-change'));
}

export function disableDemo() {
  sessionStorage.removeItem(FLAG);
  sessionStorage.removeItem(FLAG + '_store');
  window.__DEMO_KYC_ACTOR__ = null;
  window.__DEMO_SMS_ACTOR__ = null;
  window.dispatchEvent(new Event('demo-change'));
}

// ── Stateful in-memory store (persisted to sessionStorage so a demo user's
//    submission shows up if they then open the demo admin view) ──────────────
function loadStore() {
  try {
    const raw = sessionStorage.getItem(FLAG + '_store');
    if (raw) return JSON.parse(raw);
  } catch { /* fall through to fresh seed */ }
  return {
    submissions: [...DEMO_SUBMISSIONS],
    auditLog: [...DEMO_AUDIT_LOG],
    apiClients: [...DEMO_API_CLIENTS],
  };
}
function saveStore(store) {
  try { sessionStorage.setItem(FLAG + '_store', JSON.stringify(store)); } catch { /* quota — demo keeps working in-memory */ }
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

export function buildDemoActors() {
  const store = loadStore();

  const updateSubmissionStatus = (id, status) => {
    store.submissions = store.submissions.map(([sid, json]) => {
      if (sid !== id) return [sid, json];
      const d = JSON.parse(json);
      d.kycData.status = status;
      return [sid, JSON.stringify(d)];
    });
    saveStore(store);
  };

  const kycActor = {
    is_admin_check: async () => demoRole() === 'admin',
    get_kyc_submissions_page: async (limit, offset) => {
      await delay(300);
      const l = Number(limit), o = Number(offset);
      return [BigInt(store.submissions.length), store.submissions.slice(o, o + l)];
    },
    get_kyc_submissions_count: async () => BigInt(store.submissions.length),
    get_all_kyc_submissions: async () => store.submissions,
    get_kyc_status_counts: async () => {
      const count = (s) => store.submissions.filter(([, j]) => JSON.parse(j).kycData.status === s).length;
      return [BigInt(count('pending_review')), BigInt(count('approved')), BigInt(count('rejected'))];
    },
    update_kyc_status: async (id, status) => {
      await delay(400);
      updateSubmissionStatus(id, status);
      return { Ok: true }; // "email sent"
    },
    delete_kyc_submission: async (id) => {
      store.submissions = store.submissions.filter(([sid]) => sid !== id);
      saveStore(store);
      return { Ok: null };
    },
    submit_kyc: async (id, json) => {
      await delay(600);
      // The hook passes an already-stringified payload — store it verbatim
      const raw = typeof json === 'string' ? json : JSON.stringify(json);
      store.submissions = [[id, raw], ...store.submissions];
      saveStore(store);
      return { Ok: null };
    },
    national_id_exists: async () => false,
    log_consent_event: async () => undefined,
    get_audit_log_page: async (limit, offset) => {
      const l = Number(limit), o = Number(offset);
      return [BigInt(store.auditLog.length), store.auditLog.slice(o, o + l)];
    },
    get_audit_log: async () => store.auditLog,
    export_audit_log_range: async () => store.auditLog,
    cleanup_expired_sessions: async () => ({ Ok: 0n }),
    // Verification sessions (QR handoff / hosted verify) — always valid in demo
    create_verification_session: async () => ({ Ok: null }),
    verify_session: async () => true,
    mark_verification_in_progress: async () => ({ Ok: null }),
    complete_verification: async () => ({ Ok: null }),
    get_verification_status: async () => [],
    // Partner API clients
    register_api_client: async (name, website, email) => {
      await delay(500);
      const id = `client_demo_${Math.random().toString(36).slice(2, 8)}`;
      store.apiClients = [...store.apiClients, [id, JSON.stringify({
        client_id: id, name, website, contact_email: email,
        status: 'pending', created_at: Date.now() * 1e6, request_count: 0,
      })]];
      saveStore(store);
      return { Ok: [id, DEMO_API_KEY] };
    },
    list_api_clients: async () => store.apiClients,
    set_api_client_status: async (id, status) => {
      store.apiClients = store.apiClients.map(([cid, json]) => {
        if (cid !== id) return [cid, json];
        const d = JSON.parse(json); d.status = status;
        return [cid, JSON.stringify(d)];
      });
      saveStore(store);
      return { Ok: null };
    },
    delete_api_client: async (id) => {
      store.apiClients = store.apiClients.filter(([cid]) => cid !== id);
      saveStore(store);
      return { Ok: null };
    },
    get_my_kyc_status: async (nid) => {
      const hit = store.submissions.find(([, j]) => JSON.parse(j).kycData?.ocrData?.national_id === nid);
      return hit ? [hit[1]] : [];
    },
    delete_my_kyc: async () => ({ Ok: null }),
    list: async () => [],
  };

  const smsActor = {
    send_sms: async () => {
      await delay(500);
      return { success: true, message: `Demo mode: your verification code is ${DEMO_OTP_CODE}` };
    },
    verify_otp: async (_phone, code) => {
      await delay(400);
      return code === DEMO_OTP_CODE
        ? { success: true, message: 'Verified (demo)' }
        : { success: false, message: `Wrong code — in demo mode the code is always ${DEMO_OTP_CODE}` };
    },
  };

  // Defensive catch-all: any method not explicitly mocked resolves to [] so a
  // new page can't accidentally reach the real canister while demoing.
  window.__DEMO_KYC_ACTOR__ = new Proxy(kycActor, {
    get: (t, prop) => (prop in t ? t[prop] : (typeof prop === 'string' ? async () => [] : undefined)),
  });
  window.__DEMO_SMS_ACTOR__ = smsActor;
}

// Rebuild actors on hard refresh while the flag is still set
if (typeof window !== 'undefined' && isDemoMode()) {
  buildDemoActors();
}
