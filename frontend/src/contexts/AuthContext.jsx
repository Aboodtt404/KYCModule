import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { AuthClient } from "@dfinity/auth-client";
import { createActor, canisterId } from "declarations/rust_backend";

const II_URL =
  process.env.DFX_NETWORK === "ic"
    ? "https://identity.ic0.app"
    : `http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943`;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authClient, setAuthClient]   = useState(null);
  const [identity, setIdentity]       = useState(null);
  const [principal, setPrincipal]     = useState(null);
  const [actor, setActor]             = useState(null);
  const [isAdmin, setIsAdmin]         = useState(false);
  const [loading, setLoading]         = useState(true);

  const buildActor = useCallback((id) => {
    if (!canisterId) return null;
    return createActor(canisterId, { agentOptions: { identity: id } });
  }, []);

  // Ask the canister whether this principal is in the admin list.
  const checkAdmin = useCallback(async (builtActor) => {
    if (!builtActor) return false;
    try {
      return await builtActor.is_admin_check();
    } catch {
      return false;
    }
  }, []);

  const init = useCallback(async () => {
    // E2E test hook — only exists in dev builds; Vite eliminates this branch in prod
    if (import.meta.env.DEV && typeof window !== "undefined" && window.__TEST_AUTH__) {
      const fakePrincipal = {
        isAnonymous: () => false,
        toText: () => "test-e2e-principal",
        toString: () => "test-e2e-principal",
      };
      setIdentity({ getPrincipal: () => fakePrincipal });
      setPrincipal(fakePrincipal);
      setActor(window.__TEST_KYC_ACTOR__ || null);
      setIsAdmin(!!window.__TEST_AUTH__.isAdmin);
      setLoading(false);
      return;
    }

    // Demo mode — sandboxed session, real Internet Identity is never invoked
    if (typeof window !== "undefined" && window.__DEMO_KYC_ACTOR__) {
      const role = sessionStorage.getItem("kyc_demo_mode");
      const demoPrincipal = {
        isAnonymous: () => false,
        toText: () => "demo-principal",
        toString: () => "demo-principal",
      };
      setIdentity({ getPrincipal: () => demoPrincipal });
      setPrincipal(demoPrincipal);
      setActor(window.__DEMO_KYC_ACTOR__);
      setIsAdmin(role === "admin");
      setLoading(false);
      return;
    }

    // Clear any stale demo/session state before the real auth check
    setIdentity(null);
    setPrincipal(null);
    setActor(null);
    setIsAdmin(false);

    const client = await AuthClient.create();
    setAuthClient(client);

    if (await client.isAuthenticated()) {
      const id = client.getIdentity();
      setIdentity(id);
      setPrincipal(id.getPrincipal());
      const a = buildActor(id);
      setActor(a);
      const adminStatus = await checkAdmin(a);
      setIsAdmin(adminStatus);
    }
    setLoading(false);
  }, [buildActor, checkAdmin]);

  useEffect(() => { init(); }, [init]);

  // Re-initialize when demo mode is toggled so the session switches
  // between the sandbox and real auth without a page reload
  useEffect(() => {
    const onDemoChange = () => { setLoading(true); init(); };
    window.addEventListener("demo-change", onDemoChange);
    return () => window.removeEventListener("demo-change", onDemoChange);
  }, [init]);

  // Re-validate admin status every 5 minutes so revoked principals lose access promptly
  useEffect(() => {
    if (!actor) return;
    const interval = setInterval(async () => {
      const stillAdmin = await checkAdmin(actor);
      setIsAdmin(stillAdmin);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [actor, checkAdmin]);

  const loginWithII = useCallback(async () => {
    if (!authClient) return;
    await new Promise((resolve, reject) => {
      authClient.login({
        identityProvider: II_URL,
        onSuccess: resolve,
        onError: reject,
        windowOpenerFeatures:
          "toolbar=0,scrollbars=1,location=0,statusbar=0,menubar=0,resizable=1,width=500,height=600",
      });
    });
    const id = authClient.getIdentity();
    setIdentity(id);
    setPrincipal(id.getPrincipal());
    const a = buildActor(id);
    setActor(a);
    // Probe the canister — returns true only if this principal is a controller or set_admin'd
    const adminStatus = await checkAdmin(a);
    setIsAdmin(adminStatus);
    return adminStatus; // caller can redirect appropriately
  }, [authClient, buildActor, checkAdmin]);

  const logout = useCallback(async () => {
    if (authClient) await authClient.logout();
    setIdentity(null);
    setPrincipal(null);
    setActor(null);
    setIsAdmin(false);
  }, [authClient]);

  const isAuthenticated = !!identity && !identity.getPrincipal().isAnonymous();

  return (
    <AuthContext.Provider value={{
      identity, principal, actor, isAdmin, isAuthenticated, loading, loginWithII, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
