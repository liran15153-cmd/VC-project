import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useHealth } from '../health/HealthContext';
import { setApiBase as persistApiBase } from '../../api/client';
import { supabaseConfigured } from '../../lib/supabase';
import './LoginPage.css';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const { user, login, register, error: authError } = useAuth();
  const { status, apiBase, refresh } = useHealth();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftApi, setDraftApi] = useState(apiBase);
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (user) {
    const redirectTo = (location.state as { from?: { pathname: string } } | null)?.from?.pathname || '/';
    return <Navigate to={redirectTo} replace />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, displayName || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-side">
        <div className="auth-brand">
          <div className="brand-mark big">GVC</div>
          <div>
            <div className="auth-title">Gaming Vibe Coding</div>
            <div className="auth-subtitle">Build full games from a single prompt.</div>
          </div>
        </div>
        <ul className="auth-bullets">
          <li>✦ Describe your idea in plain language</li>
          <li>✦ Answer a few quick questions</li>
          <li>✦ Get a playable game in minutes</li>
          <li>✦ Iterate by chatting — “add enemies”, “make it harder”</li>
        </ul>
      </div>

      <div className="auth-main">
        <div className="card auth-card">
          <div className="auth-tabs">
            <button
              className={`auth-tab${mode === 'login' ? ' active' : ''}`}
              onClick={() => setMode('login')} type="button"
            >Sign in</button>
            <button
              className={`auth-tab${mode === 'register' ? ' active' : ''}`}
              onClick={() => setMode('register')} type="button"
            >Create account</button>
          </div>

          <form onSubmit={submit} className="col" style={{ gap: 14 }}>
            <div>
              <label>Email</label>
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label>Password</label>
              <input
                type="password"
                required minLength={mode === 'register' ? 8 : 1}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
              {mode === 'register' && (
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                  Minimum 8 characters.
                </div>
              )}
            </div>
            {mode === 'register' && (
              <div>
                <label>Display name <span className="muted">(optional)</span></label>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
            )}

            {error && <div className="error-banner">{error}</div>}
            {!supabaseConfigured && (
              <div className="error-banner">
                Supabase is not configured. Add <span className="kbd">VITE_SUPABASE_URL</span> and{' '}
                <span className="kbd">VITE_SUPABASE_PUBLISHABLE_KEY</span> to frontend <span className="kbd">.env</span>.
              </div>
            )}
            {authError && <div className="error-banner">{authError}</div>}
            {status === 'offline' && (
              <div className="error-banner">
                AI backend unreachable at <span className="kbd">{apiBase}</span>. You can still sign in, but generation needs backend on <span className="kbd">localhost:3000</span>.
              </div>
            )}

            <button className="btn" disabled={submitting || !supabaseConfigured}>
              {submitting && <span className="spinner" />}
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="auth-foot">
            <button className="btn ghost sm" type="button" onClick={() => setShowAdvanced((s) => !s)}>
              {showAdvanced ? 'Hide' : 'Configure'} backend URL
            </button>
            {showAdvanced && (
              <div className="col" style={{ gap: 8, marginTop: 8 }}>
                <input value={draftApi} onChange={(e) => setDraftApi(e.target.value)} placeholder="/api or http://localhost:3000/api" />
                <button
                  type="button"
                  className="btn secondary sm"
                  onClick={() => { persistApiBase(draftApi); void refresh(); }}
                >Save & re-check</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
