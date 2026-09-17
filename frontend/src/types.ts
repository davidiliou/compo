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

/** Taille d'équipe : 7 (à VII), 12 (à XII), 15 (XV, défaut) */
export type TeamSize = 7 | 12 | 15;

export interface Match {
  id: number;
  opponent: string;
  match_date: string;
  venue: string;
  team_size: TeamSize;
  half_duration_minutes: number;
  score_home: number | null;
  score_away: number | null;
  created_at: string;
  compositions_count: number;
  clock_half: 1 | 2;
  clock_remaining_ms: number;
  clock_running: boolean;
  clock_started_at: string | null;
}

export type MatchEventType = "essai" | "transformation" | "penalite" | "drop";
export type MatchTeam = "home" | "away";

export interface MatchEvent {
  id: number;
  match_id: number;
  half: 1 | 2;
  minute: number;
  event_type: MatchEventType;
  team: MatchTeam;
  player_id: number | null;
  points: number;
  created_at: string;
  player: Player | null;
}

export const EVENT_TYPE_LABELS: Record<MatchEventType, string> = {
  essai: "Essai",
  transformation: "Transformation",
  penalite: "Pénalité",
  drop: "Drop",
};

export const EVENT_TYPE_POINTS: Record<MatchEventType, number> = {
  essai: 5,
  transformation: 2,
  penalite: 3,
  drop: 3,
};

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
  is_public: boolean;
  created_at: string;
  slots: Slot[];
}

export interface MatchFormat {
  teamSize: TeamSize;
  label: string;
  shortLabel: string;
  starters: number;
  subs: number;
  defaultCompoName: string;
  labels: Record<number, string>;
  layout: Record<number, { top: string; left: string }>;
  /** Postes XV (1–15) associés à chaque slot du format (filtre candidats) */
  xvPrefs: Record<number, number[]>;
}

const XV_LABELS: Record<number, string> = {
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

const XV_LAYOUT: Record<number, { top: string; left: string }> = {
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

export const MATCH_FORMATS: Record<TeamSize, MatchFormat> = {
  15: {
    teamSize: 15,
    label: "Match à XV (15 + 8)",
    shortLabel: "XV",
    starters: 15,
    subs: 8,
    defaultCompoName: "XV de départ",
    labels: { ...XV_LABELS },
    layout: { ...XV_LAYOUT },
    xvPrefs: Object.fromEntries(
      Array.from({ length: 15 }, (_, i) => [i + 1, [i + 1]]),
    ) as Record<number, number[]>,
  },
  12: {
    teamSize: 12,
    label: "Match à XII (12 + 8)",
    shortLabel: "XII",
    starters: 12,
    subs: 8,
    defaultCompoName: "XII de départ",
    labels: {
      1: "Pilier G",
      2: "Talonneur",
      3: "Pilier D",
      4: "2e ligne",
      5: "2e ligne",
      6: "3e ligne",
      7: "N°8",
      8: "Mêlée",
      9: "Ouverture",
      10: "Ailier",
      11: "Centre",
      12: "Arrière",
    },
    layout: {
      1: { top: "10%", left: "28%" },
      2: { top: "10%", left: "50%" },
      3: { top: "10%", left: "72%" },
      4: { top: "22%", left: "38%" },
      5: { top: "22%", left: "62%" },
      6: { top: "34%", left: "32%" },
      7: { top: "34%", left: "68%" },
      8: { top: "48%", left: "38%" },
      9: { top: "48%", left: "62%" },
      10: { top: "64%", left: "22%" },
      11: { top: "62%", left: "50%" },
      12: { top: "78%", left: "50%" },
    },
    xvPrefs: {
      1: [1],
      2: [2],
      3: [3],
      4: [4],
      5: [5],
      6: [6, 7],
      7: [8],
      8: [9],
      9: [10],
      10: [11, 14],
      11: [12, 13],
      12: [15],
    },
  },
  7: {
    teamSize: 7,
    label: "Match à VII (7 + 5)",
    shortLabel: "VII",
    starters: 7,
    subs: 5,
    defaultCompoName: "VII de départ",
    labels: {
      1: "Pilier",
      2: "Talonneur",
      3: "Pilier",
      4: "Mêlée",
      5: "Ouverture",
      6: "Centre",
      7: "Arrière",
    },
    layout: {
      1: { top: "14%", left: "30%" },
      2: { top: "14%", left: "50%" },
      3: { top: "14%", left: "70%" },
      4: { top: "38%", left: "38%" },
      5: { top: "38%", left: "62%" },
      6: { top: "58%", left: "50%" },
      7: { top: "78%", left: "50%" },
    },
    xvPrefs: {
      1: [1, 3],
      2: [2],
      3: [1, 3],
      4: [9],
      5: [10],
      6: [12, 13],
      7: [11, 14, 15],
    },
  },
};

export const TEAM_SIZE_OPTIONS: TeamSize[] = [15, 12, 7];

export function normalizeTeamSize(value: unknown): TeamSize {
  const n = Number(value);
  if (n === 7 || n === 12 || n === 15) return n;
  return 15;
}

export function getMatchFormat(teamSize: unknown): MatchFormat {
  return MATCH_FORMATS[normalizeTeamSize(teamSize)];
}

export function starterPositions(format: MatchFormat): number[] {
  return Array.from({ length: format.starters }, (_, i) => i + 1);
}

export function subPositions(format: MatchFormat): number[] {
  return Array.from({ length: format.subs }, (_, i) => format.starters + 1 + i);
}

export function maxPosition(format: MatchFormat): number {
  return format.starters + format.subs;
}

export function positionLabel(format: MatchFormat, pos: number): string {
  if (pos <= format.starters) return format.labels[pos] ?? `Poste ${pos}`;
  return "Remplaçant";
}

/** Compat : labels XV (effectif joueurs) */
export const POSITION_LABELS: Record<number, string> = {
  ...XV_LABELS,
  16: "Remplaçant",
  17: "Remplaçant",
  18: "Remplaçant",
  19: "Remplaçant",
  20: "Remplaçant",
  21: "Remplaçant",
  22: "Remplaçant",
  23: "Remplaçant",
};

export const POSITION_LAYOUT = XV_LAYOUT;
export const STARTER_COUNT = 15;
export const SUB_COUNT = 8;
export const MAX_POSITION = 23;
export const STARTER_POSITIONS = starterPositions(MATCH_FORMATS[15]);
export const SUB_POSITIONS = subPositions(MATCH_FORMATS[15]);
