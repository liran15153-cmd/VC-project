import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GameDefinitionPreview, {
  DEFAULT_PREVIEW_SRC,
  type PreviewStatusEvent,
} from './GameDefinitionPreview';
import {
  PREVIEW_PROTOCOL_VERSION,
  type GameSummary,
  type PreviewError,
  type PreviewEvent,
} from './previewProtocol';

const SAMPLE_DEFINITION = {
  schemaVersion: 1,
  metadata: { title: 'Tiny Runner' },
  engine: { width: 800, height: 450, enable2D: true, enable3D: false, enablePhysics: false },
  state: {},
  assets: [],
  scenes: [{ key: 'main', entities: [] }],
  initialScene: 'main',
};

const SUMMARY_OK: GameSummary = {
  title: 'Tiny Runner',
  schemaVersion: 1,
  assetCount: 0,
  loadedAssetCount: 0,
  failedAssetCount: 0,
  sceneCount: 1,
  activeScene: 'main',
  uses2D: true,
  uses3D: false,
  usesPhysics: false,
};

function getIframe(): HTMLIFrameElement {
  const iframe = screen.getByTitle('GameDefinition preview') as HTMLIFrameElement;
  expect(iframe).toBeInstanceOf(HTMLIFrameElement);
  return iframe;
}

function postFromIframe(iframe: HTMLIFrameElement, payload: unknown, origin = ''): void {
  const event = new MessageEvent('message', {
    data: payload,
    source: iframe.contentWindow,
    origin,
  });
  act(() => { window.dispatchEvent(event); });
}

