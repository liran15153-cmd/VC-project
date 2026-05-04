import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { analyticsApi, gamesApi, generationApi, promptHistoryApi } from '../../api/endpoints';
import { downloadBlob } from '../../api/client';
import { useAuth } from '../auth/AuthContext';
import { useHealth } from '../health/HealthContext';
import GamePreview from '../game-preview/GamePreview';
import type { SavedGame } from '../../types/api';

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setTokens } = useAuth();
  const { status, aiConfigured, aiProviderLabel } = useHealth();

  const [game, setGame] = useState<SavedGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<'download' | 'delete' | null>(null);

  const generationDisabled = status === 'offline' || !aiConfigured;

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const g = await gamesApi.get(id);
      setGame(g);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [id]);

  const onEdit = async () => {
    if (!game || !editPrompt.trim()) return;
    setEditing(true);
    setError(null);
    try {
      const res = await generationApi.editGame({
        gameId: game.id,
        gameJSON: game.gameJSON,
        editPrompt,
      });
      if (res.meta?.tokens) setTokens(res.meta.tokens);
      const saved = await gamesApi.update(game.id, {
        title: res.gameJSON.metadata.gameTitle,
        description: res.gameJSON.metadata.description,
        genre: res.gameJSON.metadata.genre,
        dimension: res.gameJSON.metadata.dimension,
        difficulty: res.gameJSON.metadata.difficulty,
        gameJSON: res.gameJSON,
        htmlString: res.htmlString,
      });
      await Promise.allSettled([
        promptHistoryApi.create({
          gameId: game.id,
          prompt: editPrompt,
          model: res.meta?.model,
          durationMs: res.meta?.durationMs,
          actionType: 'edit',
        }),
        analyticsApi.create({
          eventType: 'game_edited',
          gameId: game.id,
          generationTimeMs: res.meta?.durationMs,
          metadata: { model: res.meta?.model, fallback: res.meta?.fallback },
        }),
      ]);
      setGame(saved);
      setEditPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply edit');
    } finally { setEditing(false); }
  };

  const onDownload = async () => {
    if (!game) return;
    setBusy('download');
    try {
      const blob = await gamesApi.download(game.id);
      const safe = game.title.replace(/[^\w\-. ]+/g, '_').slice(0, 60) || 'game';
      downloadBlob(blob, `${safe}.zip`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Download failed');
    } finally { setBusy(null); }
  };

  const onDelete = async () => {
    if (!game) return;
    if (!confirm(`Delete "${game.title}"? This cannot be undone.`)) return;
    setBusy('delete');
    try {
      await gamesApi.remove(game.id);
      navigate('/games', { replace: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
      setBusy(null);
    }
  };

  if (loading) return <div className="card empty"><span className="spinner" /></div>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!game) return <div className="empty">Game not found.</div>;

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Link to="/games" className="muted" style={{ fontSize: 12 }}>← All games</Link>
          <h1 style={{ margin: '4px 0 4px', fontSize: 22 }}>{game.title}</h1>
          <div className="muted" style={{ fontSize: 12 }}>
            {game.genre || '—'} · {game.dimension || '—'}
            {game.difficulty && ` · ${game.difficulty}`}
            {game.updatedAt && ` · updated ${new Date(game.updatedAt).toLocaleString()}`}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn secondary" disabled={busy === 'download'} onClick={() => void onDownload()}>
            {busy === 'download' ? <span className="spinner" /> : 'Download ZIP'}
          </button>
          <button className="btn danger" disabled={busy === 'delete'} onClick={() => void onDelete()}>
            {busy === 'delete' ? <span className="spinner" /> : 'Delete'}
          </button>
        </div>
      </div>

      {game.description && <div className="muted">{game.description}</div>}

      <GamePreview htmlString={game.htmlString} title={game.title} height={580} />

      <div className="card" style={{ padding: 16 }}>
        <label>Refine with a follow-up prompt</label>
        {generationDisabled && (
          <div className="error-banner" style={{ marginBottom: 8 }}>
            {status === 'offline'
              ? 'Backend unreachable.'
              : `${aiProviderLabel} key is not configured in backend .env. Editing is disabled.`}
          </div>
        )}
        <div className="row" style={{ gap: 8, alignItems: 'stretch' }}>
          <input
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            placeholder="Add a boss enemy at the end; speed up the player"
            onKeyDown={(e) => { if (e.key === 'Enter') void onEdit(); }}
          />
          <button
            className="btn"
            disabled={editing || !editPrompt.trim() || generationDisabled}
            onClick={() => void onEdit()}
          >
            {editing && <span className="spinner" />}
            Apply changes
          </button>
        </div>
      </div>
    </div>
  );
}
