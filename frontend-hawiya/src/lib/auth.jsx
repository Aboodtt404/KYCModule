import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { II_URL, authedKycActor, kycActor } from './agent';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authClient, setAuthClient] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [principal, setPrincipal] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);

  const [actor, setActor] = useState(() => kycActor());

  const adopt = useCallback(async (client) => {
    const id = client.getIdentity();
    const p = id.getPrincipal();
    if (p.isAnonymous()) return;
    setIdentity(id);
    setPrincipal(p.toText());
    const a = await authedKycActor(id);
    setActor(a);
    try { setIsAdmin(await a.is_admin_check()); } catch { setIsAdmin(false); }
  }, []);

  useEffect(() => {
    AuthClient.create().then(async (client) => {
      setAuthClient(client);
      if (await client.isAuthenticated()) await adopt(client);
    });
  }, [adopt]);

  const login = useCallback(async () => {
    if (!authClient) return;
    setBusy(true);
    try {
      await new Promise((resolve, reject) =>
        authClient.login({
          identityProvider: II_URL,
          maxTimeToLive: 8n * 60n * 60n * 1_000_000_000n,
          onSuccess: resolve,
          onError: reject
        })
      );
      await adopt(authClient);
    } finally {
      setBusy(false);
    }
  }, [authClient, adopt]);

  const logout = useCallback(async () => {
    await authClient?.logout();
    setIdentity(null); setPrincipal(null); setIsAdmin(false); setActor(kycActor());
  }, [authClient]);

  const value = useMemo(() => ({
    actor, identity, principal, isAdmin, busy, login, logout,
    isAuthenticated: !!principal
  }), [actor, identity, principal, isAdmin, busy, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
