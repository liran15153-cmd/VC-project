import { useEffect, useRef, useState } from 'react';
import { usePreviewBridge, type PreviewBridgeState } from './usePreviewBridge';
import type {
  PreviewError,
  PreviewErrorCategory,
  PreviewMode,
} from './previewProtocol';

export const DEFAULT_PREVIEW_SRC = '/engine-preview/preview.html';

/**
 * Legacy phase enum exposed for GameBuilderPage's progress tracker. The bridge
 * state below is the richer source of truth; this is a convenience derivation.
 */
export type PreviewPhase = 'loading' | 'iframe-ready' | 'running' | 'ready' | 'error';

export interface PreviewStatusEvent {
  mode: PreviewMode;
  phase: PreviewPhase;
  state: PreviewBridgeState;
}

interface Props {
  gameDefinition: unknown;
  title?: string;
  height?: number;
  src?: string;
  onStatusChange?: (event: PreviewStatusEvent) => void;
}

export default function GameDefinitionPreview({
  gameDefinition,
  title = 'GameDefinition preview',
  height = 540,
  src = DEFAULT_PREVIEW_SRC,
  onStatusChange,
}: Props) {
  const bridge = usePreviewBridge({ gameDefinition });
  const [warningsOpen, setWarningsOpen] = useState(false);
  const phase = derivePhase(bridge.state);

  // Hold onStatusChange in a ref so a parent passing an inline callback doesn't
  // force the effect to re-run; only state changes should drive emissions.
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);
  const lastEmittedRef = useRef<PreviewPhase | null>(null);
  useEffect(() => {
    if (lastEmittedRef.current === phase && bridge.state.mode !== 'error') return;
    lastEmittedRef.current = phase;
    onStatusChangeRef.current?.({ mode: bridge.state.mode, phase, state: bridge.state });
  }, [phase, bridge.state]);

  const { state, reload } = bridge;
  const summary = state.summary;
  const error = state.error;
  const warnings = state.warnings;

  return (
    <div className="definition-preview-wrap" data-testid="game-definition-preview">
      <div className="definition-preview-frame" style={{ height }}>
        <iframe
          ref={bridge.iframeRef}
          title={title}
          src={src}
          // Same-origin (frontend serves /engine-preview/*), so we can keep a
          // narrow sandbox while still talking via postMessage.
          sandbox="allow-scripts allow-same-origin allow-pointer-lock"
          referrerPolicy="no-referrer"
          style={{ width: '100%', height: '100%', border: 0, display: 'block', background: '#0b0f16' }}
        />

        <div
          className={`definition-preview-overlay phase-${phase} mode-${state.mode}`}
          aria-live="polite"
          data-testid="preview-overlay"
        >
          <span className="definition-preview-dot" />
          <span data-testid="preview-status-line">{describeState(phase, state)}</span>

          {summary && state.mode === 'running' && (
            <span className="definition-preview-meta" data-testid="preview-asset-meta">
              · {summary.assetCount} asset{summary.assetCount === 1 ? '' : 's'}
              {summary.sceneCount > 0 && ` · ${summary.sceneCount} scene${summary.sceneCount === 1 ? '' : 's'}`}
            </span>
          )}

          {warnings.length > 0 && (
            <button
              type="button"
              className="definition-preview-warnings-toggle"
              onClick={() => setWarningsOpen((open) => !open)}
              data-testid="preview-warnings-toggle"
            >
              {warningsOpen ? 'Hide' : 'View'} {warnings.length} warning{warnings.length === 1 ? '' : 's'}
            </button>
          )}

          {state.mode === 'error' && (
            <button
              type="button"
              className="definition-preview-retry"
              onClick={() => reload()}
              data-testid="preview-retry"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {state.mode === 'error' && error && (
        <ErrorPanel error={error} />
      )}

      {warningsOpen && warnings.length > 0 && (
        <ul className="definition-preview-warnings" data-testid="preview-warnings-list">
          {warnings.map((warning, i) => (
            <li key={`${warning.code ?? 'warn'}-${i}`}>
              <span className="badge">{warning.code || 'warning'}</span>
              <span>{warning.message || warning.path || 'See debug payload'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ErrorPanel({ error }: { error: PreviewError }) {
  return (
    <div className="definition-preview-error" role="alert" data-testid="preview-error-panel">
      <div className="definition-preview-error-title">
        <span className="badge red">{error.category}</span>
        <strong>{humanCategory(error.category)}</strong>
      </div>
      <div className="definition-preview-error-message">{error.message}</div>
      {error.failedAssets && error.failedAssets.length > 0 && (
        <ul className="definition-preview-error-list">
          {error.failedAssets.slice(0, 8).map((failed) => (
            <li key={failed.key}>
              <code>{failed.key}</code> — {failed.reason}
            </li>
          ))}
        </ul>
      )}
      {error.issues && error.issues.length > 0 && (
        <ul className="definition-preview-error-list">
          {error.issues.slice(0, 8).map((issue, i) => (
            <li key={`${issue.path}-${i}`}>
              <code>{issue.path || '(root)'}</code>: {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function derivePhase(state: PreviewBridgeState): PreviewPhase {
  if (state.mode === 'error') return 'error';
  // The harness hasn't said hello yet — nothing's been sent to the engine.
  // Auto-load may have set mode='loading' but the command is still queued, so
  // present this as "harness loading" instead of "game loading".
  if (!state.helloReceived) return 'loading';
  if (state.mode === 'running' || state.mode === 'paused') return 'ready';
  if (state.mode === 'loading') return 'running';
  return 'iframe-ready';
}

function describeState(phase: PreviewPhase, state: PreviewBridgeState): string {
  if (phase === 'error' && state.error) return `${humanCategory(state.error.category)}: ${state.error.message}`;
  if (phase === 'error') return 'Preview error';
  if (phase === 'ready' && state.summary) return `Running: ${state.summary.title}`;
  if (phase === 'ready') return 'Running game';
  if (phase === 'running') {
    return state.lastPhase ? `Loading: ${humanPhase(state.lastPhase)}…` : 'Loading game…';
  }
  if (phase === 'iframe-ready') return 'Sending GameDefinition to engine…';
  return 'Loading preview harness…';
}

function humanCategory(category: PreviewErrorCategory): string {
  switch (category) {
    case 'validation':
      return 'GameDefinition is invalid';
    case 'asset-unsupported':
      return 'Asset type not supported';
    case 'asset-missing-reference':
      return 'Asset reference is missing';
    case 'asset-load':
      return 'Asset failed to load';
    case 'engine-init':
      return 'Engine could not start';
    case 'runtime':
      return 'Runtime error';
    case 'protocol':
      return 'Preview protocol error';
    default:
      return category;
  }
}

function humanPhase(phase: NonNullable<PreviewBridgeState['lastPhase']>): string {
  switch (phase) {
    case 'validating':
      return 'validating definition';
    case 'asset-check':
      return 'checking assets';
    case 'asset-load':
      return 'loading assets';
    case 'scene-build':
      return 'building scene';
    case 'starting':
      return 'starting engine';
    default:
      return phase;
  }
}
