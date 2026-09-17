import { NavLink, Route, Routes } from "react-router-dom";
import PlayersPage from "./pages/PlayersPage";
import MatchesPage from "./pages/MatchesPage";
import MatchDetailPage from "./pages/MatchDetailPage";

export default function App() {
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
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<MatchesPage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/matches/:id" element={<MatchDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}
