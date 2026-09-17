import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { computeRemainingMs, formatClock, parseUtcMs } from "../clock";
import type { Match, MatchEvent, MatchEventType, MatchTeam, Player } from "../types";
import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_POINTS,
  playerDisplayName,
  playerShortName,
} from "../types";
import "./MatchLivePage.css";

function elapsedMinute(durationMin: number, remainingMs: number): number {
  const elapsedSec = durationMin * 60 - Math.ceil(remainingMs / 1000);
  return Math.max(0, Math.min(120, Math.floor(elapsedSec / 60)));
}

function playEndSignal() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([400, 120, 400, 120, 700]);
    }
  } catch {
    /* ignore */
  }
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [0, 0.35, 0.7].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = i === 2 ? 880 : 660;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.35, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.3);
    });
    window.setTimeout(() => ctx.close().catch(() => undefined), 1500);
  } catch {
    /* ignore */
  }
}

const EVENT_TYPES = Object.keys(EVENT_TYPE_LABELS) as MatchEventType[];

export default function MatchLivePage() {
  const { id } = useParams();
  const matchId = Number(id);

  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingEvent, setSavingEvent] = useState(false);

  const [half, setHalf] = useState<1 | 2>(1);
  const [durationMin, setDurationMin] = useState(35);
  const [remainingMs, setRemainingMs] = useState(35 * 60_000);
  const [running, setRunning] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const remainingAtStartRef = useRef(35 * 60_000);
  const endedRef = useRef(false);

  const [formTeam, setFormTeam] = useState<MatchTeam>("home");
  const [formType, setFormType] = useState<MatchEventType>("essai");
  const [formPlayerId, setFormPlayerId] = useState<number | "">("");
  const [formMinute, setFormMinute] = useState(0);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, evs, pls] = await Promise.all([
        api.getMatch(matchId),
        api.getMatchEvents(matchId),
        api.getPlayers(),
      ]);
      setMatch(m);
      setEvents(evs);
      setPlayers(pls);
      const dur = m.half_duration_minutes || 35;
      setDurationMin(dur);
      const halfVal = m.clock_half === 2 ? 2 : 1;
      setHalf(halfVal);

      const left = computeRemainingMs(m);
      setRemainingMs(left);

      if (m.clock_running && m.clock_started_at && left > 0) {
        // Reprendre exactement l’instant de départ serveur (pas de rebase)
        const started = parseUtcMs(m.clock_started_at) ?? Date.now();
        remainingAtStartRef.current = m.clock_remaining_ms ?? dur * 60_000;
        startedAtRef.current = started;
        setRunning(true);
        endedRef.current = false;
      } else if (m.clock_running && left <= 0) {
        remainingAtStartRef.current = 0;
        startedAtRef.current = null;
        setRunning(false);
        endedRef.current = true;
        void api.updateMatchClock(matchId, {
          clock_half: halfVal,
          clock_remaining_ms: 0,
          clock_running: false,
        });
      } else {
        remainingAtStartRef.current = left;
        startedAtRef.current = null;
        setRunning(false);
      }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  const syncClock = useCallback(
    async (next: {
      half: 1 | 2;
      remainingMs: number;
      running: boolean;
    }) => {
      try {
        const updated = await api.updateMatchClock(matchId, {
          clock_half: next.half,
          clock_remaining_ms: Math.max(0, Math.round(next.remainingMs)),
          clock_running: next.running,
        });
        setMatch(updated);
        // Aligner les refs sur la réponse serveur (started_at UTC)
        if (updated.clock_running && updated.clock_started_at) {
          const started = parseUtcMs(updated.clock_started_at);
          if (started != null) {
            remainingAtStartRef.current = updated.clock_remaining_ms;
            startedAtRef.current = started;
          }
        }
        return updated;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur sync chrono");
        return null;
      }
    },
    [matchId],
  );

  useEffect(() => {
    if (!Number.isFinite(matchId)) return;
    load();
  }, [matchId, load]);

  // Tick chrono
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const start = startedAtRef.current;
      if (start == null) return;
      const left = Math.max(0, remainingAtStartRef.current - (Date.now() - start));
      setRemainingMs(left);
      if (left <= 0) {
        setRunning(false);
        startedAtRef.current = null;
        void syncClock({ half, remainingMs: 0, running: false });
        if (!endedRef.current) {
          endedRef.current = true;
          playEndSignal();
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [running, half, syncClock]);

  const clockLabel = formatClock(remainingMs);
  const progress = useMemo(() => {
    const total = durationMin * 60_000;
    return total <= 0 ? 0 : Math.min(1, 1 - remainingMs / total);
  }, [durationMin, remainingMs]);

  const startPause = async () => {
    if (running) {
      const start = startedAtRef.current;
      const left =
        start == null
          ? remainingMs
          : Math.max(0, remainingAtStartRef.current - (Date.now() - start));
      setRemainingMs(left);
      remainingAtStartRef.current = left;
      startedAtRef.current = null;
      setRunning(false);
      await syncClock({ half, remainingMs: left, running: false });
      return;
    }
    if (remainingMs <= 0) return;
    endedRef.current = false;
    const base = remainingMs;
    remainingAtStartRef.current = base;
    startedAtRef.current = Date.now();
    setRunning(true);
    const updated = await syncClock({ half, remainingMs: base, running: true });
    if (!updated) {
      // Sync échouée : on garde le chrono local quand même
      return;
    }
  };

  const resetHalf = () => {
    setRunning(false);
    startedAtRef.current = null;
    endedRef.current = false;
    const ms = durationMin * 60_000;
    remainingAtStartRef.current = ms;
    setRemainingMs(ms);
    void syncClock({ half, remainingMs: ms, running: false });
  };

  const changeHalf = (next: 1 | 2) => {
    if (next === half) return;
    setHalf(next);
    setRunning(false);
    startedAtRef.current = null;
    endedRef.current = false;
    const ms = durationMin * 60_000;
    remainingAtStartRef.current = ms;
    setRemainingMs(ms);
    void syncClock({ half: next, remainingMs: ms, running: false });
  };

  const applyDuration = async (minutes: number) => {
    const mins = Math.max(1, Math.min(60, minutes || 35));
    setDurationMin(mins);
    setRunning(false);
    startedAtRef.current = null;
    endedRef.current = false;
    const ms = mins * 60_000;
    remainingAtStartRef.current = ms;
    setRemainingMs(ms);
    if (!match) return;
    try {
      const updated = await api.updateMatch(match.id, { half_duration_minutes: mins });
      setMatch(updated);
      await syncClock({ half, remainingMs: ms, running: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur durée");
    }
  };

  const openEventForm = (team: MatchTeam, type: MatchEventType = "essai") => {
    setFormTeam(team);
    setFormType(type);
    setFormPlayerId("");
    setFormMinute(elapsedMinute(durationMin, remainingMs));
    setFormOpen(true);
  };

  const submitEvent = async (e: FormEvent) => {
    e.preventDefault();
    if (!match) return;
    setSavingEvent(true);
    try {
      await api.createMatchEvent(match.id, {
        half,
        minute: formMinute,
        event_type: formType,
        team: formTeam,
        player_id: formTeam === "home" && formPlayerId !== "" ? Number(formPlayerId) : null,
      });
      const [m, evs] = await Promise.all([
        api.getMatch(match.id),
        api.getMatchEvents(match.id),
      ]);
      setMatch(m);
      setEvents(evs);
      setFormOpen(false);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingEvent(false);
    }
  };

  const removeEvent = async (eventId: number) => {
    if (!confirm("Supprimer cet événement ?")) return;
    try {
      await api.deleteMatchEvent(eventId);
      const [m, evs] = await Promise.all([
        api.getMatch(matchId),
        api.getMatchEvents(matchId),
      ]);
      setMatch(m);
      setEvents(evs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const sortedPlayers = useMemo(
    () =>
      players
        .slice()
        .sort((a, b) =>
          (a.last_name || a.first_name).localeCompare(b.last_name || b.first_name, "fr"),
        ),
    [players],
  );

  if (loading) return <p className="empty">Chargement du mode match…</p>;
  if (!match) return <p className="empty">Match introuvable.</p>;

  const scoreUs = match.score_home ?? 0;
  const scoreThem = match.score_away ?? 0;

  return (
    <div className="live-page">
      <p style={{ marginBottom: "0.5rem" }}>
        <Link className="linkish" to={`/admin/matches/${match.id}`}>
          ← Compositions
        </Link>
        {" · "}
        <Link className="linkish" to="/admin">
          Matchs
        </Link>
      </p>

      <header className="live-header">
        <p className="live-eyebrow">Mode match</p>
        <h1 className="page-title">vs {match.opponent}</h1>
        <div className="live-scoreboard">
          <div className="live-score-side">
            <span className="live-score-label">Nous</span>
            <span className="live-score-value">{scoreUs}</span>
          </div>
          <span className="live-score-sep">–</span>
          <div className="live-score-side">
            <span className="live-score-label">{match.opponent}</span>
            <span className="live-score-value">{scoreThem}</span>
          </div>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="live-timer panel">
        <div className="live-half-tabs">
          <button
            type="button"
            className={`btn btn-sm ${half === 1 ? "btn-primary" : "btn-ghost"}`}
            onClick={() => changeHalf(1)}
          >
            1ère mi-temps
          </button>
          <button
            type="button"
            className={`btn btn-sm ${half === 2 ? "btn-primary" : "btn-ghost"}`}
            onClick={() => changeHalf(2)}
          >
            2ème mi-temps
          </button>
        </div>

        <div className={`live-clock ${remainingMs <= 0 ? "ended" : ""} ${running ? "running" : ""}`}>
          {clockLabel}
        </div>
        <div className="live-progress" aria-hidden="true">
          <div className="live-progress-bar" style={{ width: `${progress * 100}%` }} />
        </div>

        <div className="live-timer-actions">
          <button type="button" className="btn btn-primary" onClick={startPause}>
            {running ? "Pause" : remainingMs <= 0 ? "Terminé" : "Démarrer"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={resetHalf}>
            Remettre à zéro
          </button>
        </div>

        <div className="live-duration">
          <label htmlFor="half-duration">Durée mi-temps (min)</label>
          <input
            id="half-duration"
            type="number"
            min={1}
            max={60}
            value={durationMin}
            disabled={running}
            onChange={(e) => setDurationMin(Number(e.target.value) || 35)}
            onBlur={(e) => applyDuration(Number(e.target.value) || 35)}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={running}
            onClick={() => applyDuration(durationMin)}
          >
            Appliquer
          </button>
        </div>
        <p className="bench-hint" style={{ marginBottom: 0 }}>
          Vibration + sonnerie à la fin. Le chrono est conservé si vous quittez la page.
        </p>
      </section>

      <section className="live-actions panel">
        <h2>Marquer un point</h2>
        <div className="live-action-grid">
          <button type="button" className="btn btn-primary" onClick={() => openEventForm("home", "essai")}>
            Essai (nous)
          </button>
          <button type="button" className="btn btn-accent" onClick={() => openEventForm("away", "essai")}>
            Essai (eux)
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => openEventForm("home", "transformation")}>
            Transfo (nous)
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => openEventForm("away", "transformation")}>
            Transfo (eux)
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => openEventForm("home", "penalite")}>
            Pénalité (nous)
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => openEventForm("away", "penalite")}>
            Pénalité (eux)
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => openEventForm("home", "drop")}>
            Drop (nous)
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => openEventForm("away", "drop")}>
            Drop (eux)
          </button>
        </div>
      </section>

      <section className="live-timeline panel">
        <h2>Évolution du score</h2>
        {events.length === 0 ? (
          <p className="empty">Aucun événement pour l’instant.</p>
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
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => removeEvent(ev.id)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {formOpen && (
        <div
          className="slot-modal-backdrop"
          role="presentation"
          onClick={() => setFormOpen(false)}
        >
          <form
            className="slot-modal panel"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitEvent}
          >
            <div className="slot-modal-head">
              <h2>
                {formTeam === "home" ? "Nous" : match.opponent} —{" "}
                {EVENT_TYPE_LABELS[formType]}
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setFormOpen(false)}
              >
                Fermer
              </button>
            </div>

            <div className="field" style={{ marginBottom: "0.75rem" }}>
              <label htmlFor="ev-type">Type</label>
              <select
                id="ev-type"
                value={formType}
                onChange={(e) => setFormType(e.target.value as MatchEventType)}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EVENT_TYPE_LABELS[t]} (+{EVENT_TYPE_POINTS[t]})
                  </option>
                ))}
              </select>
            </div>

            <div className="field" style={{ marginBottom: "0.75rem" }}>
              <label htmlFor="ev-minute">Minute (mi-temps {half})</label>
              <input
                id="ev-minute"
                type="number"
                min={0}
                max={120}
                value={formMinute}
                onChange={(e) => setFormMinute(Number(e.target.value) || 0)}
              />
            </div>

            {formTeam === "home" && (
              <div className="field" style={{ marginBottom: "0.75rem" }}>
                <label htmlFor="ev-player">Joueur (optionnel)</label>
                <select
                  id="ev-player"
                  value={formPlayerId}
                  onChange={(e) =>
                    setFormPlayerId(e.target.value === "" ? "" : Number(e.target.value))
                  }
                >
                  <option value="">— Non précisé —</option>
                  {sortedPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.number || "·"} {playerDisplayName(p)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="slot-modal-actions" style={{ marginTop: "0.5rem" }}>
              <button type="submit" className="btn btn-primary" disabled={savingEvent}>
                {savingEvent ? "Enregistrement…" : "Valider"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
