// Canister actors with an explicit agent host.
//
// On mainnet the default boundary nodes are used. Everywhere else the agent MUST call
// back to the page's own origin (dev server / proxy forwards /api to the replica) —
// agent-js otherwise silently defaults to mainnet whenever the page isn't localhost
// (phones, tunnels), which sends local-canister calls to canisters that don't exist.
import { createActor as createKycActor, canisterId as kycCanisterId } from 'declarations/rust_backend';
import { createActor as createSmsActor, canisterId as smsCanisterId } from 'declarations/sms_verification_backend';

export const AGENT_HOST =
  process.env.DFX_NETWORK === 'ic'
    ? undefined
    : typeof window !== 'undefined' ? window.location.origin : undefined;

export { kycCanisterId, smsCanisterId };

// One shared anonymous agent. Query responses are verified against the subnet root
// key; on local networks that key must be fetched first, and the fetch is async — any
// query racing it fails certificate verification (this is latency-dependent: invisible
// on localhost, near-certain through a tunnel). `agentReady` resolves once the root key
// is in place; await it before the first canister call of a page.
// BOTH declaration sets under src/declarations are generated on @icp-sdk/core —
// the agent MUST come from the same package. A @dfinity/agent HttpAgent passes
// queries (both APIs have .query) but crashes on updates: the @icp-sdk Actor
// calls agent.update(), which @dfinity/agent doesn't have ("agent.update is
// not a function" — Wael's send_sms failure, 2026-07-28).
import { HttpAgent } from '@icp-sdk/core/agent';

const kycAgent = new HttpAgent({ host: AGENT_HOST });
const smsAgent = new HttpAgent({ host: AGENT_HOST });
export const agentReady =
  process.env.DFX_NETWORK !== 'ic'
    ? Promise.allSettled([kycAgent.fetchRootKey(), smsAgent.fetchRootKey()])
    : Promise.resolve();

let _kycAnon = null;
let _smsAnon = null;

export function kycActor(identity) {
  if (!kycCanisterId) return null;
  if (identity) return createKycActor(kycCanisterId, { agentOptions: { host: AGENT_HOST, identity } });
  if (!_kycAnon) _kycAnon = createKycActor(kycCanisterId, { agent: kycAgent });
  return _kycAnon;
}

// Authenticated actor with the root key properly fetched — a bare agentOptions
// actor never fetches it, so on local networks every QUERY fails certificate
// verification (the "not on the admin list" bug: is_admin_check threw and the
// catch read as false).
export async function authedKycActor(identity) {
  if (!kycCanisterId) return null;
  const agent = new HttpAgent({ host: AGENT_HOST, identity });
  if (process.env.DFX_NETWORK !== 'ic') await agent.fetchRootKey().catch(() => {});
  return createKycActor(kycCanisterId, { agent });
}

export function smsActor(identity) {
  if (!smsCanisterId) return null;
  if (identity) return createSmsActor(smsCanisterId, { agentOptions: { host: AGENT_HOST, identity } });
  if (!_smsAnon) _smsAnon = createSmsActor(smsCanisterId, { agent: smsAgent });
  return _smsAnon;
}

// Retry helper for calls where a transient network/verification hiccup must not
// surface as a hard failure (e.g. session validation on page load).
export async function withRetry(fn, attempts = 3, delayMs = 1200) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, delayMs)); }
  }
  throw lastErr;
}

export const II_URL =
  process.env.DFX_NETWORK === 'ic'
    ? 'https://identity.ic0.app'
    : import.meta.env.VITE_II_URL || 'http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943';
