/** Helpers chrono partagé admin / visiteur */

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function halfLabel(half: 1 | 2): string {
  return half === 1 ? "1ère mi-temps" : "2ème mi-temps";
}

/** Interprète une date serveur (UTC naive ou avec Z) en timestamp ms. */
export function parseUtcMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  const hasTz = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const normalized = hasTz ? raw : `${raw}Z`;
  const ms = new Date(normalized).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function computeRemainingMs(match: {
  clock_remaining_ms: number;
  clock_running: boolean;
  clock_started_at: string | null;
  half_duration_minutes?: number;
}): number {
  const base =
    match.clock_remaining_ms ??
    (match.half_duration_minutes || 35) * 60_000;
  if (!match.clock_running || !match.clock_started_at) {
    return Math.max(0, base);
  }
  const started = parseUtcMs(match.clock_started_at);
  if (started == null) return Math.max(0, base);
  return Math.max(0, base - (Date.now() - started));
}
