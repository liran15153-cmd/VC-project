import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PREVIEW_PROTOCOL_VERSION,
  isPreviewEvent,
  type GameSummary,
  type PreviewCommand,
  type PreviewError,
  type PreviewLoadPhase,
  type PreviewMode,
  type PreviewWarning,
} from './previewProtocol';

const DEFAULT_LOAD_TIMEOUT_MS = 30000;

/**
 * Mint a unique requestId. Counter + timestamp keeps it readable in dev tools
 * and unique even when many loads fire inside a single millisecond.
 */
let requestCounter = 0;
function mintRequestId(): string {
  requestCounter += 1;
  return `req-${Date.now().toString(36)}-${requestCounter.toString(36)}`;
}

export interface PreviewBridgeState {
  /** Has the iframe announced itself via preview:hello yet? */
  helloReceived: boolean;
  /** Top-level lifecycle mode. */
  mode: PreviewMode;
  /** RequestId of the most recent command the parent issued. */
  currentRequestId: string | null;
  /** Loading sub-phase, when known. */
  lastPhase: PreviewLoadPhase | null;
  /** Summary of the currently running (or most recently loaded) game. */
  summary: GameSummary | null;
  /** Normalisation + asset warnings from the most recent load. */
  warnings: PreviewWarning[];
  /** Last structured error, if any. */
  error: PreviewError | null;
  /** Monotonically increases — useful to drive React keys / counters. */
  loadAttempts: number;
}

export interface PreviewBridgeHandle {
  iframeRef: React.RefObject<HTMLIFrameElement>;
  state: PreviewBridgeState;
  load: (definition: unknown) => string;
  reload: () => string | null;
  destroy: () => string | null;
  pause: () => string | null;
  resume: () => string | null;
  requestSnapshot: () => string | null;
}

export interface UsePreviewBridgeOptions {
  /** When true (default), auto-loads `gameDefinition` once the iframe says hello. */
  autoLoad?: boolean;
  /** Initial definition to feed into the iframe. */
  gameDefinition?: unknown;
  /** Allowed iframe origin. Defaults to the parent's own origin (iframe is same-origin). Pass '*' to disable origin filtering. */
  expectedOrigin?: string;
  /** Ms before a stuck load is reported as a runtime timeout. Pass 0 to disable. */
  loadTimeoutMs?: number;
}

const INITIAL_STATE: PreviewBridgeState = {
  helloReceived: false,
  mode: 'idle',
  currentRequestId: null,
  lastPhase: null,
  summary: null,
  warnings: [],
  error: null,
  loadAttempts: 0,
};

