import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { computeRemainingMs, formatClock, halfLabel } from "../clock";
import type { Match, MatchEvent } from "../types";
import { EVENT_TYPE_LABELS, playerShortName } from "../types";
import "./MatchLivePage.css";

const POLL_MS = 3000;

export default function VisitorLivePage() {
  const { id } = useParams();
  const matchId = Number(id);
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [remainingMs, setRemainingMs] = useState(0);
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
      setRemainingMs(computeRemainingMs(m));
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

  // Tick local entre deux polls
  useEffect(() => {
    if (!match?.clock_running) return;
    const id = window.setInterval(() => {
      setRemainingMs(computeRemainingMs(match));
    }, 250);
    return () => window.clearInterval(id);
  }, [match]);

  if (loading) return <p className="empty">Chargement du direct…</p>;
  if (!match) return <p className="empty">Match introuvable.</p>;

  const half = match.clock_half === 2 ? 2 : 1;
  const running = !!match.clock_running && remainingMs > 0;

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
      </header>

      {error && <div className="error">{error}</div>}

      <section className="live-timer panel">
        <p className="live-visitor-half">{halfLabel(half)}</p>
        <div
          className={`live-clock ${remainingMs <= 0 ? "ended" : ""} ${running ? "running" : ""}`}
        >
          {formatClock(remainingMs)}
        </div>
        <p className="bench-hint" style={{ textAlign: "center", marginBottom: 0 }}>
          {running
            ? "Chrono en cours (sync avec le staff)"
            : remainingMs <= 0
              ? "Fin de mi-temps"
              : "Chrono en pause"}
          {" · "}actualisation {POLL_MS / 1000} s
        </p>
      </section>

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