function helloEvent(): PreviewEvent {
  return {
    v: PREVIEW_PROTOCOL_VERSION,
    type: 'preview:hello',
    protocolVersion: PREVIEW_PROTOCOL_VERSION,
    origin: window.location.origin,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GameDefinitionPreview', () => {
  it('renders an iframe pointed at the bundled engine preview', () => {
    render(<GameDefinitionPreview gameDefinition={SAMPLE_DEFINITION} />);
    const iframe = getIframe();
    expect(iframe.getAttribute('src')).toBe(DEFAULT_PREVIEW_SRC);
    expect(screen.getByText(/Loading preview harness/i)).toBeInTheDocument();
  });

  it('waits for preview:hello before sending the load command', () => {
    render(<GameDefinitionPreview gameDefinition={SAMPLE_DEFINITION} />);
    const iframe = getIframe();
    const postSpy = vi.spyOn(iframe.contentWindow as Window, 'postMessage');

    // Before the iframe has hello'd, no command should have been posted.
    expect(postSpy).not.toHaveBeenCalled();

    postFromIframe(iframe, helloEvent());

    expect(postSpy).toHaveBeenCalledTimes(1);
    const [payload] = postSpy.mock.calls[0];
    expect(payload).toMatchObject({
      v: PREVIEW_PROTOCOL_VERSION,
      type: 'preview:load',
      gameDefinition: SAMPLE_DEFINITION,
    });
    expect((payload as { requestId: string }).requestId).toMatch(/^req-/);
  });

  it('reflects loading then ready states from the engine in the UI', () => {
    const onStatusChange = vi.fn();
    render(<GameDefinitionPreview gameDefinition={SAMPLE_DEFINITION} onStatusChange={onStatusChange} />);
    const iframe = getIframe();
    const postSpy = vi.spyOn(iframe.contentWindow as Window, 'postMessage');

    postFromIframe(iframe, helloEvent());
    const requestId = (postSpy.mock.calls[0][0] as { requestId: string }).requestId;

    postFromIframe(iframe, { v: PREVIEW_PROTOCOL_VERSION, type: 'preview:loading', requestId, phase: 'asset-load' });
    expect(screen.getByText(/loading assets/i)).toBeInTheDocument();

    postFromIframe(iframe, {
      v: PREVIEW_PROTOCOL_VERSION,
      type: 'preview:loaded',
      requestId,
      summary: SUMMARY_OK,
      warnings: [
        { code: 'normalized.assetCandidateKey', message: 'key normalized' },
      ],
    });
    expect(screen.getByText(/Running: Tiny Runner/)).toBeInTheDocument();
    expect(screen.getByText(/1 scene/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 warning/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /1 warning/i }));
    expect(screen.getByText('key normalized')).toBeInTheDocument();

    // The status callback should have observed both transitions.
    const events = onStatusChange.mock.calls.map(([e]) => e as PreviewStatusEvent);
    expect(events.some((e) => e.phase === 'running' || e.phase === 'iframe-ready')).toBe(true);
    expect(events.some((e) => e.phase === 'ready' && e.state.summary?.title === 'Tiny Runner')).toBe(true);
  });

  it('surfaces structured errors with a category badge + retry button', () => {
    render(<GameDefinitionPreview gameDefinition={SAMPLE_DEFINITION} />);
    const iframe = getIframe();
    const postSpy = vi.spyOn(iframe.contentWindow as Window, 'postMessage');

    postFromIframe(iframe, helloEvent());
    const firstRequestId = (postSpy.mock.calls[0][0] as { requestId: string }).requestId;

    const error: PreviewError = {
      category: 'asset-load',
      message: 'Failed to load image asset "spr" from /missing.png.',
      failedAssets: [{ key: 'spr', reason: 'HTTP 404' }],
    };
    postFromIframe(iframe, {
      v: PREVIEW_PROTOCOL_VERSION,
      type: 'preview:error',
      requestId: firstRequestId,
      error,
    });

    const errorPanel = screen.getByTestId('preview-error-panel');
    expect(errorPanel).toHaveTextContent(/Asset failed to load/i);
    expect(errorPanel).toHaveTextContent(/Failed to load image asset/i);
    expect(errorPanel).toHaveTextContent('spr');

    // Retry should re-post a load command with a *new* requestId.
    postSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(postSpy).toHaveBeenCalledTimes(1);
    const retryPayload = postSpy.mock.calls[0][0] as { type: string; requestId: string };
    expect(retryPayload.type).toBe('preview:load');
    expect(retryPayload.requestId).not.toBe(firstRequestId);
  });

  it('ignores events with a stale requestId', () => {
    render(<GameDefinitionPreview gameDefinition={SAMPLE_DEFINITION} />);
    const iframe = getIframe();
    const postSpy = vi.spyOn(iframe.contentWindow as Window, 'postMessage');

    postFromIframe(iframe, helloEvent());
    const requestId = (postSpy.mock.calls[0][0] as { requestId: string }).requestId;

    // First load succeeds (so summary becomes set).
    postFromIframe(iframe, {
      v: PREVIEW_PROTOCOL_VERSION,
      type: 'preview:loaded',
      requestId,
      summary: SUMMARY_OK,
      warnings: [],
    });
    expect(screen.getByText(/Running: Tiny Runner/)).toBeInTheDocument();

    // Now an older requestId tries to report an error — must be ignored.
    postFromIframe(iframe, {
      v: PREVIEW_PROTOCOL_VERSION,
      type: 'preview:error',
      requestId: 'stale-old-id',
      error: { category: 'runtime', message: 'should not appear' },
    });
    expect(screen.queryByText(/should not appear/)).toBeNull();
    expect(screen.getByText(/Running: Tiny Runner/)).toBeInTheDocument();
  });

  it('ignores messages from other windows even with valid payloads', () => {
    const onStatusChange = vi.fn();
    render(<GameDefinitionPreview gameDefinition={SAMPLE_DEFINITION} onStatusChange={onStatusChange} />);

    const stray = new MessageEvent('message', {
      data: helloEvent(),
      source: window, // not the iframe
    });
    act(() => { window.dispatchEvent(stray); });

    expect(screen.getByText(/Loading preview harness/i)).toBeInTheDocument();
  });

  it('rejects malformed messages without crashing', () => {
    render(<GameDefinitionPreview gameDefinition={SAMPLE_DEFINITION} />);
    const iframe = getIframe();

    postFromIframe(iframe, { random: 'noise' });
    postFromIframe(iframe, { v: 999, type: 'preview:hello' });
    postFromIframe(iframe, { v: PREVIEW_PROTOCOL_VERSION, type: 'unknown:event' });

    // Still in the initial loading state.
    expect(screen.getByText(/Loading preview harness/i)).toBeInTheDocument();
  });

  it('re-loads with a fresh requestId when the gameDefinition prop changes', () => {
    const { rerender } = render(<GameDefinitionPreview gameDefinition={SAMPLE_DEFINITION} />);
    const iframe = getIframe();
    const postSpy = vi.spyOn(iframe.contentWindow as Window, 'postMessage');

    postFromIframe(iframe, helloEvent());
    expect(postSpy).toHaveBeenCalledTimes(1);
    const firstRequestId = (postSpy.mock.calls[0][0] as { requestId: string }).requestId;

    const updated = { ...SAMPLE_DEFINITION, metadata: { title: 'Updated Runner' } };
    rerender(<GameDefinitionPreview gameDefinition={updated} />);

    expect(postSpy).toHaveBeenCalledTimes(2);
    const secondCall = postSpy.mock.calls[1][0] as { type: string; requestId: string; gameDefinition: unknown };
    expect(secondCall.type).toBe('preview:load');
    expect(secondCall.gameDefinition).toBe(updated);
    expect(secondCall.requestId).not.toBe(firstRequestId);
  });

  it('reports a protocol error when iframe announces a mismatched version', () => {
    render(<GameDefinitionPreview gameDefinition={SAMPLE_DEFINITION} />);
    const iframe = getIframe();

    postFromIframe(iframe, {
      v: PREVIEW_PROTOCOL_VERSION,
      type: 'preview:hello',
      protocolVersion: 999,
      origin: window.location.origin,
    });

    expect(screen.getByTestId('preview-error-panel')).toHaveTextContent(/Preview protocol error/i);
  });
});