export function usePreviewBridge(options: UsePreviewBridgeOptions = {}): PreviewBridgeHandle {
  const {
    autoLoad = true,
    gameDefinition,
    expectedOrigin,
    loadTimeoutMs = DEFAULT_LOAD_TIMEOUT_MS,
  } = options;

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Refs hold values the message handler & timers need to read synchronously,
  // without forcing re-binds.
  const currentRequestIdRef = useRef<string | null>(null);
  const helloReceivedRef = useRef(false);
  const lastDefinitionRef = useRef<unknown>(gameDefinition);
  const pendingLoadRef = useRef<{ requestId: string; definition: unknown } | null>(null);
  const loadTimeoutRef = useRef<number | null>(null);

  const allowedOrigin = useMemo(() => {
    if (typeof expectedOrigin === 'string') return expectedOrigin;
    if (typeof window !== 'undefined') return window.location.origin;
    return '*';
  }, [expectedOrigin]);

  const [state, setState] = useState<PreviewBridgeState>(INITIAL_STATE);

  // ── Posting commands ─────────────────────────────────────────────────────

  const postCommand = useCallback((command: PreviewCommand): boolean => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return false;
    const target = allowedOrigin === '*' ? '*' : allowedOrigin;
    iframe.contentWindow.postMessage(command, target);
    return true;
  }, [allowedOrigin]);

  // ── Load timeout management ──────────────────────────────────────────────

  const clearLoadTimeout = useCallback(() => {
    if (loadTimeoutRef.current !== null) {
      window.clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  }, []);

  const armLoadTimeout = useCallback((requestId: string) => {
    clearLoadTimeout();
    if (!loadTimeoutMs) return;
    loadTimeoutRef.current = window.setTimeout(() => {
      setState((prev) => {
        if (prev.currentRequestId !== requestId) return prev;
        if (prev.mode === 'running' || prev.mode === 'error') return prev;
        return {
          ...prev,
          mode: 'error',
          error: {
            category: 'runtime',
            message: `Preview load timed out after ${loadTimeoutMs}ms with no response.`,
            phase: prev.lastPhase ?? 'starting',
          },
        };
      });
    }, loadTimeoutMs);
  }, [clearLoadTimeout, loadTimeoutMs]);

  // ── Public commands ──────────────────────────────────────────────────────

  const load = useCallback((definition: unknown): string => {
    const requestId = mintRequestId();
    currentRequestIdRef.current = requestId;
    lastDefinitionRef.current = definition;

    setState((prev) => ({
      ...prev,
      currentRequestId: requestId,
      mode: 'loading',
      lastPhase: null,
      error: null,
      summary: null,
      warnings: [],
      loadAttempts: prev.loadAttempts + 1,
    }));

    if (helloReceivedRef.current) {
      postCommand({ v: PREVIEW_PROTOCOL_VERSION, type: 'preview:load', requestId, gameDefinition: definition });
      armLoadTimeout(requestId);
    } else {
      // Queue until handshake completes — the message handler flushes it.
      pendingLoadRef.current = { requestId, definition };
    }
    return requestId;
  }, [armLoadTimeout, postCommand]);

  const reload = useCallback((): string | null => {
    if (lastDefinitionRef.current == null) return null;
    return load(lastDefinitionRef.current);
  }, [load]);

  const destroy = useCallback((): string | null => {
    const requestId = mintRequestId();
    currentRequestIdRef.current = requestId;
    if (!postCommand({ v: PREVIEW_PROTOCOL_VERSION, type: 'preview:destroy', requestId })) return null;
    setState((prev) => ({ ...prev, currentRequestId: requestId }));
    return requestId;
  }, [postCommand]);

  const pause = useCallback((): string | null => {
    const requestId = mintRequestId();
    currentRequestIdRef.current = requestId;
    if (!postCommand({ v: PREVIEW_PROTOCOL_VERSION, type: 'preview:pause', requestId })) return null;
    return requestId;
  }, [postCommand]);

  const resume = useCallback((): string | null => {
    const requestId = mintRequestId();
    currentRequestIdRef.current = requestId;
    if (!postCommand({ v: PREVIEW_PROTOCOL_VERSION, type: 'preview:resume', requestId })) return null;
    return requestId;
  }, [postCommand]);

  const requestSnapshot = useCallback((): string | null => {
    const requestId = mintRequestId();
    currentRequestIdRef.current = requestId;
    if (!postCommand({ v: PREVIEW_PROTOCOL_VERSION, type: 'preview:get-snapshot', requestId })) return null;
    return requestId;
  }, [postCommand]);

  // ── Inbound message handler ─────────────────────────────────────────────

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const iframe = iframeRef.current;
      if (!iframe || event.source !== iframe.contentWindow) return;
      // Origin check: only enforced when both sides supply one. Synthetic
      // events in jsdom have an empty origin; the source check above is the
      // primary defence in that case.
      if (allowedOrigin !== '*' && event.origin && allowedOrigin && event.origin !== allowedOrigin) return;
      if (!isPreviewEvent(event.data)) return;

      const message = event.data;

      if (message.type === 'preview:hello') {
        if (message.protocolVersion !== PREVIEW_PROTOCOL_VERSION) {
          setState((prev) => ({
            ...prev,
            mode: 'error',
            error: {
              category: 'protocol',
              message: `Preview iframe announced protocol v${message.protocolVersion}; expected v${PREVIEW_PROTOCOL_VERSION}.`,
            },
          }));
          return;
        }
        helloReceivedRef.current = true;
        setState((prev) => ({ ...prev, helloReceived: true }));
        const pending = pendingLoadRef.current;
        if (pending) {
          pendingLoadRef.current = null;
          postCommand({
            v: PREVIEW_PROTOCOL_VERSION,
            type: 'preview:load',
            requestId: pending.requestId,
            gameDefinition: pending.definition,
          });
          armLoadTimeout(pending.requestId);
        }
        return;
      }

      // Reject stale requestIds — except for `preview:error` with a null
      // requestId, which represents an error that has no command association
      // (e.g. an unsolicited runtime error).
      if (message.type === 'preview:error') {
        if (message.requestId !== null && message.requestId !== currentRequestIdRef.current) return;
      } else if ('requestId' in message && message.requestId !== currentRequestIdRef.current) {
        return;
      }

      switch (message.type) {
        case 'preview:loading':
          setState((prev) => ({ ...prev, mode: 'loading', lastPhase: message.phase }));
          return;
        case 'preview:loaded':
          clearLoadTimeout();
          setState((prev) => ({
            ...prev,
            mode: 'running',
            summary: message.summary,
            warnings: message.warnings,
            error: null,
          }));
          return;
        case 'preview:warning':
          setState((prev) => ({ ...prev, warnings: message.warnings }));
          return;
        case 'preview:error':
          clearLoadTimeout();
          setState((prev) => ({ ...prev, mode: 'error', error: message.error }));
          return;
        case 'preview:destroyed':
          setState((prev) => ({ ...prev, mode: 'idle', summary: null, lastPhase: null }));
          return;
        case 'preview:paused':
          setState((prev) => ({ ...prev, mode: 'paused' }));
          return;
        case 'preview:resumed':
          setState((prev) => ({ ...prev, mode: 'running' }));
          return;
        case 'preview:snapshot':
          setState((prev) => ({
            ...prev,
            summary: message.snapshot,
            warnings: message.snapshot.warnings,
            mode: message.snapshot.mode,
          }));
          return;
      }
    }

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      clearLoadTimeout();
    };
  }, [allowedOrigin, armLoadTimeout, clearLoadTimeout, postCommand]);

  // ── Auto-load when the prop changes ──────────────────────────────────────

  useEffect(() => {
    if (!autoLoad) return;
    if (gameDefinition == null) return;
    if (lastDefinitionRef.current === gameDefinition && currentRequestIdRef.current !== null) return;
    load(gameDefinition);
  }, [autoLoad, gameDefinition, load]);

  return {
    iframeRef,
    state,
    load,
    reload,
    destroy,
    pause,
    resume,
    requestSnapshot,
  };
}
