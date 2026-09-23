import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { formatClock } from "../clock";
import type { TrainingExercise, TrainingTemplate } from "../types";
import "./TrainingPages.css";
import "./TrainingSessionPage.css";

function playEndSignal() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([400, 120, 400, 120, 700]);
    }
  } catch {
    /* ignore */
  }
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
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

type ExerciseStatus = "pending" | "running" | "done";

export default function TrainingSessionPage() {
  const { templateId } = useParams();
  const id = Number(templateId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const seasonId = searchParams.get("season");

  const [template, setTemplate] = useState<TrainingTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [live, setLive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [statuses, setStatuses] = useState<ExerciseStatus[]>([]);
  const [remainingMs, setRemainingMs] = useState(0);
  const [running, setRunning] = useState(false);

  const startedAtRef = useRef<number | null>(null);
  const remainingAtStartRef = useRef(0);
  const endedRef = useRef(false);

  const exercises = useMemo(
    () =>
      [...(template?.exercises || [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      ),
    [template],
  );

  const current: TrainingExercise | null = exercises[currentIndex] ?? null;
  const allDone = statuses.length > 0 && statuses.every((s) => s === "done");
  const currentDone = statuses[currentIndex] === "done";
  const hasNext = currentIndex < exercises.length - 1;

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) {
      setError("Entraînement invalide");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const tpl = await api.getTrainingTemplate(id);
      setTemplate(tpl);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      if (startedAtRef.current == null) return;
      const left = Math.max(
        0,
        remainingAtStartRef.current - (Date.now() - startedAtRef.current),
      );
      setRemainingMs(left);
      if (left <= 0 && !endedRef.current) {
        endedRef.current = true;
        setRunning(false);
        startedAtRef.current = null;
        setStatuses((prev) =>
          prev.map((s, i) => (i === currentIndex ? "done" : s)),
        );
        playEndSignal();
      }
    };
    tick();
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [running, currentIndex]);

  const startSession = () => {
    if (exercises.length === 0) return;
    const initial = exercises.map(() => "pending" as ExerciseStatus);
    initial[0] = "running";
    setStatuses(initial);
    setCurrentIndex(0);
    const ms = Math.max(1, exercises[0].duration_minutes) * 60_000;
    remainingAtStartRef.current = ms;
    startedAtRef.current = Date.now();
    endedRef.current = false;
    setRemainingMs(ms);
    setRunning(true);
    setLive(true);
  };

  const pauseCurrent = () => {
    if (!running) return;
    if (startedAtRef.current != null) {
      const left = Math.max(
        0,
        remainingAtStartRef.current - (Date.now() - startedAtRef.current),
      );
      setRemainingMs(left);
      remainingAtStartRef.current = left;
    }
    startedAtRef.current = null;
    setRunning(false);
    setStatuses((prev) =>
      prev.map((s, i) => (i === currentIndex && s === "running" ? "pending" : s)),
    );
  };

  const resumeCurrent = () => {
    if (running || currentDone || !current) return;
    remainingAtStartRef.current = remainingMs;
    startedAtRef.current = Date.now();
    endedRef.current = false;
    setRunning(true);
    setStatuses((prev) =>
      prev.map((s, i) => (i === currentIndex ? "running" : s)),
    );
  };

  const startNext = () => {
    if (!hasNext) return;
    const next = currentIndex + 1;
    setCurrentIndex(next);
    setStatuses((prev) =>
      prev.map((s, i) => (i === next ? "running" : s)),
    );
    const ms = Math.max(1, exercises[next].duration_minutes) * 60_000;
    remainingAtStartRef.current = ms;
    startedAtRef.current = Date.now();
    endedRef.current = false;
    setRemainingMs(ms);
    setRunning(true);
  };

  const skipToDone = () => {
    setRunning(false);
    startedAtRef.current = null;
    endedRef.current = true;
    setRemainingMs(0);
    setStatuses((prev) =>
      prev.map((s, i) => (i === currentIndex ? "done" : s)),
    );
  };

  const backHref = seasonId
    ? `/admin/training/${seasonId}`
    : "/admin/training/templates";

  if (loading) return <p className="empty">Chargement…</p>;

  if (!template) {
    return (
      <div>
        {error && <div className="error">{error}</div>}
        <Link className="btn btn-ghost" to={backHref}>
          ← Retour
        </Link>
      </div>
    );
  }

  if (live) {
    return (
      <div className="training-live">
        <div className="training-live-top">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setLive(false);
              setRunning(false);
              startedAtRef.current = null;
            }}
          >
            ← Quitter le chrono
          </button>
          <h1 className="page-title" style={{ margin: 0 }}>
            {template.title}
          </h1>
        </div>

        {allDone ? (
          <div className="panel training-live-done">
            <p className="training-live-clock">Terminé</p>
            <p className="page-sub">Tous les ateliers sont terminés.</p>
            <div className="row-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate(backHref)}
              >
                Retour
              </button>
              <button
                type="button"
                className="btn btn-accent"
                onClick={startSession}
              >
                Recommencer
              </button>
            </div>
          </div>
        ) : (
          <div className="panel training-live-current">
            <p className="training-live-step">
              Atelier {currentIndex + 1} / {exercises.length}
            </p>
            <h2>{current?.title}</h2>
            <p
              className={
                remainingMs <= 10_000 && running
                  ? "training-live-clock training-live-clock-urgent"
                  : "training-live-clock"
              }
            >
              {formatClock(remainingMs)}
            </p>
            {(current?.description || "").trim() ? (
              <div className="training-live-description">
                <p className="training-live-description-label">Consignes</p>
                <p className="training-live-description-text">
                  {current?.description}
                </p>
              </div>
            ) : null}
            <div className="row-actions training-live-controls">
              {!currentDone &&
                (running ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={pauseCurrent}
                  >
                    Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={resumeCurrent}
                  >
                    {remainingMs > 0 &&
                    remainingMs <
                      Math.max(1, current?.duration_minutes || 1) * 60_000
                      ? "Reprendre"
                      : "Démarrer"}
                  </button>
                ))}
              {!currentDone && running && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={skipToDone}
                >
                  Terminer maintenant
                </button>
              )}
              {currentDone && hasNext && (
                <button
                  type="button"
                  className="btn btn-accent"
                  onClick={startNext}
                >
                  Démarrer l’atelier suivant
                </button>
              )}
            </div>
          </div>
        )}

        <div className="panel">
          <h2 className="section-title">Déroulement</h2>
          <ol className="training-live-list">
            {exercises.map((ex, i) => (
              <li
                key={ex.id ?? i}
                className={`training-live-item training-live-item-${statuses[i] || "pending"}`}
              >
                <span className="training-live-item-status">
                  {statuses[i] === "done"
                    ? "✓"
                    : statuses[i] === "running"
                      ? "►"
                      : `${i + 1}`}
                </span>
                <div>
                  <strong>{ex.title}</strong>
                  <span className="muted-inline"> · {ex.duration_minutes} min</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">{template.title}</h1>
      <p className="page-sub">
        {template.total_duration_minutes} min · {exercises.length} atelier
        {exercises.length > 1 ? "s" : ""}
      </p>

      {error && <div className="error">{error}</div>}

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <div className="toolbar">
          <Link className="btn btn-ghost" to={backHref}>
            ← Retour
          </Link>
          <button
            type="button"
            className="btn btn-accent"
            onClick={startSession}
            disabled={exercises.length === 0}
          >
            Démarrer l’entraînement
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        {template.themes.length > 0 && (
          <div className="theme-chips">
            {template.themes.map((theme) => (
              <span key={theme} className="theme-chip">
                {theme}
              </span>
            ))}
          </div>
        )}
        {template.description && (
          <p className="training-desc">{template.description}</p>
        )}
        {exercises.length === 0 ? (
          <p className="empty">Aucun atelier dans cet entraînement.</p>
        ) : (
          <ol className="exercise-preview">
            {exercises.map((ex) => (
              <li key={ex.id ?? ex.title}>
                <strong>{ex.title}</strong>
                <span className="exercise-time">{ex.duration_minutes} min</span>
                {ex.description && <p>{ex.description}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
