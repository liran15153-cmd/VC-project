import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { healthApi } from '../../api/endpoints';
import { getApiBase, setApiBase as persistApiBase } from '../../api/client';
import type { HealthResponse } from '../../types/api';

type Status = 'unknown' | 'online' | 'offline' | 'degraded';

interface HealthState {
  status: Status;
  data: HealthResponse | null;
  apiBase: string;
  lastCheckedAt: number | null;
  checking: boolean;
}

interface HealthContextValue extends HealthState {
  refresh: () => Promise<void>;
  setApiBase: (base: string) => void;
  aiConfigured: boolean;
  openaiConfigured: boolean;
  aiProviderLabel: string;
  aiDefaultModel?: string;
  aiSupportedModels: string[];
}

const HealthContext = createContext<HealthContextValue | null>(null);

const POLL_MS = 30_000;

export function HealthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HealthState>({
    status: 'unknown',
    data: null,
    apiBase: getApiBase(),
    lastCheckedAt: null,
    checking: false,
  });
  const timer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, checking: true }));
    try {
      const data = await healthApi.get();
      setState({
        status: data.status === 'ok' ? 'online' : 'degraded',
        data,
        apiBase: getApiBase(),
        lastCheckedAt: Date.now(),
        checking: false,
      });
    } catch (err) {
      setState({
        status: 'offline',
        data: null,
        apiBase: getApiBase(),
        lastCheckedAt: Date.now(),
        checking: false,
      });
      // swallow — the badge reflects offline state
      void err;
    }
  }, []);

  useEffect(() => {
    void refresh();
    timer.current = window.setInterval(() => void refresh(), POLL_MS);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [refresh]);

  const setBase = useCallback((base: string) => {
    persistApiBase(base);
    setState((s) => ({ ...s, apiBase: getApiBase() }));
    void refresh();
  }, [refresh]);

  const aiConfigured = Boolean(state.data?.ai?.configured ?? state.data?.services?.ai === 'configured');
  const openaiConfigured = aiConfigured;
  const aiProviderLabel = state.data?.ai?.providerLabel || 'AI provider';
  const aiDefaultModel = state.data?.ai?.defaultModel;
  const aiSupportedModels = state.data?.ai?.supportedModels || [];

  const value = useMemo<HealthContextValue>(() => ({
    ...state,
    refresh,
    setApiBase: setBase,
    aiConfigured,
    openaiConfigured,
    aiProviderLabel,
    aiDefaultModel,
    aiSupportedModels,
  }), [state, refresh, setBase, aiConfigured, openaiConfigured, aiProviderLabel, aiDefaultModel, aiSupportedModels]);

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

export function useHealth(): HealthContextValue {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error('useHealth must be used within HealthProvider');
  return ctx;
}
