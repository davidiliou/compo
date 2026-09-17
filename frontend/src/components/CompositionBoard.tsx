import { useEffect, useMemo, useState } from "react";
import type { Composition, MatchFormat, Player, TeamSize } from "../types";
import {
  getMatchFormat,
  maxPosition,
  positionLabel,
  starterPositions,
  subPositions,
  playerDisplayName,
  playerShortName,
} from "../types";
import "./CompositionBoard.css";

interface Props {
  composition: Composition;
  players: Player[];
  teamSize?: TeamSize;
  onChange: (slots: { position: number; player_id: number | null }[]) => Promise<void>;
  saving?: boolean;
}

function canPlayPosition(
  player: Player,
  position: number,
  format: MatchFormat,
): boolean {
  if (position > format.starters) return true;
  const prefs = player.positions || [];
  if (prefs.length === 0) return true;
  const mapped = format.xvPrefs[position] || [position];
  return mapped.some((p) => prefs.includes(p));
}

function SlotFace({ player }: { player: Player }) {
  const first = (player.first_name || "").trim();
  const last = (player.last_name || "").trim();
  const label = [first, last].filter(Boolean).join(" ");

  return (
    <span className="slot-player">
      <span className="slot-player-name">{label || "—"}</span>
    </span>
  );
}

