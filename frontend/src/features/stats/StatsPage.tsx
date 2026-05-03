import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { statsApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import type { StatsEvent, StatsResponse } from '../../types/api';

export default function StatsPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<StatsResponse | null>(null);
  const [events, setEvents] = useState<StatsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, e] = await Promise.all([statsApi.overview(), statsApi.events(50)]);
        if (!alive) return;
        setOverview(s);
        setEvents(e.events);
      } catch (err) {
        if (!alive) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setUnauthorized(true);
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load stats');
        }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  if (user && user.role !== 'admin') return <Navigate to="/" replace />;
  if (unauthorized) return <Navigate to="/" replace />;

  const renderValue = (v: unknown): React.ReactNode => {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return String(v);
    return <code style={{ fontSize: 12 }}>{JSON.stringify(v)}</code>;
  };

  return (
    <div className="col" style={{ gap: 16 }}>
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: 22 }}>Admin Stats</h1>
        <div className="muted">Aggregated analytics for the platform.</div>
      </div>

      {loading && <div className="card empty"><span className="spinner" /></div>}
      {error && <div className="error-banner">{error}</div>}

      {overview && (
        <div className="card" style={{ padding: 18 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Overview</h2>
          <div className="stats-overview">
            {Object.entries(overview).map(([k, v]) => (
              <div key={k} className="stats-cell">
                <div className="stats-key">{k}</div>
                <div className="stats-val">{renderValue(v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 18 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Recent events</h2>
        {events.length === 0 && <div className="empty">No events yet.</div>}
        {events.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event</th>
                  <th>User</th>
                  <th>Game</th>
                  <th>Duration</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={e.id ?? i}>
                    <td>{e.createdAt ? new Date(e.createdAt).toLocaleTimeString() : '—'}</td>
                    <td><span className="badge">{e.eventType}</span></td>
                    <td className="muted">{e.userId ? String(e.userId).slice(0, 8) : '—'}</td>
                    <td className="muted">{e.gameId ? String(e.gameId).slice(0, 8) : '—'}</td>
                    <td>{e.generationTimeMs ? `${e.generationTimeMs}ms` : '—'}</td>
                    <td className="danger" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.errorMessage || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .stats-overview {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
        }
        .stats-cell {
          background: var(--gray-25);
          border: 1px solid var(--gray-100);
          border-radius: 8px;
          padding: 10px 12px;
        }
        .stats-key { font-size: 11px; color: var(--gray-500); text-transform: uppercase; letter-spacing: 0.4px; font-weight: 700; }
        .stats-val { font-size: 18px; font-weight: 700; margin-top: 2px; word-break: break-all; }
        .stats-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .stats-table th, .stats-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--gray-100); }
        .stats-table th { font-size: 11px; color: var(--gray-500); text-transform: uppercase; letter-spacing: 0.4px; }
      `}</style>
    </div>
  );
}
