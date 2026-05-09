import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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

const LOCAL_AUTH_BYPASS = true;
const LOCAL_USER: User = {
  id: 'local-dev-user',
  email: 'creator@loomier.local',
  displayName: 'Local Creator',
  role: 'user',
  subscriptionTier: 'dev'
};
const LOCAL_TOKENS: TokenBalance = {
  userId: LOCAL_USER.id,
  tokensRemaining: 999,
  tokensTotal: 999,
  subscription: 'dev'
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, tokens: null, loading: true, error: null });

  const hydrate = useCallback(async () => {
    if (LOCAL_AUTH_BYPASS) {
      setState({ user: LOCAL_USER, tokens: LOCAL_TOKENS, loading: false, error: null });
    }
  }, []);

  useEffect(() => { void hydrate(); }, [hydrate]);

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    void email;
    void password;
    setState({ user: LOCAL_USER, tokens: LOCAL_TOKENS, loading: false, error: null });
  }, []);

  const register = useCallback(async (email: string, password: string, displayName?: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    void email;
    void password;
    setState({
      user: { ...LOCAL_USER, displayName: displayName || LOCAL_USER.displayName },
      tokens: LOCAL_TOKENS,
      loading: false,
      error: null
    });
  }, []);

  const logout = useCallback(async () => {
    setState({ user: LOCAL_USER, tokens: LOCAL_TOKENS, loading: false, error: null });
  }, []);

  const refreshTokens = useCallback(async () => {
    setState((s) => ({ ...s, tokens: s.tokens || LOCAL_TOKENS }));
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
