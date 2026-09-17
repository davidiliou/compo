import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import type { Match, MatchEvent } from "../types";
import { EVENT_TYPE_LABELS, playerShortName } from "../types";
import "./MatchLivePage.css";

const POLL_MS = 5000;

export default function VisitorLivePage() {
  const { id } = useParams();
  const matchId = Number(id);
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [m, evs] = await Promise.all([
        api.publicGetMatch(matchId),
        api.publicGetEvents(matchId),
      ]);
      setMatch(m);
      setEvents(evs);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    if (!Number.isFinite(matchId)) return;
    load();
    const t = window.setInterval(() => load(true), POLL_MS);
    return () => window.clearInterval(t);
  }, [matchId, load]);

  if (loading) return <p className="empty">Chargement du direct…</p>;
  if (!match) return <p className="empty">Match introuvable.</p>;

  return (
    <div className="live-page">
      <p style={{ marginBottom: "0.5rem" }}>
        <Link className="linkish" to={`/match/${match.id}`}>
          ← Composition
        </Link>
        {" · "}
        <Link className="linkish" to="/">
          Accueil
        </Link>
      </p>

      <header className="live-header">
        <p className="live-eyebrow">Suivi en direct</p>
        <h1 className="page-title">vs {match.opponent}</h1>
        <div className="live-scoreboard">
          <div className="live-score-side">
            <span className="live-score-label">Nous</span>
            <span className="live-score-value">{match.score_home ?? 0}</span>
          </div>
          <span className="live-score-sep">–</span>
          <div className="live-score-side">
            <span className="live-score-label">{match.opponent}</span>
            <span className="live-score-value">{match.score_away ?? 0}</span>
          </div>
        </div>
        <p className="bench-hint" style={{ textAlign: "center", marginTop: "0.75rem" }}>
          Actualisation automatique toutes les {POLL_MS / 1000} s
        </p>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="live-timeline panel">
        <h2>Évolution du score</h2>
        {events.length === 0 ? (
          <p className="empty">Aucun point encore inscrit.</p>
        ) : (
          <ol className="live-timeline-list">
            {events.map((ev) => {
              const label = EVENT_TYPE_LABELS[ev.event_type] || ev.event_type;
              const who =
                ev.team === "home"
                  ? ev.player
                    ? playerShortName(ev.player)
                    : "Nous"
                  : match.opponent;
              return (
                <li key={ev.id} className={`live-event ${ev.team}`}>
                  <div className="live-event-main">
                    <span className="live-event-time">
                      MT{ev.half} · {ev.minute}&apos;
                    </span>
                    <span className="live-event-type">
                      {label} (+{ev.points})
                    </span>
                    <span className="live-event-who">{who}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
