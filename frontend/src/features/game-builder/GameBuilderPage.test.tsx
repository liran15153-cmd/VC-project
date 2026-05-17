import { act, render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// Default engine mock response (no diagnostics).
const defaultEngineResponse = {
  brief: { dimension: '2D', genre: 'runner', title: 'Tiny Runner' },
  gameDefinition: {
    schemaVersion: 1,
    metadata: { title: 'Tiny Runner', genre: 'runner' },
    engine: { width: 800, height: 450, enable2D: true, enable3D: false, enablePhysics: false },
    state: {},
    assets: [],
    scenes: [{ key: 'main', entities: [] }],
    initialScene: 'main',
  },
  normalizationWarnings: [],
  debugDiagnostics: [],
  debugDiagnosticsSummary: { errorCount: 0, warningCount: 0, codes: {} },
  debugRepair: { attempted: false, accepted: false, appliedPatches: [], skippedCount: 0 },
  meta: { provider: 'mock', model: 'mock-model', selectedAssetCount: 0 },
} as const;

// Mock the api endpoints before importing the page so the imports resolve
// against the mocks rather than hitting the real client.
vi.mock('../../api/endpoints', () => {
  return {
    mcqApi: {
      generate: vi.fn(async () => ({
        questions: [
          {
            id: 'q1',
            question: 'Theme?',
            options: [
              { id: 'a', label: 'Forest', value: 'forest' },
              { id: 'b', label: 'Desert', value: 'desert' },
            ],
          },
        ],
        meta: { provider: 'mock', model: 'mock-model' },
      })),
    },
    briefApi: {
      generate: vi.fn(async () => ({
        brief: {
          title: 'Tiny Runner',
          oneSentencePitch: 'Run and dodge.',
          playerFantasy: 'Be fast',
          targetPlatform: 'cross-platform',
          dimension: '2D',
          genre: 'runner',
          coreLoop: ['run', 'dodge'],
          keyMechanics: ['jump'],
          controls: { primary: 'keyboard', mobile: 'tap', accessibilityNotes: [] },
          runtimePlan: {
            runtime: 'hybrid',
            phaserRole: '2D world',
            threeRole: 'none',
            rapierRole: 'physics',
            godotStyleGenerationNotes: '',
            systems: ['movement'],
          },
          assetPlan: { existingAssetsToUse: [], assetsToGenerate: [], visualStyle: 'flat' },
          missingInfo: [],
          followUpQuestions: [],
          productionNotes: [],
          nonGoals: [],
        },
        meta: { provider: 'mock', model: 'mock-model' },
      })),
    },
    engineApi: {
      fromBrief: vi.fn(async () => defaultEngineResponse),
    },
    generationApi: { editGame: vi.fn() },
  };
});

// Stub the AuthContext + HealthContext hooks so we don't need real providers.
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ setTokens: vi.fn() }),
}));
vi.mock('../health/HealthContext', () => ({
  useHealth: () => ({
    status: 'online',
    aiConfigured: true,
    aiProviderLabel: 'OpenRouter',
    aiDefaultModel: 'openai/gpt-5',
    aiSupportedModels: ['openai/gpt-5'],
  }),
}));

import GameBuilderPage from './GameBuilderPage';
import { engineApi } from '../../api/endpoints';

function renderPage() {
  return render(
    <MemoryRouter>
      <GameBuilderPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  // Each test starts from a fresh DOM.
});

async function driveBuilderToReadyResult() {
  renderPage();
  fireEvent.change(screen.getByPlaceholderText(/A 2D platformer/i), {
    target: { value: 'A tiny runner game' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Generate questions/i }));
  await screen.findByText('Theme?');
  fireEvent.click(screen.getByRole('button', { name: /Generate game/i }));
  // Wait for the engine preview wrapper — that's the success condition.
  await waitFor(() => {
    expect(screen.getByTestId('game-definition-preview')).toBeInTheDocument();
  });
}

function getPreviewIframe(): HTMLIFrameElement {
  const iframe = screen.getByTestId('game-definition-preview').querySelector('iframe');
  if (!iframe) throw new Error('GameDefinitionPreview iframe not found');
  return iframe as HTMLIFrameElement;
}

