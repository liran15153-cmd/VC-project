import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import HealthBadge from './HealthBadge';
import TokenBadge from './TokenBadge';
import './AppLayout.css';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">GVC</div>
          <div className="brand-text">
            <div className="brand-title">Gaming Vibe</div>
            <div className="brand-sub">AI Game Builder</div>
          </div>
        </div>

        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">⌂</span> Dashboard
          </NavLink>
          <NavLink to="/build" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">✨</span> Build a Game
          </NavLink>
          <NavLink to="/games" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">▦</span> My Games
          </NavLink>
          {isAdmin && (
            <NavLink to="/stats" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">∷</span> Admin Stats
            </NavLink>
          )}
        </nav>

        <div className="sidebar-foot">
          <div className="user-card">
            <div className="user-avatar">
              {(user?.displayName || user?.email || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="user-meta">
              <div className="user-name">{user?.displayName || user?.email}</div>
              <div className="user-role">{user?.role || 'user'}</div>
            </div>
            <button
              className="btn ghost sm"
              onClick={async () => { await logout(); navigate('/login'); }}
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-spacer" />
          <div className="topbar-right">
            <TokenBadge />
            <HealthBadge />
          </div>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
