import { useMemo } from "react";
import type { Composition, TeamSize } from "../types";
import {
  getMatchFormat,
  playerDisplayName,
  playerShortName,
  starterPositions,
  subPositions,
} from "../types";
import "./PublicPitchView.css";

/** Layouts aérés pour lecture écran */
const LAYOUTS: Record<TeamSize, Record<number, { top: string; left: string }>> = {
  15: {
    1: { top: "7%", left: "20%" },
    2: { top: "7%", left: "50%" },
    3: { top: "7%", left: "80%" },
    4: { top: "20%", left: "34%" },
    5: { top: "20%", left: "66%" },
    6: { top: "33%", left: "20%" },
    7: { top: "33%", left: "80%" },
    8: { top: "33%", left: "50%" },
    9: { top: "48%", left: "36%" },
    10: { top: "48%", left: "64%" },
    11: { top: "64%", left: "14%" },
    12: { top: "62%", left: "36%" },
    13: { top: "62%", left: "64%" },
    14: { top: "64%", left: "86%" },
    15: { top: "82%", left: "50%" },
  },
  12: {
    1: { top: "8%", left: "22%" },
    2: { top: "8%", left: "50%" },
    3: { top: "8%", left: "78%" },
    4: { top: "22%", left: "34%" },
    5: { top: "22%", left: "66%" },
    6: { top: "36%", left: "28%" },
    7: { top: "36%", left: "72%" },
    8: { top: "50%", left: "36%" },
    9: { top: "50%", left: "64%" },
    10: { top: "66%", left: "22%" },
    11: { top: "66%", left: "50%" },
    12: { top: "84%", left: "50%" },
  },
  7: {
    1: { top: "12%", left: "26%" },
    2: { top: "12%", left: "50%" },
    3: { top: "12%", left: "74%" },
    4: { top: "38%", left: "34%" },
    5: { top: "38%", left: "66%" },
    6: { top: "60%", left: "50%" },
    7: { top: "82%", left: "50%" },
  },
};

interface Props {
  composition: Composition;
  teamSize: TeamSize;
}

export default function PublicPitchView({ composition, teamSize }: Props) {
  const format = useMemo(() => getMatchFormat(teamSize), [teamSize]);
  const starters = useMemo(() => starterPositions(format), [format]);
  const subs = useMemo(() => subPositions(format), [format]);
  const layoutMap = LAYOUTS[format.teamSize];

  const byPos = useMemo(() => {
    const map = new Map<number, Composition["slots"][0]>();
    for (const s of composition.slots) map.set(s.position, s);
    return map;
  }, [composition.slots]);

  const namedRows = useMemo(() => {
    return [...starters, ...subs]
      .map((pos) => {
        const player = byPos.get(pos)?.player ?? null;
        return {
          pos,
          name: player ? playerDisplayName(player) : null,
        };
      })
      .filter((r) => r.name);
  }, [byPos, starters, subs]);

  return (
    <div className="visitor-pitch-wrap">
      <div className="visitor-pitch">
        {starters.map((pos) => {
          const player = byPos.get(pos)?.player ?? null;
          const layout = layoutMap[pos] ?? format.layout[pos];
          const label = player
            ? playerShortName(player) || playerDisplayName(player)
            : null;
          return (
            <div
              key={pos}
              className={`visitor-slot ${player ? "filled" : ""}`}
              style={{ top: layout.top, left: layout.left }}
              title={player ? playerDisplayName(player) : undefined}
            >
              <span className="visitor-slot-pos">{pos}</span>
              {label ? (
                <span className="visitor-slot-name">{label}</span>
              ) : (
                <span className="visitor-slot-empty">—</span>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="visitor-subs-title">Remplaçants</h3>
      <div className="visitor-subs">
        {subs.map((pos) => {
          const player = byPos.get(pos)?.player ?? null;
          const label = player
            ? playerShortName(player) || playerDisplayName(player)
            : null;
          return (
            <div key={pos} className={`visitor-sub ${player ? "filled" : ""}`}>
              <span className="visitor-sub-pos">{pos}</span>
              {label ? <span>{label}</span> : <span className="muted">—</span>}
            </div>
          );
        })}
      </div>

      {namedRows.length > 0 && (
        <>
          <h3 className="visitor-subs-title">Feuille (noms complets)</h3>
          <ul className="visitor-list">
            {namedRows.map((r) => (
              <li key={r.pos}>
                <span className="visitor-list-pos">{r.pos}</span>
                <span className="visitor-list-name">{r.name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
