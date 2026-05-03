import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useHealth } from '../health/HealthContext';

export default function DashboardPage() {
  const { user, tokens } = useAuth();
  const { status, aiConfigured, aiProviderLabel } = useHealth();

  return (
    <div className="col" style={{ gap: 24 }}>
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: 24 }}>
          Welcome{user?.displayName ? `, ${user.displayName}` : ''}
        </h1>
        <div className="muted">Build a full game from a single prompt, answer a few questions, and play in minutes.</div>
      </div>

      {status === 'offline' && (
        <div className="error-banner">Backend unreachable. Start backend on <span className="kbd">localhost:3000</span>.</div>
      )}
      {status !== 'offline' && !aiConfigured && (
        <div className="error-banner">
          {aiProviderLabel} key is not configured in backend <span className="kbd">.env</span>. Local fallback previews are still available.
        </div>
      )}

      <div className="dashboard-grid">
        <Link to="/build" className="card cta-card">
          <div className="cta-eyebrow">Start here</div>
          <h2 className="cta-title">Create a new game</h2>
          <p className="cta-text">Describe what you want to play. AI will ask a few quick questions and generate a playable preview.</p>
          <div className="btn" style={{ alignSelf: 'flex-start' }}>+ New Game</div>
        </Link>

        <div className="card stat-card">
          <div className="stat-label">Tokens</div>
          <div className="stat-value">
            {tokens?.tokensRemaining ?? 0}
            <span className="muted" style={{ fontSize: 14, fontWeight: 500 }}> / {tokens?.tokensTotal ?? 0}</span>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Supabase will own token balances.
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">Persistence</div>
          <div className="stat-value" style={{ fontSize: 22 }}>Supabase</div>
          <div className="muted" style={{ fontSize: 12 }}>Local CRUD is paused during integration.</div>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Current status</h2>
          <Link to="/build" className="btn ghost sm">Build preview</Link>
        </div>
        <div className="empty">
          Game saving, auth, token ledger, and dashboard lists are waiting for Supabase. The game generator and playable iframe preview are available now.
        </div>
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
`;
