import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { api, partnerStore, setUnauthorizedHandler, tokenStore } from '../api/client';
import type { DemoSession, TokenResponse } from '../api/types';

interface AuthState {
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [isLoggedIn, setLoggedIn] = useState(() => tokenStore.get() !== null);

  const logout = useCallback(() => {
    tokenStore.clear();
    client.clear();
    setLoggedIn(false);
  }, [client]);

  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  const start = useCallback(
    (response: TokenResponse) => {
      if (!('partner' in response)) partnerStore.set(null); // a real account: no demo partner
      client.clear(); // nothing cached from a previous session leaks into the new one
      tokenStore.set(response.access_token);
      setLoggedIn(true);
    },
    [client],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      start(
        await api<TokenResponse>('/auth/login', {
          method: 'POST',
          body: { email, password },
          auth: false,
        }),
      );
    },
    [start],
  );

  const loginDemo = useCallback(async () => {
    const session = await api<DemoSession>('/auth/demo', { method: 'POST', auth: false });
    partnerStore.set(session.partner.access_token);
    start(session);
  }, [start]);

  const value = useMemo(
    () => ({ isLoggedIn, login, loginDemo, logout }),
    [isLoggedIn, login, loginDemo, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
