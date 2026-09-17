import type { Composition, Match, MatchEvent, MatchEventType, MatchTeam, Player } from "./types";

const API = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "compo_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {
    ...(extra as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseError(res: Response): Promise<string> {
  let detail = res.statusText;
  try {
    const body = await res.json();
    detail = body.detail || detail;
  } catch {
    /* ignore */
  }
  if (res.status === 401) {
    clearToken();
  }
  return typeof detail === "string" ? detail : JSON.stringify(detail);
}

function networkErrorMessage(): string {
  return `Impossible de joindre l’API (${API}). Ouvrez http://localhost:3080 (pas le port 8000), vérifiez que Docker tourne, puis rafraîchissez la page.`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...options,
      headers: authHeaders({
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      }),
    });
  } catch {
    throw new Error(networkErrorMessage());
  }
  if (!res.ok) throw new Error(await parseError(res));
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function requestForm<T>(path: string, form: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: "POST",
      body: form,
      headers: authHeaders(),
    });
  } catch {
    throw new Error(networkErrorMessage());
  }
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

async function downloadAuthed(path: string, fallbackName: string) {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { headers: authHeaders() });
  } catch {
    throw new Error(networkErrorMessage());
  }
  if (!res.ok) throw new Error(await parseError(res));
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  const filename = match?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function publicRequest<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}/public${path}`, {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    throw new Error(networkErrorMessage());
  }
  if (!res.ok) throw new Error(await parseError(res));
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    request<{ access_token: string; token_type: string; username: string }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ username, password }) },
    ),
  me: () => request<{ id: number; username: string }>("/auth/me"),

  getPlayers: () => request<Player[]>("/players"),
  createPlayer: (data: Omit<Player, "id">) =>
    request<Player>("/players", { method: "POST", body: JSON.stringify(data) }),
  updatePlayer: (id: number, data: Partial<Omit<Player, "id">>) =>
    request<Player>(`/players/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePlayer: (id: number) => request<void>(`/players/${id}`, { method: "DELETE" }),
  importPlayers: async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return requestForm<{
      created: number;
      updated: number;
      skipped: number;
      errors: string[];
    }>("/players/import", body);
  },
  downloadPlayersTemplate: () =>
    downloadAuthed("/players/template.xlsx", "modele_joueurs.xlsx"),

  getMatches: () => request<Match[]>("/matches"),
  createMatch: (
    data: Omit<
      Match,
      | "id"
      | "created_at"
      | "compositions_count"
      | "clock_half"
      | "clock_remaining_ms"
      | "clock_running"
      | "clock_started_at"
    >,
  ) =>
    request<Match>("/matches", { method: "POST", body: JSON.stringify(data) }),
  updateMatch: (
    id: number,
    data: Partial<
      Omit<
        Match,
        | "id"
        | "created_at"
        | "compositions_count"
        | "clock_half"
        | "clock_remaining_ms"
        | "clock_running"
        | "clock_started_at"
      >
    >,
  ) => request<Match>(`/matches/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteMatch: (id: number) => request<void>(`/matches/${id}`, { method: "DELETE" }),
  getMatch: (id: number) => request<Match>(`/matches/${id}`),
  updateMatchClock: (
    id: number,
    data: {
      clock_half: 1 | 2;
      clock_remaining_ms: number;
      clock_running: boolean;
    },
  ) =>
    request<Match>(`/matches/${id}/clock`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getMatchEvents: (matchId: number) =>
    request<MatchEvent[]>(`/matches/${matchId}/events`),
  createMatchEvent: (
    matchId: number,
    data: {
      half: 1 | 2;
      minute: number;
      event_type: MatchEventType;
      team: MatchTeam;
      player_id?: number | null;
    },
  ) =>
    request<MatchEvent>(`/matches/${matchId}/events`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteMatchEvent: (eventId: number) =>
    request<void>(`/events/${eventId}`, { method: "DELETE" }),

  getCompositions: (matchId: number) =>
    request<Composition[]>(`/matches/${matchId}/compositions`),
  createComposition: (matchId: number, name: string) =>
    request<Composition>(`/matches/${matchId}/compositions`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  updateComposition: (
    id: number,
    data: { name?: string; is_public?: boolean },
  ) =>
    request<Composition>(`/compositions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteComposition: (id: number) =>
    request<void>(`/compositions/${id}`, { method: "DELETE" }),
  updateSlots: (
    id: number,
    slots: { position: number; player_id: number | null }[],
  ) =>
    request<Composition>(`/compositions/${id}/slots`, {
      method: "PUT",
      body: JSON.stringify({ slots }),
    }),

  // --- Public (visiteurs) ---
  publicGetMatches: () => publicRequest<Match[]>("/matches"),
  publicGetUpcoming: () => publicRequest<Match | null>("/matches/upcoming"),
  publicGetMatch: (id: number) => publicRequest<Match>(`/matches/${id}`),
  publicGetCompositions: (matchId: number) =>
    publicRequest<Composition[]>(`/matches/${matchId}/compositions`),
  publicGetEvents: (matchId: number) =>
    publicRequest<MatchEvent[]>(`/matches/${matchId}/events`),

  getSettingsInfo: () =>
    request<{
      players: number;
      matches: number;
      compositions: number;
      slots: number;
    }>("/settings/info"),
  downloadBackup: () =>
    downloadAuthed("/settings/backup", `compo_backup_${Date.now()}.json`),
  restoreBackup: async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return requestForm<{
      players: number;
      matches: number;
      compositions: number;
      slots: number;
    }>("/settings/restore", body);
  },
};
