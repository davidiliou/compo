import { useMemo } from "react";
import type { Composition, Match, MatchFormat, TeamSize } from "../types";
import {
  getMatchFormat,
  normalizeTeamSize,
  positionLabel,
  starterPositions,
  subPositions,
  playerDisplayName,
  playerShortName,
} from "../types";
import "./CompositionExport.css";

interface Props {
  match: Match;
  composition: Composition;
  onClose?: () => void;
}

/** Layouts aérés pour l’export / PDF (évite les chevauchements) */
const EXPORT_LAYOUTS: Record<TeamSize, Record<number, { top: string; left: string }>> = {
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

function exportLayout(format: MatchFormat, pos: number) {
  return EXPORT_LAYOUTS[format.teamSize][pos] ?? format.layout[pos];
}

export default function CompositionExport({
  match,
  composition,
  onClose,
}: Props) {
  const format = useMemo(
    () => getMatchFormat(normalizeTeamSize(match.team_size)),
    [match.team_size],
  );
  const starters = useMemo(() => starterPositions(format), [format]);
  const subs = useMemo(() => subPositions(format), [format]);

  const byPos = useMemo(() => {
    const map = new Map<number, Composition["slots"][0]>();
    for (const s of composition.slots) map.set(s.position, s);
    return map;
  }, [composition.slots]);

  const rows = useMemo(() => {
    return [...starters, ...subs]
      .map((pos) => {
        const slot = byPos.get(pos);
        const player = slot?.player ?? null;
        return {
          position: pos,
          role:
            pos <= format.starters
              ? positionLabel(format, pos)
              : `Remplaçant ${pos}`,
          name: player ? playerDisplayName(player) : "—",
          license: player?.license_number ?? "—",
          filled: !!player,
        };
      })
      .filter((r) => r.filled);
  }, [byPos, starters, subs, format]);

  const dateLabel = new Date(match.match_date).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="export-root">
      <div className="export-toolbar no-print">
        {onClose && (
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Fermer
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => window.print()}
        >
          Imprimer / PDF
        </button>
      </div>

      <article className="export-sheet">
        <header className="export-header">
          <p className="export-brand">Compo Rugby</p>
          <h1>{composition.name}</h1>
          <p className="export-meta">
            vs <strong>{match.opponent}</strong> · {dateLabel} · {match.venue} ·{" "}
            {format.shortLabel}
            {(match.score_home != null || match.score_away != null) && (
              <>
                {" "}
                · Score {match.score_home ?? "—"} – {match.score_away ?? "—"}
              </>
            )}
          </p>
        </header>

        <section className="export-pitch-section">
          <h2>{format.defaultCompoName.replace(" de départ", "")} de départ</h2>
          <div className={`export-pitch export-pitch-${format.teamSize}`}>
            {starters.map((pos) => {
              const player = byPos.get(pos)?.player ?? null;
              const layout = exportLayout(format, pos);
              return (
                <div
                  key={pos}
                  className={`export-slot ${player ? "filled" : ""}`}
                  style={{ top: layout.top, left: layout.left }}
                >
                  <span className="export-slot-pos">{pos}</span>
                  {player ? (
                    <span className="export-slot-name">
                      {playerShortName(player)}
                    </span>
                  ) : (
                    <span className="export-slot-empty">—</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="export-subs-section">
          <h2>Remplaçants</h2>
          <div className="export-subs">
            {subs.map((pos) => {
              const player = byPos.get(pos)?.player ?? null;
              return (
                <div key={pos} className={`export-sub ${player ? "filled" : ""}`}>
                  <span className="export-sub-pos">{pos}</span>
                  {player ? (
                    <span>{playerShortName(player)}</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="export-table-section">
          <h2>Feuille de composition</h2>
          {rows.length === 0 ? (
            <p className="muted">Aucun joueur placé.</p>
          ) : (
            <table className="export-table">
              <thead>
                <tr>
                  <th>Poste</th>
                  <th>Rôle</th>
                  <th>Nom</th>
                  <th>N° licence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.position}>
                    <td>{r.position}</td>
                    <td>{r.role}</td>
                    <td>{r.name}</td>
                    <td>{r.license}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </article>
    </div>
  );
}
