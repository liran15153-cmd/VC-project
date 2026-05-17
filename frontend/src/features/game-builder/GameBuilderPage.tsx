import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { briefApi, engineApi, generationApi, mcqApi } from '../../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { useHealth } from '../health/HealthContext';
import GamePreview from '../game-preview/GamePreview';
import GameDefinitionPreview, { type PreviewStatusEvent } from '../game-preview/GameDefinitionPreview';
import type {
  DebugDiagnostic, Dimension, EngineFromBriefResponse, GameBrief, GameBriefGenerateResponse, GenerateGameResponse, Genre, MCQGenerateResponse, MCQQuestion,
} from '../../types/api';
import { GENRES_2D, GENRES_3D, GENRES_HYBRID } from '../../types/api';
import './GameBuilderPage.css';

type Step = 'idle' | 'generating-mcq' | 'awaiting-answers' | 'generating-brief' | 'generating-game' | 'preview-loading' | 'preview-running' | 'ready' | 'error';

const PROGRESS_STEPS = [
  'Checking backend',
  'Generating questions',
  'Creating game brief',
  'Building GameDefinition',
  'Running preview',
  'Ready',
] as const;

const FALLBACK_MODELS = ['openai/gpt-5', 'openai/gpt-5-mini', 'anthropic/claude-sonnet-4.5', 'google/gemma-3-27b-it'] as const;

