import { useEffect, useMemo, useState } from "react";
import type { Composition, Player } from "../types";
import {
  MAX_POSITION,
  POSITION_LABELS,
  POSITION_LAYOUT,
  STARTER_COUNT,
  STARTER_POSITIONS,
  SUB_COUNT,
  SUB_POSITIONS,
  playerDisplayName,
  playerShortName,
} from "../types";
import "./CompositionBoard.css";

interface Props {
  composition: Composition;
  players: Player[];
  onChange: (slots: { position: number; player_id: number | null }[]) => Promise<void>;
  saving?: boolean;
}

function canPlayPosition(player: Player, position: number): boolean {
  // Remplaçants : pas de filtre métier sur le n° de poste
  if (position > STARTER_COUNT) return true;
  const prefs = player.positions || [];
  // Pas de postes renseignés → proposé partout
  if (prefs.length === 0) return true;
  return prefs.includes(position);
}

function SlotFace({ player }: { player: Player | null }) {
  if (!player) return null;
  return (
    <>
      <span className="chip-num on-slot">{player.number || "·"}</span>
      <span className="chip-name on-slot">{playerShortName(player)}</span>
    </>
  );
}

export default function CompositionBoard({
  composition,
  players,
  onChange,
  saving,
}: Props) {
  const [selectedPos, setSelectedPos] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const slotsByPos = useMemo(() => {
    const map = new Map<number, Player | null>();
    for (let i = 1; i <= MAX_POSITION; i++) map.set(i, null);
    for (const s of composition.slots) map.set(s.position, s.player);
    return map;
  }, [composition.slots]);

  const assignedElsewhere = useMemo(() => {
    const map = new Map<number, number>(); // playerId -> position
    for (const s of composition.slots) {
      if (s.player_id) map.set(s.player_id, s.position);
    }
    return map;
  }, [composition.slots]);

  const subFilled = SUB_POSITIONS.filter((pos) => slotsByPos.get(pos)).length;
  const currentPlayer = selectedPos != null ? slotsByPos.get(selectedPos) ?? null : null;

  const candidates = useMemo(() => {
    if (selectedPos == null) return [];
    return players
      .filter((p) => {
        if (showAll) return true;
        return canPlayPosition(p, selectedPos);
      })
      .slice()
      .sort((a, b) => {
        const an = (a.last_name || a.first_name).localeCompare(
          b.last_name || b.first_name,
          "fr",
        );
        return an || a.first_name.localeCompare(b.first_name, "fr");
      });
  }, [players, selectedPos, showAll]);

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
      Array.from({ length: MAX_POSITION }, (_, i) => ({
        position: i + 1,
        player_id: next.get(i + 1) ?? null,
      })),
    );
  };

  const assignPlayer = async (playerId: number) => {
    if (selectedPos == null) return;
    const next = new Map<number, number | null>();
    for (let i = 1; i <= MAX_POSITION; i++) next.set(i, null);
    for (const s of composition.slots) next.set(s.position, s.player_id);

    // Retirer le joueur de son éventuel autre poste
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
    for (let i = 1; i <= MAX_POSITION; i++) next.set(i, null);
    for (const s of composition.slots) next.set(s.position, s.player_id);
    next.set(selectedPos, null);
    setSelectedPos(null);
    await persist(next);
  };

  const positionTitle =
    selectedPos == null
      ? ""
      : selectedPos <= STARTER_COUNT
        ? `${selectedPos} — ${POSITION_LABELS[selectedPos]}`
        : `${selectedPos} — Remplaçant`;

  return (
    <>
      <div className="compo-layout">
        <div className="pitch-wrap">
          <img src="/pitch.png" alt="Terrain de rugby" className="pitch-img" />
          {STARTER_POSITIONS.map((pos) => {
            const player = slotsByPos.get(pos) ?? null;
            return (
              <button
                key={pos}
                type="button"
                className={`pitch-slot clickable ${player ? "filled" : ""}`}
                style={{
                  top: POSITION_LAYOUT[pos].top,
                  left: POSITION_LAYOUT[pos].left,
                }}
                title={`${pos} — ${POSITION_LABELS[pos]} (cliquer pour affecter)`}
                onClick={() => openSlot(pos)}
              >
                <span className="slot-pos">{pos}</span>
                {player ? (
                  <SlotFace player={player} />
                ) : (
                  <span className="slot-label">{POSITION_LABELS[pos]}</span>
                )}
              </button>
            );
          })}
          {saving && <div className="saving-badge">Enregistrement…</div>}
        </div>

        <aside className="bench-panel">
          <h3>Remplaçants ({subFilled}/{SUB_COUNT})</h3>
          <p className="bench-hint">Cliquez un slot pour choisir un joueur.</p>
          <div className="subs-grid">
            {SUB_POSITIONS.map((pos) => {
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
            Cliquez un poste sur le terrain. La liste propose d’abord les joueurs
            ayant ce poste dans leur profil. Utilisez « Afficher tous les joueurs »
            pour forcer une autre affectation.
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
                <h2 id="slot-modal-title">Poste {positionTitle}</h2>
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
                : selectedPos <= STARTER_COUNT
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
