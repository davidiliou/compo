import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Match } from "../types";
import { getMatchFormat } from "../types";
import "./VisitorHome.css";

function isUpcoming(m: Match, today: string) {
  return m.match_date >= today;
}

export default function VisitorHome() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [upcoming, setUpcoming] = useState<Match | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [all, next] = await Promise.all([
          api.publicGetMatches(),
          api.publicGetUpcoming(),
        ]);
        setMatches(all);
        setUpcoming(next);
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const past = useMemo(
    () => matches.filter((m) => !isUpcoming(m, today)),
    [matches, today],
  );

  if (loading) return <p className="empty">Chargement…</p>;

  return (
    <div className="visitor-home">
      <header className="visitor-hero">
        <img className="visitor-logo" src="/logo.png" alt="Costières XV" width={140} height={140} />
        <p className="visitor-eyebrow">Espace supporters</p>
        <h1 className="page-title">Compo Rugby</h1>
        <p className="page-sub">
          Prochain match, compositions publiques et suivi du score en direct.
        </p>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="panel visitor-next">
        <h2>Prochain match</h2>
        {!upcoming ? (
          <p className="empty">Aucun match à venir pour le moment.</p>
        ) : (
          <article className="visitor-next-card">
            <div>
              <p className="visitor-next-vs">vs {upcoming.opponent}</p>
              <p className="visitor-next-meta">
                {new Date(upcoming.match_date).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}{" "}
                · {upcoming.venue} · {getMatchFormat(upcoming.team_size).shortLabel}
              </p>
            </div>
            <div className="visitor-next-actions">
              <Link className="btn btn-primary" to={`/match/${upcoming.id}`}>
                Voir le match
              </Link>
              <Link className="btn btn-accent" to={`/match/${upcoming.id}/live`}>
                Suivre en direct
              </Link>
            </div>
          </article>
        )}
      </section>

      <section className="panel" style={{ marginTop: "1.25rem" }}>
        <h2>Matchs passés</h2>
        {past.length === 0 ? (
          <p className="empty">Aucun match passé.</p>
        ) : (
          <div className="card-list visitor-past">
            {past.map((m) => (
              <article key={m.id} className="data-card">
                <div className="data-card-head">
                  <Link className="linkish" to={`/match/${m.id}`}>
                    vs {m.opponent}
                  </Link>
                  <span className="score">
                    {m.score_home ?? "—"} – {m.score_away ?? "—"}
                  </span>
                </div>
                <p className="data-card-meta">
                  {new Date(m.match_date).toLocaleDateString("fr-FR")} · {m.venue} ·{" "}
                  {getMatchFormat(m.team_size).shortLabel}
                </p>
                <div className="row-actions">
                  <Link className="btn btn-ghost btn-sm" to={`/match/${m.id}`}>
                    Composition
                  </Link>
                  <Link className="btn btn-ghost btn-sm" to={`/match/${m.id}/live`}>
                    Feuille de match
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
