import type { Composition, Match, Player } from "./types";

const API = import.meta.env.VITE_API_URL || "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Players
  getPlayers: () => request<Player[]>("/players"),
  createPlayer: (data: Omit<Player, "id">) =>
    request<Player>("/players", { method: "POST", body: JSON.stringify(data) }),
  updatePlayer: (id: number, data: Partial<Omit<Player, "id">>) =>
    request<Player>(`/players/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePlayer: (id: number) => request<void>(`/players/${id}`, { method: "DELETE" }),

  // Matches
  getMatches: () => request<Match[]>("/matches"),
  createMatch: (data: Omit<Match, "id" | "created_at" | "compositions_count">) =>
    request<Match>("/matches", { method: "POST", body: JSON.stringify(data) }),
  updateMatch: (
    id: number,
    data: Partial<Omit<Match, "id" | "created_at" | "compositions_count">>,
  ) => request<Match>(`/matches/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteMatch: (id: number) => request<void>(`/matches/${id}`, { method: "DELETE" }),
  getMatch: (id: number) => request<Match>(`/matches/${id}`),

  // Compositions
  getCompositions: (matchId: number) =>
    request<Composition[]>(`/matches/${matchId}/compositions`),
  createComposition: (matchId: number, name: string) =>
    request<Composition>(`/matches/${matchId}/compositions`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  updateComposition: (id: number, name: string) =>
    request<Composition>(`/compositions/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
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
};
