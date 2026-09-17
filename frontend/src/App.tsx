import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import PlayersPage from "./pages/PlayersPage";
import MatchesPage from "./pages/MatchesPage";
import MatchDetailPage from "./pages/MatchDetailPage";
import ExportPage from "./pages/ExportPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import MatchLivePage from "./pages/MatchLivePage";
import InstallBanner from "./components/InstallBanner";

function Protected({ children }: { children: React.ReactNode }) {
  const { username, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="empty">Chargement…</p>;
  if (!username) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

function AppShell() {
  const { username, logout } = useAuth();
  const location = useLocation();
  const isLogin = location.pathname === "/login";

  if (isLogin) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          Compo Rugby
        </NavLink>
        <nav>
          <NavLink to="/" end>
            Matchs
          </NavLink>
          <NavLink to="/players">Joueurs</NavLink>
          <NavLink to="/settings">Paramètres</NavLink>
          {username && (
            <span className="user-chip">
              <span className="user-name">{username}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
                Quitter
              </button>
            </span>
          )}
        </nav>
      </header>
      <main className="main">
        <Protected>
          <Routes>
            <Route path="/" element={<MatchesPage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/matches/:id" element={<MatchDetailPage />} />
            <Route path="/matches/:id/live" element={<MatchLivePage />} />
            <Route
              path="/matches/:matchId/export/:compositionId"
              element={<ExportPage />}
            />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Protected>
        <InstallBanner />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
