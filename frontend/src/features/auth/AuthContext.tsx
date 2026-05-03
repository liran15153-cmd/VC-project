import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi, tokensApi } from '../../api/endpoints';
import { ApiError, getToken, setToken } from '../../api/client';
import type { TokenBalance, User } from '../../types/api';

interface AuthState {
  user: User | null;
  tokens: TokenBalance | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  setTokens: (tokens: TokenBalance | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, tokens: null, loading: true, error: null });

  const hydrate = useCallback(async () => {
    if (!getToken()) {
      setState({ user: null, tokens: null, loading: false, error: null });
      return;
    }
    try {
      const me = await authApi.me();
      setState({ user: me.user, tokens: me.tokens, loading: false, error: null });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setToken(null);
      }
      setState({ user: null, tokens: null, loading: false, error: null });
    }
  }, []);

  useEffect(() => { void hydrate(); }, [hydrate]);

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await authApi.login({ email, password });
      setToken(res.token);
      setState({ user: res.user, tokens: res.tokens, loading: false, error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setState((s) => ({ ...s, loading: false, error: msg }));
      throw err;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, displayName?: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await authApi.register({ email, password, displayName });
      setToken(res.token);
      setState({ user: res.user, tokens: res.tokens, loading: false, error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setState((s) => ({ ...s, loading: false, error: msg }));
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    setToken(null);
    setState({ user: null, tokens: null, loading: false, error: null });
  }, []);

  const refreshTokens = useCallback(async () => {
    if (!getToken()) return;
    try {
      const t = await tokensApi.get();
      setState((s) => ({ ...s, tokens: t }));
    } catch { /* ignore */ }
  }, []);

  const setTokens = useCallback((tokens: TokenBalance | null) => {
    setState((s) => ({ ...s, tokens }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, register, logout, refreshTokens, setTokens }),
    [state, login, register, logout, refreshTokens, setTokens]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
