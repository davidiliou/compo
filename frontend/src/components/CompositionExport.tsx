import { useMemo } from "react";
import type { Composition, Match } from "../types";
import {
  POSITION_LABELS,
  POSITION_LAYOUT,
  STARTER_POSITIONS,
  SUB_POSITIONS,
  playerDisplayName,
  playerShortName,
} from "../types";
import "./CompositionExport.css";

interface Props {
  match: Match;
  composition: Composition;
  onClose?: () => void;
}

export default function CompositionExport({
  match,
  composition,
  onClose,
}: Props) {
  const byPos = useMemo(() => {
    const map = new Map<number, Composition["slots"][0]>();
    for (const s of composition.slots) map.set(s.position, s);
    return map;
  }, [composition.slots]);

  const rows = useMemo(() => {
    return [...STARTER_POSITIONS, ...SUB_POSITIONS]
      .map((pos) => {
        const slot = byPos.get(pos);
        const player = slot?.player ?? null;
        return {
          position: pos,
          role: pos <= 15 ? POSITION_LABELS[pos] : `Remplaçant ${pos}`,
          number: player?.number ?? null,
          name: player ? playerDisplayName(player) : "—",
          license: player?.license_number ?? "—",
          filled: !!player,
        };
      })
      .filter((r) => r.filled);
  }, [byPos]);

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
            vs <strong>{match.opponent}</strong> · {dateLabel} · {match.venue}
            {(match.score_home != null || match.score_away != null) && (
              <>
                {" "}
                · Score {match.score_home ?? "—"} – {match.score_away ?? "—"}
              </>
            )}
          </p>
        </header>

        <section className="export-pitch-section">
          <h2>XV de départ</h2>
          <div className="export-pitch">
            <img src="/pitch.png" alt="" className="export-pitch-img" />
            {STARTER_POSITIONS.map((pos) => {
              const player = byPos.get(pos)?.player ?? null;
              const layout = POSITION_LAYOUT[pos];
              return (
                <div
                  key={pos}
                  className={`export-slot ${player ? "filled" : ""}`}
                  style={{ top: layout.top, left: layout.left }}
                >
                  <span className="export-slot-pos">{pos}</span>
                  {player ? (
                    <>
                      <span className="export-slot-num">{player.number || "·"}</span>
                      <span className="export-slot-name">{playerShortName(player)}</span>
                    </>
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
            {SUB_POSITIONS.map((pos) => {
              const player = byPos.get(pos)?.player ?? null;
              return (
                <div key={pos} className={`export-sub ${player ? "filled" : ""}`}>
                  <span className="export-sub-pos">{pos}</span>
                  {player ? (
                    <span>
                      <strong>{player.number || "·"}</strong> {playerShortName(player)}
                    </span>
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
                  <th>N°</th>
                  <th>Nom</th>
                  <th>N° licence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.position}>
                    <td>{r.position}</td>
                    <td>{r.role}</td>
                    <td>{r.number}</td>
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
