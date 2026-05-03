import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generationApi, mcqApi } from '../../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { useHealth } from '../health/HealthContext';
import GamePreview from '../game-preview/GamePreview';
import type {
  Dimension, GenerateGameResponse, Genre, MCQQuestion,
} from '../../types/api';
import { GENRES_2D, GENRES_3D } from '../../types/api';
import './GameBuilderPage.css';

type Step = 'idle' | 'generating-mcq' | 'awaiting-answers' | 'generating-game' | 'ready' | 'error';

const PROGRESS_STEPS = [
  'Checking backend',
  'Generating questions',
  'Building game JSON',
  'Validating',
  'Running preview',
  'Saved',
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
  const [result, setResult] = useState<GenerateGameResponse | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [activeProgress, setActiveProgress] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editing, setEditing] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');

  const offline = status === 'offline';
  const generationDisabled = offline || !aiConfigured;
  const modelOptions = aiSupportedModels.length ? aiSupportedModels : [...FALLBACK_MODELS];
  const modelForRequest = selectedModel || aiDefaultModel || modelOptions[0];

  const onDimensionChange = (d: Dimension) => {
    setDimension(d);
    const list = d === '2D' ? GENRES_2D : GENRES_3D;
    if (!list.includes(genre as never)) setGenre(list[0]);
  };

  const generateQuestions = async () => {
    setError(null);
    setQuestions([]);
    setAnswers({});
    setResult(null);
    setStep('generating-mcq');
    setActiveProgress(0);
    try {
      setActiveProgress(1);
      const res = await mcqApi.generate({ prompt, gameType: genre, dimension, model: modelForRequest });
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
    setResult(null);
    setStep('generating-game');
    setActiveProgress(2);
    try {
      const res = await generationApi.generateGame({
        prompt, answers, gameType: genre, dimension, model: modelForRequest, saveToDb: true,
      });
      setActiveProgress(4);
      setResult(res);
      if (res.meta?.tokens) setTokens(res.meta.tokens);
      setActiveProgress(5);
      setStep('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate game');
      setStep('error');
    }
  };

  const editGame = async () => {
    if (!result || !editPrompt.trim()) return;
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
    setQuestions([]); setAnswers({}); setResult(null);
    setStep('idle'); setActiveProgress(-1); setError(null);
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
              </select>
            </div>
            <div style={{ minWidth: 200, flex: 1 }}>
              <label>Genre</label>
              <select value={genre} onChange={(e) => setGenre(e.target.value as Genre)}>
                {(dimension === '2D' ? GENRES_2D : GENRES_3D).map((g) => (
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
                  disabled={step === 'generating-game' || generationDisabled}
                  onClick={generateGame}
                >
                  {step === 'generating-game' && <span className="spinner" />}
                  Generate game
                </button>
              </div>
            </>
          )}
        </section>

        <aside className="card builder-side">
          <h2 className="panel-title">Progress</h2>
          <ol className="progress-list">
            {PROGRESS_STEPS.map((label, i) => {
              const done = activeProgress > i || step === 'ready';
              const active = activeProgress === i && step !== 'ready';
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
              <h2 style={{ margin: 0, fontSize: 18 }}>{result.gameJSON.metadata.gameTitle}</h2>
              <div className="muted" style={{ fontSize: 12 }}>
                {result.gameJSON.metadata.genre} · {result.gameJSON.metadata.dimension}
                {result.meta.model && ` · ${result.meta.model}`}
                {typeof result.meta.durationMs === 'number' && ` · ${(result.meta.durationMs / 1000).toFixed(1)}s`}
                {result.meta.attempts && result.meta.attempts > 1 && ` · ${result.meta.attempts} attempts`}
                {result.meta.fallback && <span className="badge amber" style={{ marginLeft: 8 }}>fallback</span>}
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              {result.gameId && (
                <button className="btn secondary sm" onClick={() => navigate(`/games/${result.gameId}`)}>Open in My Games</button>
              )}
            </div>
          </div>

          <GamePreview htmlString={result.htmlString} title={result.gameJSON.metadata.gameTitle} />

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
        </section>
      )}
    </div>
  );
}
