export interface Player {
  id: number;
  number: number;
  first_name: string;
  last_name: string;
  license_number: string;
  positions: number[];
}

export function playerDisplayName(p: Pick<Player, "first_name" | "last_name">): string {
  return [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
}

export function playerShortName(p: Pick<Player, "first_name" | "last_name">): string {
  const last = (p.last_name || "").trim();
  if (!last) return p.first_name;
  return `${p.first_name} ${last.charAt(0)}.`.trim();
}

export interface Match {
  id: number;
  opponent: string;
  match_date: string;
  venue: string;
  score_home: number | null;
  score_away: number | null;
  created_at: string;
  compositions_count: number;
}

export interface Slot {
  id: number;
  position: number;
  player_id: number | null;
  player: Player | null;
}

export interface Composition {
  id: number;
  match_id: number;
  name: string;
  created_at: string;
  slots: Slot[];
}

export const STARTER_COUNT = 15;
export const SUB_COUNT = 8;
export const MAX_POSITION = STARTER_COUNT + SUB_COUNT; // 23

export const POSITION_LABELS: Record<number, string> = {
  1: "Pilier G",
  2: "Talonneur",
  3: "Pilier D",
  4: "2e ligne",
  5: "2e ligne",
  6: "3e ligne",
  7: "3e ligne",
  8: "N°8",
  9: "Mêlée",
  10: "Ouverture",
  11: "Ailier G",
  12: "Centre",
  13: "Centre",
  14: "Ailier D",
  15: "Arrière",
  16: "Remplaçant",
  17: "Remplaçant",
  18: "Remplaçant",
  19: "Remplaçant",
  20: "Remplaçant",
  21: "Remplaçant",
  22: "Remplaçant",
  23: "Remplaçant",
};

/** Positions en % sur le terrain (vue perspective, attaque en haut) — titulaires 1-15 */
export const POSITION_LAYOUT: Record<number, { top: string; left: string }> = {
  1: { top: "8%", left: "28%" },
  2: { top: "8%", left: "50%" },
  3: { top: "8%", left: "72%" },
  4: { top: "18%", left: "38%" },
  5: { top: "18%", left: "62%" },
  6: { top: "28%", left: "28%" },
  7: { top: "28%", left: "72%" },
  8: { top: "28%", left: "50%" },
  9: { top: "42%", left: "36%" },
  10: { top: "42%", left: "64%" },
  11: { top: "58%", left: "18%" },
  12: { top: "55%", left: "38%" },
  13: { top: "55%", left: "62%" },
  14: { top: "58%", left: "82%" },
  15: { top: "78%", left: "50%" },
};

export const STARTER_POSITIONS = Array.from({ length: STARTER_COUNT }, (_, i) => i + 1);
export const SUB_POSITIONS = Array.from({ length: SUB_COUNT }, (_, i) => STARTER_COUNT + 1 + i);
