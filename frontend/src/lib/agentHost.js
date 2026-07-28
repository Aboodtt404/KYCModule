// Agent host for canister calls.
//
// On mainnet the default boundary nodes are correct. Everywhere else the agent MUST
// call back to the origin the page was served from: the dev server proxies /api to the
// local replica, so this works from localhost AND from tunneled origins (phones).
// Without an explicit host, HttpAgent falls back to the mainnet boundary (icp-api.io)
// whenever the page isn't on localhost — which silently sends local-canister calls to
// mainnet and breaks e.g. the desktop→phone QR handoff ("Session Unavailable").
export const AGENT_HOST =
  process.env.DFX_NETWORK === "ic"
    ? undefined
    : typeof window !== "undefined"
      ? window.location.origin
      : undefined;