export default function GameBuilderPage() {
  const { setTokens } = useAuth();
  const { status, aiConfigured, aiProviderLabel, aiDefaultModel, aiSupportedModels } = useHealth();
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState('');
  const [dimension, setDimension] = useState<Dimension>('2D');
  const [genre, setGenre] = useState<Genre>('platformer');
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [mcqMeta, setMcqMeta] = useState<MCQGenerateResponse['meta'] | null>(null);
  const [brief, setBrief] = useState<GameBrief | null>(null);
  const [briefMeta, setBriefMeta] = useState<GameBriefGenerateResponse['meta'] | null>(null);
  const [result, setResult] = useState<GenerateGameResponse | EngineFromBriefResponse | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [activeProgress, setActiveProgress] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editing, setEditing] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [showDefinitionJSON, setShowDefinitionJSON] = useState(false);

  const offline = status === 'offline';
  const generationDisabled = offline || !aiConfigured;
  const modelOptions = aiSupportedModels.length ? aiSupportedModels : [...FALLBACK_MODELS];
  const modelForRequest = selectedModel || aiDefaultModel || modelOptions[0];

  const onDimensionChange = (d: Dimension) => {
    setDimension(d);
    const list = d === '2D' ? GENRES_2D : d === '3D' ? GENRES_3D : GENRES_HYBRID;
    if (!list.includes(genre as never)) setGenre(list[0]);
  };

  const generateQuestions = async () => {
    setError(null);
    setQuestions([]);
    setAnswers({});
    setMcqMeta(null);
    setBrief(null);
    setBriefMeta(null);
    setResult(null);
    setStep('generating-mcq');
    setActiveProgress(0);
    try {
      setActiveProgress(1);
      const res = await mcqApi.generate({ prompt, gameType: genre, dimension, model: modelForRequest });
      setMcqMeta(res.meta || null);
      setQuestions(res.questions);
      const defaults: Record<string, string> = {};
      res.questions.forEach((q) => { if (q.options[0]) defaults[q.id] = q.options[0].value; });
      setAnswers(defaults);
      if (res.meta?.tokens) setTokens(res.meta.tokens);
      setStep('awaiting-answers');
      setActiveProgress(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate questions');
      setStep('error');
    }
  };

  const generateGame = async () => {
    setError(null);
    setBrief(null);
    setBriefMeta(null);
    setResult(null);
    setStep('generating-brief');
    setActiveProgress(2);
    try {
      const briefRes = await briefApi.generate({
        prompt,
        answers,
        gameType: genre,
        dimension,
        model: modelForRequest,
      });
      setBrief(briefRes.brief);
      setBriefMeta(briefRes.meta || null);

      setStep('generating-game');
      setActiveProgress(3);
      const res = await engineApi.fromBrief({
        prompt, answers, gameType: genre, dimension, brief: briefRes.brief, model: modelForRequest,
      });
      setResult(res);
      if (res.meta?.tokens) setTokens(res.meta.tokens);
      if (hasPlayableHtml(res)) {
        setActiveProgress(5);
        setStep('ready');
      } else {
        // Preview only counts as "Running" / "Ready" once the GAME_ENGINE
        // iframe actually reports it. Until then, hold on step 3.
        setStep('preview-loading');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate game');
      setStep('error');
    }
  };

  const onPreviewStatus = (event: PreviewStatusEvent) => {
    if (event.phase === 'running') {
      setStep('preview-running');
      setActiveProgress(4);
    } else if (event.phase === 'ready') {
      setStep('ready');
      setActiveProgress(5);
    } else if (event.phase === 'error') {
      setStep('error');
      const err = event.state.error;
      const detail = err ? `${err.category}: ${err.message}` : 'GAME_ENGINE preview failed to load the GameDefinition.';
      setError(detail);
    }
  };

  const editGame = async () => {
    if (!result || !('gameJSON' in result) || !editPrompt.trim()) return;
    setError(null);
    setEditing(true);
    try {
      const res = await generationApi.editGame({
        gameId: result.gameId || undefined,
        gameJSON: result.gameJSON,
        editPrompt,
        model: modelForRequest,
        saveToDb: !!result.gameId,
      });
      setResult(res);
      setEditPrompt('');
      if (res.meta?.tokens) setTokens(res.meta.tokens);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to edit game');
    } finally {
      setEditing(false);
    }
  };

  const reset = () => {
    setQuestions([]); setAnswers({}); setMcqMeta(null); setBrief(null); setBriefMeta(null); setResult(null);
    setStep('idle'); setActiveProgress(-1); setError(null); setShowDefinitionJSON(false);
  };

  return (
    <div className="builder col" style={{ gap: 20 }}>
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: 22 }}>Build a game</h1>
        <div className="muted">Tell us what to make. The AI will ask a few questions, then generate a playable game.</div>
      </div>

      {generationDisabled && (
        <div className="error-banner">
          {offline
            ? 'Backend unreachable. Start backend on localhost:3000.'
            : `${aiProviderLabel} key is not configured in backend .env. Generation is disabled.`}
        </div>
      )}

      <div className="builder-grid">
        <section className="card builder-panel">
          <h2 className="panel-title">1. Describe your game</h2>
          <label>What do you want to build?</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A 2D platformer where a fox collects glowing fruit and avoids spiked plants…"
            rows={4}
          />
          <div className="row" style={{ gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 140 }}>
              <label>Dimension</label>
              <select value={dimension} onChange={(e) => onDimensionChange(e.target.value as Dimension)}>
                <option value="2D">2D</option>
                <option value="3D">3D</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <div style={{ minWidth: 200, flex: 1 }}>
              <label>Genre</label>
              <select value={genre} onChange={(e) => setGenre(e.target.value as Genre)}>
                {(dimension === '2D' ? GENRES_2D : dimension === '3D' ? GENRES_3D : GENRES_HYBRID).map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div style={{ minWidth: 240, flex: 1 }}>
              <label>AI model</label>
              <select value={selectedModel || aiDefaultModel || modelOptions[0] || ''} onChange={(e) => setSelectedModel(e.target.value)}>
                {modelOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                Provider: {aiProviderLabel}
              </div>
            </div>
          </div>

          <div className="row" style={{ marginTop: 16, gap: 8 }}>
            <button
              className="btn"
              disabled={!prompt.trim() || step === 'generating-mcq' || step === 'generating-game' || generationDisabled}
              onClick={generateQuestions}
            >
              {step === 'generating-mcq' && <span className="spinner" />}
                {questions.length > 0 ? 'Regenerate questions' : 'Generate questions'}
            </button>
            {(questions.length > 0 || result) && (
              <button className="btn ghost" onClick={reset}>Start over</button>
            )}
          </div>

          {questions.length > 0 && (
            <>
              <h2 className="panel-title" style={{ marginTop: 24 }}>2. Quick questions</h2>
              {mcqMeta && (
                <AgentMeta label="Questions Agent" meta={mcqMeta} />
              )}
              <div className="col" style={{ gap: 14 }}>
                {questions.map((q) => (
                  <div key={q.id} className="mcq">
                    <div className="mcq-q">{q.question}</div>
                    <div className="mcq-options">
                      {q.options.map((opt) => {
                        const checked = answers[q.id] === opt.value;
                        return (
                          <label key={opt.id} className={`mcq-option${checked ? ' selected' : ''}`}>
                            <input
                              type="radio"
                              name={q.id}
                              value={opt.value}
                              checked={checked}
                              onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt.value }))}
                            />
                            <span>{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="row" style={{ marginTop: 16 }}>
                <button
                  className="btn"
                  disabled={step === 'generating-brief' || step === 'generating-game' || generationDisabled}
                  onClick={generateGame}
                >
                  {(step === 'generating-brief' || step === 'generating-game') && <span className="spinner" />}
                  Generate game
                </button>
              </div>
            </>
          )}

          {brief && (
            <div className="brief-panel">
              <div className="row between" style={{ gap: 8, alignItems: 'flex-start' }}>
                <div>
                  <h2 className="panel-title" style={{ marginBottom: 4 }}>3. Game brief</h2>
                  <div className="brief-title">{brief.title}</div>
                </div>
                {briefMeta && <AgentMeta label="Brief Agent" meta={briefMeta} compact />}
              </div>
              <p className="brief-pitch">{brief.oneSentencePitch}</p>
              <div className="brief-grid">
                <BriefList title="Core loop" items={brief.coreLoop} />
                <BriefList title="Runtime systems" items={brief.runtimePlan.systems} />
                <BriefList title="Assets to generate" items={brief.assetPlan.assetsToGenerate} />
              </div>
            </div>
          )}
        </section>

        <aside className="card builder-side">
          <h2 className="panel-title">Progress</h2>
          <ol className="progress-list">
            {PROGRESS_STEPS.map((label, i) => {
              const done = step === 'ready' ? true : activeProgress > i;
              // "Running preview" (i=4) is only active once the iframe reports
              // it; "Ready" (i=5) only flips to done once the engine signals it.
              let active = activeProgress === i && step !== 'ready';
              if (i === 4) active = step === 'preview-loading' || step === 'preview-running';
              if (i === 5) active = false;
              return (
                <li key={label} className={`progress-step${done ? ' done' : ''}${active ? ' active' : ''}`}>
                  <span className="progress-dot">{done ? '✓' : i + 1}</span>
                  <span>{label}</span>
                </li>
              );
            })}
          </ol>

          {error && (
            <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>
          )}
        </aside>
      </div>

      {result && (
        <section className="card" style={{ padding: 20 }}>
          <div className="row between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>{resultTitle(result)}</h2>
              <div className="muted" style={{ fontSize: 12 }}>
                {resultGenre(result)} / {resultDimension(result)}
                {result.meta.model && ` · ${result.meta.model}`}
                {typeof result.meta.durationMs === 'number' && ` · ${(result.meta.durationMs / 1000).toFixed(1)}s`}
                {result.meta.attempts && result.meta.attempts > 1 && ` · ${result.meta.attempts} attempts`}
                {'fallback' in result.meta && result.meta.fallback && <span className="badge amber" style={{ marginLeft: 8 }}>fallback</span>}
                {'debugRepair' in result && (result as EngineFromBriefResponse).debugRepair?.accepted && <span className="badge" style={{ marginLeft: 8 }}>auto-repaired</span>}
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              {'gameId' in result && result.gameId && (
                <button className="btn secondary sm" onClick={() => navigate(`/games/${result.gameId}`)}>Open in My Games</button>
              )}
            </div>
          </div>

          {'htmlString' in result ? (
            <GamePreview htmlString={result.htmlString} title={result.gameJSON.metadata.gameTitle} />
          ) : (
            <>
              <GameDefinitionPreview
                gameDefinition={result.gameDefinition}
                title={resultTitle(result)}
                onStatusChange={onPreviewStatus}
              />
              {'debugDiagnostics' in result && Array.isArray(result.debugDiagnostics) && result.debugDiagnostics.length > 0 && (
                <DiagnosticsPanel diagnostics={result.debugDiagnostics} />
              )}
              <div className="row" style={{ marginTop: 12, gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  className="definition-debug-toggle"
                  onClick={() => setShowDefinitionJSON((v) => !v)}
                  aria-expanded={showDefinitionJSON}
                >
                  {showDefinitionJSON ? 'Hide' : 'Show'} GameDefinition JSON
                </button>
                {typeof result.meta?.selectedAssetCount === 'number' && (
                  <span className="muted" style={{ fontSize: 12 }}>
                    {result.meta.selectedAssetCount} asset{result.meta.selectedAssetCount === 1 ? '' : 's'} resolved
                  </span>
                )}
                {'assetResolution' in result && <ResolverSummary meta={result.meta} />}
              </div>
              {showDefinitionJSON && (
                <div className="definition-preview" style={{ marginTop: 12 }} data-testid="game-definition-json">
                  <pre>{JSON.stringify(result.gameDefinition, null, 2)}</pre>
                </div>
              )}
            </>
          )}

          {'gameJSON' in result && (
          <div className="card" style={{ marginTop: 16, padding: 16, background: 'var(--gray-25)' }}>
            <label>Refine with a follow-up prompt</label>
            <div className="row" style={{ gap: 8, alignItems: 'stretch' }}>
              <input
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="Add enemies that chase the player; make jumping higher"
                onKeyDown={(e) => { if (e.key === 'Enter') void editGame(); }}
              />
              <button
                className="btn"
                onClick={() => void editGame()}
                disabled={editing || !editPrompt.trim() || generationDisabled}
              >
                {editing && <span className="spinner" />}
                Apply changes
              </button>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Try: “Add a boss enemy”, “Make it harder”, “Use a forest theme”.
            </div>
          </div>
          )}
        </section>
      )}
    </div>
  );
}

function hasPlayableHtml(
  result: GenerateGameResponse | EngineFromBriefResponse,
): result is GenerateGameResponse {
  return 'htmlString' in result && typeof result.htmlString === 'string' && result.htmlString.length > 0;
}

function resultTitle(result: GenerateGameResponse | EngineFromBriefResponse): string {
  if ('gameJSON' in result) return String(result.gameJSON.metadata.gameTitle || 'Generated game');
  const metadata = (result.gameDefinition as { metadata?: { title?: string } })?.metadata;
  return metadata?.title || result.brief.title || 'Generated GameDefinition';
}

function resultGenre(result: GenerateGameResponse | EngineFromBriefResponse): string {
  if ('gameJSON' in result) return String(result.gameJSON.metadata.genre || 'unknown');
  const metadata = (result.gameDefinition as { metadata?: { genre?: string } })?.metadata;
  return metadata?.genre || result.brief.genre || 'unknown';
}

function resultDimension(result: GenerateGameResponse | EngineFromBriefResponse): string {
  if ('gameJSON' in result) return String(result.gameJSON.metadata.dimension || 'unknown');
  return result.brief.dimension || 'hybrid';
}

function AgentMeta({ label, meta, compact = false }: {
  label: string;
  meta: {
    provider?: string;
    mode?: string;
    model?: string;
    durationMs?: number;
    fallback?: boolean;
    schemaRepair?: boolean;
    cached?: boolean;
    tokenOptimized?: boolean;
  };
  compact?: boolean;
}) {
  const details = [
    meta.provider,
    meta.mode,
    meta.model,
    typeof meta.durationMs === 'number' ? `${(meta.durationMs / 1000).toFixed(1)}s` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className={`agent-meta${compact ? ' compact' : ''}`}>
      <div className="agent-meta-label">{label}</div>
      <div className="agent-meta-line">{details || 'No metadata returned'}</div>
      <div className="agent-meta-badges">
        {meta.fallback && <span className="badge amber">fallback</span>}
        {meta.schemaRepair && <span className="badge">json repaired</span>}
        {meta.cached && <span className="badge">cached</span>}
        {meta.tokenOptimized && <span className="badge">token saved</span>}
      </div>
    </div>
  );
}

function ResolverSummary({ meta }: { meta: EngineFromBriefResponse['meta'] }) {
  const warning = meta.compatibilityWarningCount || 0;
  const missing = meta.missingAssetCount || 0;
  const substitutions = meta.substitutionCount || 0;
  const dominantPack = meta.dominantPack;
  const gameType = meta.gameType;
  const hasAnySignal = warning || missing || substitutions || dominantPack || gameType;
  if (!hasAnySignal) return null;
  return (
    <span className="muted" style={{ fontSize: 12, display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
      {gameType && <span>· type: {gameType}</span>}
      {dominantPack && <span>· pack: {dominantPack}</span>}
      {substitutions > 0 && <span>· {substitutions} substitution{substitutions === 1 ? '' : 's'}</span>}
      {missing > 0 && <span className="badge amber">{missing} missing</span>}
      {warning > 0 && <span className="badge">{warning} warning{warning === 1 ? '' : 's'}</span>}
    </span>
  );
}

function BriefList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="brief-list-title">{title}</div>
      <ul className="brief-list">
        {items.slice(0, 5).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function DiagnosticsPanel({ diagnostics }: { diagnostics: DebugDiagnostic[] }) {
  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');
  const sorted = [...errors, ...warnings];
  return (
    <div className="diagnostics-panel" data-testid="diagnostics-panel">
      <div className="diagnostics-header">
        <span>Debug diagnostics</span>
        {errors.length > 0 && (
          <span className="badge" style={{ background: '#fee2e2', color: '#7f1d1d', borderColor: '#fca5a5' }}>
            {errors.length} error{errors.length !== 1 ? 's' : ''}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="badge amber">
            {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {sorted.map((d, i) => (
        <div key={i} className={`diagnostic-item ${d.severity}`}>
          <div className="diagnostic-code" data-testid="diagnostic-code">{d.code}</div>
          <div className="diagnostic-message">{d.message}</div>
          {d.jsonPointer && <div className="diagnostic-pointer">{d.jsonPointer}</div>}
          {d.suggestedFixText && <div className="diagnostic-fix">Fix: {d.suggestedFixText}</div>}
        </div>
      ))}
    </div>
  );
}