export default function CompositionBoard({
  composition,
  players,
  teamSize = 15,
  onChange,
  saving,
}: Props) {
  const format = useMemo(() => getMatchFormat(teamSize), [teamSize]);
  const starters = useMemo(() => starterPositions(format), [format]);
  const subs = useMemo(() => subPositions(format), [format]);
  const limit = maxPosition(format);

  const [selectedPos, setSelectedPos] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const slotsByPos = useMemo(() => {
    const map = new Map<number, Player | null>();
    for (let i = 1; i <= limit; i++) map.set(i, null);
    for (const s of composition.slots) {
      if (s.position >= 1 && s.position <= limit) map.set(s.position, s.player);
    }
    return map;
  }, [composition.slots, limit]);

  const assignedElsewhere = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of composition.slots) {
      if (s.player_id && s.position >= 1 && s.position <= limit) {
        map.set(s.player_id, s.position);
      }
    }
    return map;
  }, [composition.slots, limit]);

  const subFilled = subs.filter((pos) => slotsByPos.get(pos)).length;
  const currentPlayer = selectedPos != null ? slotsByPos.get(selectedPos) ?? null : null;

  const candidates = useMemo(() => {
    if (selectedPos == null) return [];
    return players
      .filter((p) => {
        if (showAll) return true;
        return canPlayPosition(p, selectedPos, format);
      })
      .slice()
      .sort((a, b) => {
        const aTaken = assignedElsewhere.has(a.id) ? 1 : 0;
        const bTaken = assignedElsewhere.has(b.id) ? 1 : 0;
        if (aTaken !== bTaken) return aTaken - bTaken;
        const byFirst = a.first_name.localeCompare(b.first_name, "fr", {
          sensitivity: "base",
        });
        if (byFirst) return byFirst;
        return (a.last_name || "").localeCompare(b.last_name || "", "fr", {
          sensitivity: "base",
        });
      });
  }, [players, selectedPos, showAll, format, assignedElsewhere]);

  useEffect(() => {
    if (selectedPos == null) return;
    if (selectedPos > limit) setSelectedPos(null);
  }, [selectedPos, limit]);

  useEffect(() => {
    if (selectedPos == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedPos(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedPos]);

  const openSlot = (pos: number) => {
    setSelectedPos(pos);
    setShowAll(false);
  };

  const persist = async (next: Map<number, number | null>) => {
    await onChange(
      Array.from({ length: limit }, (_, i) => ({
        position: i + 1,
        player_id: next.get(i + 1) ?? null,
      })),
    );
  };

  const assignPlayer = async (playerId: number) => {
    if (selectedPos == null) return;
    const next = new Map<number, number | null>();
    for (let i = 1; i <= limit; i++) next.set(i, null);
    for (const s of composition.slots) {
      if (s.position >= 1 && s.position <= limit) next.set(s.position, s.player_id);
    }
    for (const [pos, pid] of next) {
      if (pid === playerId) next.set(pos, null);
    }
    next.set(selectedPos, playerId);
    setSelectedPos(null);
    await persist(next);
  };

  const clearSlot = async () => {
    if (selectedPos == null) return;
    const next = new Map<number, number | null>();
    for (let i = 1; i <= limit; i++) next.set(i, null);
    for (const s of composition.slots) {
      if (s.position >= 1 && s.position <= limit) next.set(s.position, s.player_id);
    }
    next.set(selectedPos, null);
    setSelectedPos(null);
    await persist(next);
  };

  const title =
    selectedPos == null
      ? ""
      : `${selectedPos} — ${positionLabel(format, selectedPos)}`;

  return (
    <>
      <div className="compo-layout">
        <div className="pitch-wrap">
          <div className="pitch-field" aria-hidden="true" />
          {starters.map((pos) => {
            const player = slotsByPos.get(pos) ?? null;
            const layout = format.layout[pos];
            return (
              <button
                key={pos}
                type="button"
                className={`pitch-slot clickable ${player ? "filled" : ""}`}
                style={{
                  top: layout.top,
                  left: layout.left,
                }}
                title={`${pos} — ${format.labels[pos]} (cliquer pour affecter)`}
                onClick={() => openSlot(pos)}
              >
                <span className="slot-pos">{pos}</span>
                {player ? (
                  <SlotFace player={player} />
                ) : (
                  <span className="slot-label">{format.labels[pos]}</span>
                )}
              </button>
            );
          })}
          {saving && <div className="saving-badge">Enregistrement…</div>}
        </div>

        <aside className="bench-panel">
          <h3>
            Remplaçants ({subFilled}/{format.subs})
          </h3>
          <p className="bench-hint">Cliquez un slot pour choisir un joueur.</p>
          <div className="subs-grid">
            {subs.map((pos) => {
              const player = slotsByPos.get(pos) ?? null;
              return (
                <button
                  key={pos}
                  type="button"
                  className={`sub-slot clickable ${player ? "filled" : ""}`}
                  title={`${pos} — Remplaçant`}
                  onClick={() => openSlot(pos)}
                >
                  <span className="sub-pos">{pos}</span>
                  {player ? (
                    <span className="sub-player">
                      <strong>{player.number || "·"}</strong> {playerShortName(player)}
                    </span>
                  ) : (
                    <span className="sub-empty">Choisir…</span>
                  )}
                </button>
              );
            })}
          </div>

          <h3 style={{ marginTop: "1.25rem" }}>Aide</h3>
          <p className="bench-hint">
            Format {format.shortLabel} : {format.starters} titulaires + {format.subs}{" "}
            remplaçants. Cliquez un poste pour assigner un joueur.
          </p>
        </aside>
      </div>

      {selectedPos != null && (
        <div
          className="slot-modal-backdrop"
          onClick={() => setSelectedPos(null)}
          role="presentation"
        >
          <div
            className="slot-modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="slot-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="slot-modal-head">
              <div>
                <h2 id="slot-modal-title">Poste {title}</h2>
                {currentPlayer && (
                  <p className="bench-hint" style={{ margin: 0 }}>
                    Actuel : {playerDisplayName(currentPlayer)}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedPos(null)}
              >
                Fermer
              </button>
            </div>

            <div className="slot-modal-actions">
              <button
                type="button"
                className={`btn btn-sm ${showAll ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll
                  ? "Afficher les joueurs du poste"
                  : "Afficher tous les joueurs"}
              </button>
              {currentPlayer && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={clearSlot}
                  disabled={saving}
                >
                  Retirer du poste
                </button>
              )}
            </div>

            <p className="bench-hint">
              {showAll
                ? "Tous les joueurs de l’effectif"
                : selectedPos <= format.starters
                  ? "Joueurs pouvant jouer ce poste"
                  : "Joueurs disponibles pour le banc"}
            </p>

            <div className="slot-modal-list">
              {candidates.length === 0 ? (
                <p className="empty">
                  Aucun joueur correspondant. Affichez tous les joueurs ou
                  renseignez les postes dans l’effectif.
                </p>
              ) : (
                candidates.map((p) => {
                  const elsewhere = assignedElsewhere.get(p.id);
                  const isHere = elsewhere === selectedPos;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`slot-pick ${isHere ? "current" : ""}`}
                      disabled={saving}
                      onClick={() => assignPlayer(p.id)}
                    >
                      <span className="chip-num">{p.number || "·"}</span>
                      <span className="slot-pick-info">
                        <strong>{playerDisplayName(p)}</strong>
                        <small>
                          {(p.positions || []).length
                            ? `Postes : ${(p.positions || []).join(", ")}`
                            : "Aucun poste renseigné"}
                          {elsewhere && !isHere ? ` · déjà en ${elsewhere}` : ""}
                          {isHere ? " · poste actuel" : ""}
                        </small>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
