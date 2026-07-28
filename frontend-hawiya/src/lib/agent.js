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
// The rust_backend declarations use @icp-sdk/core, the sms ones use @dfinity/agent —
// each actor gets an agent from its own package to avoid interface drift.
import { HttpAgent as KycHttpAgent } from '@icp-sdk/core/agent';
import { HttpAgent as SmsHttpAgent } from '@dfinity/agent';

const kycAgent = new KycHttpAgent({ host: AGENT_HOST });
const smsAgent = new SmsHttpAgent({ host: AGENT_HOST });
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
