export interface Player {
  id: number;
  number: number;
  first_name: string;
  license_number: string;
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
};

/** Positions en % sur le terrain (vue perspective, attaque en haut) */
export const POSITION_LAYOUT: Record<number, { top: string; left: string }> = {
  1: { top: "8%", left: "28%" },
  2: { top: "8%", left: "50%" },
  3: { top: "8%", left: "72%" },
  4: { top: "18%", left: "38%" },
  5: { top: "18%", left: "62%" },
  6: { top: "28%", left: "28%" },
  7: { top: "28%", left: "72%" },
  8: { top: "28%", left: "50%" },
  9: { top: "40%", left: "42%" },
  10: { top: "40%", left: "58%" },
  11: { top: "58%", left: "18%" },
  12: { top: "55%", left: "38%" },
  13: { top: "55%", left: "62%" },
  14: { top: "58%", left: "82%" },
  15: { top: "78%", left: "50%" },
};