describe('DiagnosticsPanel', () => {
  it('does not render when debugDiagnostics is empty', async () => {
    await driveBuilderToReadyResult();
    expect(screen.queryByTestId('diagnostics-panel')).not.toBeInTheDocument();
  });

  it('renders DiagnosticsPanel when debugDiagnostics has items', async () => {
    vi.mocked(engineApi.fromBrief).mockResolvedValueOnce({
      ...defaultEngineResponse,
      debugDiagnostics: [
        {
          code: 'UNUSED_ASSET',
          severity: 'warning',
          message: 'Asset "orphan" is declared but never referenced by any entity, audio rule, or playSound action.',
          jsonPointer: '/assets/0',
          suggestedFixText: 'Remove or reference it.',
        },
        {
          code: 'SCENE_HAS_CAMERA_NO_TARGET',
          severity: 'warning',
          message: 'Scene "main" enables the camera system but no entity has a cameraTarget.',
          jsonPointer: '/scenes/0/systems',
          suggestedFixText: 'Add cameraTarget to the player entity.',
        },
      ],
      debugDiagnosticsSummary: { errorCount: 0, warningCount: 2, codes: { UNUSED_ASSET: 1, SCENE_HAS_CAMERA_NO_TARGET: 1 } },
    } as typeof defaultEngineResponse);
    await driveBuilderToReadyResult();
    expect(screen.getByTestId('diagnostics-panel')).toBeInTheDocument();
    const codes = screen.getAllByTestId('diagnostic-code').map((el) => el.textContent);
    expect(codes).toContain('UNUSED_ASSET');
    expect(codes).toContain('SCENE_HAS_CAMERA_NO_TARGET');
    expect(screen.getByText(/declared but never referenced/)).toBeInTheDocument();
    expect(screen.getAllByText(/cameraTarget/).length).toBeGreaterThan(0);
  });

  it('renders error-severity diagnostics and shows error count badge', async () => {
    vi.mocked(engineApi.fromBrief).mockResolvedValueOnce({
      ...defaultEngineResponse,
      debugDiagnostics: [
        {
          code: 'DUPLICATE_ASSET_KEY',
          severity: 'error',
          message: 'Asset key "hero" is declared more than once.',
          jsonPointer: '/assets/1/key',
          suggestedFixText: 'Rename the duplicate asset.',
        },
      ],
      debugDiagnosticsSummary: { errorCount: 1, warningCount: 0, codes: { DUPLICATE_ASSET_KEY: 1 } },
    } as typeof defaultEngineResponse);
    await driveBuilderToReadyResult();
    expect(screen.getByTestId('diagnostics-panel')).toBeInTheDocument();
    expect(screen.getByText(/1 error/)).toBeInTheDocument();
    expect(screen.getByText('DUPLICATE_ASSET_KEY')).toBeInTheDocument();
    expect(screen.getByText(/declared more than once/)).toBeInTheDocument();
  });
});

describe('GameBuilderPage with /engine/from-brief response', () => {
  it('renders the GameDefinitionPreview iframe, not raw JSON', async () => {
    await driveBuilderToReadyResult();
    // The preview component is on screen.
    expect(screen.getByTestId('game-definition-preview')).toBeInTheDocument();
    // The raw JSON dump is NOT the main preview — it's hidden behind the toggle.
    expect(screen.queryByTestId('game-definition-json')).not.toBeInTheDocument();
    // The progress copy must not claim "Ready" until the engine iframe reports it.
    const readyStep = screen.getByText('Ready').closest('.progress-step');
    expect(readyStep?.className).not.toMatch(/\bdone\b/);
  });

  it('reveals the JSON diagnostic only after the user opts in', async () => {
    await driveBuilderToReadyResult();
    expect(screen.queryByTestId('game-definition-json')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Show GameDefinition JSON/i }));
    expect(screen.getByTestId('game-definition-json')).toBeInTheDocument();
  });

  it('flips Progress to Ready only when the engine iframe reports preview:loaded', async () => {
    await driveBuilderToReadyResult();
    const iframe = getPreviewIframe();
    const postSpy = vi.spyOn(iframe.contentWindow as Window, 'postMessage');

    // Initial handshake — engine announces protocol + version.
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { v: 1, type: 'preview:hello', protocolVersion: 1, origin: window.location.origin },
        source: iframe.contentWindow,
      }));
    });
    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({ v: 1, type: 'preview:load' }),
      expect.any(String),
    );
    const requestId = (postSpy.mock.calls[0][0] as { requestId: string }).requestId;

    // Engine reports loading (mid-flight) then a finished load with summary.
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { v: 1, type: 'preview:loading', requestId, phase: 'asset-load' },
        source: iframe.contentWindow,
      }));
    });
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          v: 1,
          type: 'preview:loaded',
          requestId,
          summary: {
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
          },
          warnings: [],
        },
        source: iframe.contentWindow,
      }));
    });

    await waitFor(() => {
      const readyStep = screen.getByText('Ready').closest('.progress-step');
      expect(readyStep?.className).toMatch(/\bdone\b/);
    });
  });
});
