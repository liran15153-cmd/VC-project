import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { gamesApi } from '../../api/endpoints';
import { downloadBlob } from '../../api/client';
import type { SavedGame } from '../../types/api';

export default function GamesListPage() {
  const [games, setGames] = useState<SavedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, 'delete' | 'download' | undefined>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await gamesApi.list({ limit: 100, orderBy: 'updated_at' });
      setGames(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load games');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const onDelete = async (g: SavedGame) => {
    if (!confirm(`Delete "${g.title}"? This cannot be undone.`)) return;
    setBusy((b) => ({ ...b, [g.id]: 'delete' }));
    try {
      await gamesApi.remove(g.id);
      setGames((list) => list.filter((x) => x.id !== g.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy((b) => ({ ...b, [g.id]: undefined }));
    }
  };

  const onDownload = async (g: SavedGame) => {
    setBusy((b) => ({ ...b, [g.id]: 'download' }));
    try {
      const blob = await gamesApi.download(g.id);
      const safe = g.title.replace(/[^\w\-. ]+/g, '_').slice(0, 60) || 'game';
      downloadBlob(blob, `${safe}.zip`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setBusy((b) => ({ ...b, [g.id]: undefined }));
    }
  };

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 22 }}>My games</h1>
          <div className="muted">All the games you’ve generated.</div>
        </div>
        <Link to="/build" className="btn">+ New Game</Link>
      </div>

      {loading && <div className="card empty"><span className="spinner" /></div>}
      {error && <div className="error-banner">{error}</div>}

      {!loading && !error && games.length === 0 && (
        <div className="card empty" style={{ padding: 56 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎮</div>
          You haven’t built any games yet.
          <div style={{ marginTop: 12 }}>
            <Link to="/build" className="btn">Build your first game</Link>
          </div>
        </div>
      )}

      {games.length > 0 && (
        <div className="games-list">
          {games.map((g) => {
            const b = busy[g.id];
            return (
              <div key={g.id} className="card game-row">
                <Link to={`/games/${g.id}`} className="game-row-main">
                  <div className="game-tile-thumb" aria-hidden>
                    <span>{(g.title || '?').slice(0, 1).toUpperCase()}</span>
                  </div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="game-row-title">{g.title}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {g.genre || '—'} · {g.dimension || '—'}
                      {g.difficulty && ` · ${g.difficulty}`}
                      {g.updatedAt && ` · updated ${new Date(g.updatedAt).toLocaleDateString()}`}
                    </div>
                  </div>
                </Link>
                <div className="row" style={{ gap: 6 }}>
                  <Link to={`/games/${g.id}`} className="btn secondary sm">Open</Link>
                  <button className="btn secondary sm" disabled={!!b} onClick={() => void onDownload(g)}>
                    {b === 'download' ? <span className="spinner" /> : 'Download'}
                  </button>
                  <button className="btn danger sm" disabled={!!b} onClick={() => void onDelete(g)}>
                    {b === 'delete' ? <span className="spinner" /> : 'Delete'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .games-list { display: flex; flex-direction: column; gap: 8px; }
        .game-row {
          display: flex; align-items: center; gap: 12px; padding: 10px 14px;
          flex-wrap: wrap;
        }
        .game-row-main {
          display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;
          color: inherit; text-decoration: none;
        }
        .game-row-main:hover { text-decoration: none; }
        .game-row-title { font-weight: 600; }
        .game-tile-thumb {
          width: 40px; height: 40px;
          border-radius: 8px;
          background: linear-gradient(135deg, var(--orange-100), var(--orange-50));
          color: var(--orange-700);
          display: grid; place-items: center;
          font-weight: 700;
          flex: 0 0 auto;
        }
      `}</style>
    </div>
  );
}
