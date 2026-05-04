import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { requireSupabaseConfigured, supabase, supabaseConfigured } from '../../lib/supabase';
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

function fallbackUser(authUser: SupabaseUser): User {
  const displayName =
    typeof authUser.user_metadata?.display_name === 'string'
      ? authUser.user_metadata.display_name
      : authUser.email?.split('@')[0];

  return {
    id: authUser.id,
    email: authUser.email || '',
    displayName,
    role: 'user',
    subscriptionTier: 'free',
    createdAt: authUser.created_at,
  };
}

async function loadProfile(authUser: SupabaseUser): Promise<User> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,display_name,role,subscription_tier,created_at')
    .eq('id', authUser.id)
    .maybeSingle();

  if (error || !data) return fallbackUser(authUser);

  return {
    id: data.id,
    email: data.email || authUser.email || '',
    displayName: data.display_name || authUser.email?.split('@')[0],
    role: data.role === 'admin' ? 'admin' : 'user',
    subscriptionTier: data.subscription_tier || 'free',
    createdAt: data.created_at,
  };
}

async function loadTokenBalance(): Promise<TokenBalance | null> {
  const { data, error } = await supabase.rpc('get_token_balance');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;

  return {
    userId: row.user_id,
    tokensRemaining: row.tokens_remaining ?? 0,
    tokensTotal: row.tokens_total ?? 0,
    subscription: row.subscription ?? 'free',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    tokens: null,
    loading: true,
    error: null,
  });

  const loadAccount = useCallback(async (authUser: SupabaseUser | null) => {
    if (!authUser) {
      setState({ user: null, tokens: null, loading: false, error: null });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [user, tokens] = await Promise.all([loadProfile(authUser), loadTokenBalance()]);
      setState({ user, tokens, loading: false, error: null });
    } catch (err) {
      setState({
        user: fallbackUser(authUser),
        tokens: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load account',
      });
    }
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) {
      setState({
        user: null,
        tokens: null,
        loading: false,
        error: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in frontend .env.',
      });
      return;
    }

    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) void loadAccount(data.user);
    }).catch((err) => {
      if (alive) setState({ user: null, tokens: null, loading: false, error: err instanceof Error ? err.message : 'Auth failed' });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadAccount(session?.user ?? null);
    });

    return () => {
      alive = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadAccount]);

  const login = useCallback(async (email: string, password: string) => {
    requireSupabaseConfigured();
    setState((s) => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setState((s) => ({ ...s, loading: false, error: error.message }));
      throw error;
    }
    await loadAccount(data.user);
  }, [loadAccount]);

  const register = useCallback(async (email: string, password: string, displayName?: string) => {
    requireSupabaseConfigured();
    setState((s) => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName || email.split('@')[0] } },
    });
    if (error) {
      setState((s) => ({ ...s, loading: false, error: error.message }));
      throw error;
    }
    await loadAccount(data.user);
  }, [loadAccount]);

  const logout = useCallback(async () => {
    requireSupabaseConfigured();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setState({ user: null, tokens: null, loading: false, error: null });
  }, []);

  const refreshTokens = useCallback(async () => {
    try {
      const tokens = await loadTokenBalance();
      setState((s) => ({ ...s, tokens, error: null }));
    } catch (err) {
      setState((s) => ({ ...s, error: err instanceof Error ? err.message : 'Failed to refresh tokens' }));
    }
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
