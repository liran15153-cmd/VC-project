import { useState } from 'react';
import { useHealth } from '../features/health/HealthContext';
import { setApiBase as persistApiBase } from '../api/client';

export default function HealthBadge() {
  const {
    status,
    data,
    apiBase,
    aiConfigured,
    aiProviderLabel,
    aiDefaultModel,
    refresh,
    checking,
  } = useHealth();
  const [open, setOpen] = useState(false);
  const [draftBase, setDraftBase] = useState(apiBase);

  const dot =
    status === 'online' ? 'green' : status === 'offline' ? 'red' : status === 'degraded' ? 'amber' : '';
  const label =
    status === 'online' ? 'Backend online'
    : status === 'offline' ? 'Backend offline'
    : status === 'degraded' ? 'Backend degraded'
    : 'Checking...';

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="badge"
        style={{ cursor: 'pointer' }}
        onClick={() => { setDraftBase(apiBase); setOpen((o) => !o); }}
        title="Backend / AI provider status"
      >
        <span className={`dot ${dot}`} />
        <span className="hide-mobile">{label}</span>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={popOverlay} />
          <div className="card" style={popCard}>
            <div className="row between" style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700 }}>System status</div>
              <button className="btn ghost sm" disabled={checking} onClick={() => void refresh()}>
                {checking ? <span className="spinner" /> : 'Refresh'}
              </button>
            </div>

            <div className="col" style={{ gap: 6, fontSize: 13 }}>
              <Row k="Backend" v={<span><span className={`dot ${dot}`} /> {label}</span>} />
              <Row k="AI" v={
                aiConfigured
                  ? <span className="badge green">configured</span>
                  : <span className="badge red">not configured</span>
              } />
              <Row k="Provider" v={aiProviderLabel} />
              <Row k="Model" v={aiDefaultModel || '-'} />
              <Row k="DB" v={<span className="badge">{data?.services?.database || '-'}</span>} />
              <Row k="Version" v={data?.version || '-'} />
              <Row k="Uptime" v={data?.uptime ? `${Math.floor(data.uptime / 60)}m` : '-'} />
            </div>

            {!aiConfigured && status === 'online' && (
              <div className="error-banner" style={{ marginTop: 10 }}>
                AI key is not configured in backend <span className="kbd">.env</span>. For OpenRouter set
                <span className="kbd">OPENROUTER_API_KEY</span> and restart the backend.
              </div>
            )}
            {status === 'offline' && (
              <div className="error-banner" style={{ marginTop: 10 }}>
                Backend unreachable. Start backend on <span className="kbd">localhost:3000</span>.
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <label>API Base URL</label>
              <div className="row" style={{ gap: 6 }}>
                <input
                  value={draftBase}
                  onChange={(e) => setDraftBase(e.target.value)}
                  placeholder="/api or http://localhost:3000/api"
                />
                <button
                  className="btn sm"
                  onClick={() => {
                    persistApiBase(draftBase);
                    void refresh();
                  }}
                >Save</button>
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                Default uses Vite proxy <span className="kbd">/api</span> to <span className="kbd">localhost:3000</span>.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="row between">
      <span className="muted">{k}</span>
      <span>{v}</span>
    </div>
  );
}

const popOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 20,
};
const popCard: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
  width: 320, padding: 14, zIndex: 21, boxShadow: 'var(--shadow-lg)',
};
