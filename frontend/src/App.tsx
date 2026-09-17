import { NavLink, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import PlayersPage from "./pages/PlayersPage";
import MatchesPage from "./pages/MatchesPage";
import MatchDetailPage from "./pages/MatchDetailPage";
import ExportPage from "./pages/ExportPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import MatchLivePage from "./pages/MatchLivePage";
import VisitorHome from "./pages/VisitorHome";
import VisitorMatchPage from "./pages/VisitorMatchPage";
import VisitorLivePage from "./pages/VisitorLivePage";
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

function LegacyAdminMatchRedirect() {
  const { id } = useParams();
  return <Navigate to={`/admin/matches/${id}`} replace />;
}

function AppShell() {
  const { username, logout, loading } = useAuth();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const isLogin = location.pathname === "/login";

  return (
    <div className="app">
      <header className="topbar">
        <NavLink to={isAdmin && username ? "/admin" : "/"} className="brand">
          Compo Rugby
        </NavLink>
        <nav>
          {isAdmin && username ? (
            <>
              <NavLink to="/admin" end>
                Matchs
              </NavLink>
              <NavLink to="/admin/players">Joueurs</NavLink>
              <NavLink to="/admin/settings">Paramètres</NavLink>
              <NavLink to="/">Visiteurs</NavLink>
              <span className="user-chip">
                <span className="user-name">{username}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
                  Quitter
                </button>
              </span>
            </>
          ) : (
            <>
              <NavLink to="/" end>
                Accueil
              </NavLink>
              {!loading &&
                (username ? (
                  <NavLink to="/admin">Admin</NavLink>
                ) : (
                  !isLogin && <NavLink to="/login">Staff</NavLink>
                ))}
            </>
          )}
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<VisitorHome />} />
          <Route path="/match/:id" element={<VisitorMatchPage />} />
          <Route path="/match/:id/live" element={<VisitorLivePage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/admin"
            element={
              <Protected>
                <MatchesPage />
              </Protected>
            }
          />
          <Route
            path="/admin/players"
            element={
              <Protected>
                <PlayersPage />
              </Protected>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <Protected>
                <SettingsPage />
              </Protected>
            }
          />
          <Route
            path="/admin/matches/:id"
            element={
              <Protected>
                <MatchDetailPage />
              </Protected>
            }
          />
          <Route
            path="/admin/matches/:id/live"
            element={
              <Protected>
                <MatchLivePage />
              </Protected>
            }
          />
          <Route
            path="/admin/matches/:matchId/export/:compositionId"
            element={
              <Protected>
                <ExportPage />
              </Protected>
            }
          />

          <Route path="/players" element={<Navigate to="/admin/players" replace />} />
          <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
          <Route path="/matches/:id" element={<LegacyAdminMatchRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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
