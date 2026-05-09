import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useHealth } from '../health/HealthContext';
import { gamesApi } from '../../api/endpoints';
import type { SavedGame } from '../../types/api';

export default function DashboardPage() {
  const { user, tokens } = useAuth();
  const { status, aiConfigured, aiProviderLabel } = useHealth();
  const [recent, setRecent] = useState<SavedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await gamesApi.list({ limit: 6, orderBy: 'updated_at' });
        if (alive) setRecent(res.items);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Failed to load games');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="col" style={{ gap: 24 }}>
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: 24 }}>
          Welcome{user?.displayName ? `, ${user.displayName}` : ''}
        </h1>
        <div className="muted">Build a full game from a single prompt — answer a few questions and you’re playing in minutes.</div>
      </div>

      {status === 'offline' && (
        <div className="error-banner">Backend unreachable. Start backend on <span className="kbd">localhost:3000</span>.</div>
      )}
      {status !== 'offline' && !aiConfigured && (
        <div className="error-banner">
          {aiProviderLabel} key is not configured in backend <span className="kbd">.env</span>. For OpenRouter set <span className="kbd">OPENROUTER_API_KEY</span>.
        </div>
      )}

      <div className="dashboard-grid">
        <Link to="/build" className="card cta-card">
          <div className="cta-eyebrow">Start here</div>
          <h2 className="cta-title">Create a new game</h2>
          <p className="cta-text">Describe what you want to play. AI will ask a few quick questions and generate a playable game.</p>
          <div className="btn" style={{ alignSelf: 'flex-start' }}>+ New Game</div>
        </Link>

        <div className="card stat-card">
          <div className="stat-label">Tokens remaining</div>
          <div className="stat-value">
            {tokens?.tokensRemaining ?? '—'}
            <span className="muted" style={{ fontSize: 14, fontWeight: 500 }}> / {tokens?.tokensTotal ?? '—'}</span>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Plan: <span style={{ textTransform: 'capitalize' }}>{tokens?.subscription || 'free'}</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">My games</div>
          <div className="stat-value">{loading ? '—' : recent.length}{!loading && recent.length === 6 && '+'}</div>
          <Link className="btn ghost sm" to="/games" style={{ alignSelf: 'flex-start', marginTop: 6 }}>View all →</Link>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Recent games</h2>
          <Link to="/games" className="btn ghost sm">All games →</Link>
        </div>

        {loading && <div className="empty"><span className="spinner" /></div>}
        {!loading && error && <div className="error-banner">{error}</div>}
        {!loading && !error && recent.length === 0 && (
          <div className="empty">
            <div style={{ fontSize: 36, marginBottom: 8 }}>🎮</div>
            No games yet. <Link to="/build">Build your first game →</Link>
          </div>
        )}
        {!loading && recent.length > 0 && (
          <div className="games-grid">
            {recent.map((g) => (
              <Link key={g.id} to={`/games/${g.id}`} className="game-tile">
                <div className="game-tile-thumb">
                  <span>{(g.title || 'Untitled').slice(0, 1).toUpperCase()}</span>
                </div>
                <div className="game-tile-meta">
                  <div className="game-tile-title">{g.title}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {g.genre || '—'} · {g.dimension || '—'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <style>{dashboardCss}</style>
    </div>
  );
}

const dashboardCss = `
.dashboard-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 16px;
}
@media (max-width: 860px) {
  .dashboard-grid { grid-template-columns: 1fr; }
}

.cta-card {
  padding: 22px;
  background: linear-gradient(135deg, #fff 0%, var(--orange-50) 100%);
  border: 1px solid var(--orange-100);
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-decoration: none;
  color: inherit;
}
.cta-card:hover { text-decoration: none; box-shadow: var(--shadow); }
.cta-eyebrow {
  font-size: 11px; font-weight: 700; letter-spacing: 0.6px;
  text-transform: uppercase; color: var(--orange-700);
}
.cta-title { margin: 0; font-size: 22px; }
.cta-text { margin: 0 0 8px; color: var(--gray-700); font-size: 14px; }

.stat-card {
  padding: 18px 20px;
  display: flex; flex-direction: column; gap: 4px;
}
.stat-label { font-size: 12px; color: var(--gray-500); font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
.stat-value { font-size: 26px; font-weight: 700; }

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.game-tile {
  display: flex; gap: 12px; align-items: center;
  padding: 10px;
  border: 1px solid var(--gray-200);
  border-radius: 10px;
  background: #fff;
  text-decoration: none;
  color: inherit;
  transition: border-color 120ms, box-shadow 120ms;
}
.game-tile:hover { border-color: var(--orange-300); box-shadow: var(--shadow-sm); text-decoration: none; }
.game-tile-thumb {
  width: 48px; height: 48px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--orange-100), var(--orange-50));
  color: var(--orange-700);
  display: grid; place-items: center;
  font-weight: 700;
  flex: 0 0 auto;
}
.game-tile-title { font-weight: 600; font-size: 14px; }
`;
