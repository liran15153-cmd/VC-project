import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
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

const DEMO_USER: User = {
  id: 'supabase-pending-user',
  email: 'demo@gaming-vibe.local',
  displayName: 'Creator',
  role: 'user',
  subscriptionTier: 'free',
};

const DEMO_TOKENS: TokenBalance = {
  userId: DEMO_USER.id,
  tokensRemaining: 0,
  tokensTotal: 0,
  subscription: 'supabase pending',
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: DEMO_USER,
    tokens: DEMO_TOKENS,
    loading: false,
    error: null,
  });

  const login = useCallback(async (email: string) => {
    setState((s) => ({
      ...s,
      user: { ...DEMO_USER, email, displayName: email.split('@')[0] || DEMO_USER.displayName },
      loading: false,
      error: null,
    }));
  }, []);

  const register = useCallback(async (email: string, _password: string, displayName?: string) => {
    setState((s) => ({
      ...s,
      user: { ...DEMO_USER, email, displayName: displayName || email.split('@')[0] || DEMO_USER.displayName },
      loading: false,
      error: null,
    }));
  }, []);

  const logout = useCallback(async () => {
    setState({ user: DEMO_USER, tokens: DEMO_TOKENS, loading: false, error: null });
  }, []);

  const refreshTokens = useCallback(async () => {
    setState((s) => ({ ...s, tokens: s.tokens || DEMO_TOKENS }));
  }, []);

  const setTokens = useCallback((tokens: TokenBalance | null) => {
    setState((s) => ({ ...s, tokens: tokens || DEMO_TOKENS }));
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
