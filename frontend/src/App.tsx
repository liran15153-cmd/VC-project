import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import RequireAuth from './components/RequireAuth';
import LoginPage from './features/auth/LoginPage';
import DashboardPage from './features/dashboard/DashboardPage';
import GameBuilderPage from './features/game-builder/GameBuilderPage';
import GamesListPage from './features/games/GamesListPage';
import GameDetailPage from './features/games/GameDetailPage';
import StatsPage from './features/stats/StatsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/build" element={<GameBuilderPage />} />
        <Route path="/games" element={<GamesListPage />} />
        <Route path="/games/:id" element={<GameDetailPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
