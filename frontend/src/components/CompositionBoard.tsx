import {
  closestCenter,
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";
import type { Composition, Player } from "../types";
import {
  MAX_POSITION,
  POSITION_LABELS,
  POSITION_LAYOUT,
  STARTER_POSITIONS,
  SUB_COUNT,
  SUB_POSITIONS,
  playerShortName,
} from "../types";
import "./CompositionBoard.css";

/** Priorise le pointeur : évite qu’une pastille large chevauche plusieurs postes */
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length > 0) return hits;
  return closestCenter(args);
};

interface Props {
  composition: Composition;
  players: Player[];
  onChange: (slots: { position: number; player_id: number | null }[]) => Promise<void>;
  saving?: boolean;
}

function PlayerChip({
  player,
  dragId,
  compact,
}: {
  player: Player;
  dragId: string;
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { playerId: player.id },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.25 : 1 }}
      className={`player-chip ${compact ? "compact" : ""}`}
      {...listeners}
      {...attributes}
    >
      <span className="chip-num">{player.number || "·"}</span>
      <span className="chip-name">{playerShortName(player)}</span>
    </div>
  );
}

function PitchSlot({ position, player }: { position: number; player: Player | null }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${position}`,
    data: { position },
  });
  const layout = POSITION_LAYOUT[position];

  return (
    <div
      ref={setNodeRef}
      className={`pitch-slot ${isOver ? "over" : ""} ${player ? "filled" : ""}`}
      style={{ top: layout.top, left: layout.left }}
      title={`${position} — ${POSITION_LABELS[position]}`}
    >
      <span className="slot-pos">{position}</span>
      {player ? (
        <PlayerChip player={player} dragId={`slot-${position}`} compact />
      ) : (
        <span className="slot-label">{POSITION_LABELS[position]}</span>
      )}
    </div>
  );
}

function SubSlot({ position, player }: { position: number; player: Player | null }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${position}`,
    data: { position },
  });

  return (
    <div
      ref={setNodeRef}
      className={`sub-slot ${isOver ? "over" : ""} ${player ? "filled" : ""}`}
      title={`${position} — Remplaçant`}
    >
      <span className="sub-pos">{position}</span>
      {player ? (
        <PlayerChip player={player} dragId={`slot-${position}`} />
      ) : (
        <span className="sub-empty">Vide</span>
      )}
    </div>
  );
}

function BoardBody({
  composition,
  players,
  saving,
  activePlayer,
}: {
  composition: Composition;
  players: Player[];
  saving?: boolean;
  activePlayer: Player | null;
}) {
  const slotsByPos = useMemo(() => {
    const map = new Map<number, Player | null>();
    for (let i = 1; i <= MAX_POSITION; i++) map.set(i, null);
    for (const s of composition.slots) map.set(s.position, s.player);
    return map;
  }, [composition.slots]);

  const assignedIds = useMemo(() => {
    const ids = new Set<number>();
    for (const s of composition.slots) {
      if (s.player_id) ids.add(s.player_id);
    }
    return ids;
  }, [composition.slots]);

  const available = players.filter((p) => !assignedIds.has(p.id));
  const subFilled = SUB_POSITIONS.filter((pos) => slotsByPos.get(pos)).length;
  const { setNodeRef, isOver } = useDroppable({ id: "drop-bench" });

  return (
    <>
      <div className="compo-layout">
        <div className="pitch-wrap">
          <img src="/pitch.png" alt="Terrain de rugby" className="pitch-img" />
          {STARTER_POSITIONS.map((pos) => (
            <PitchSlot key={pos} position={pos} player={slotsByPos.get(pos) ?? null} />
          ))}
          {saving && <div className="saving-badge">Enregistrement…</div>}
        </div>

        <aside className="bench-panel">
          <h3>Remplaçants ({subFilled}/{SUB_COUNT})</h3>
          <p className="bench-hint">Maximum 8 remplaçants (n°16 à 23).</p>
          <div className="subs-grid">
            {SUB_POSITIONS.map((pos) => (
              <SubSlot key={pos} position={pos} player={slotsByPos.get(pos) ?? null} />
            ))}
          </div>

          <h3 style={{ marginTop: "1.25rem" }}>Effectif disponible</h3>
          <p className="bench-hint">Glissez vers le terrain ou un slot remplaçant.</p>
          <div ref={setNodeRef} className={`bench-list ${isOver ? "over" : ""}`}>
            {available.length === 0 ? (
              <p className="empty">Tous les joueurs sont placés.</p>
            ) : (
              available.map((p) => (
                <PlayerChip key={p.id} player={p} dragId={`bench-${p.id}`} />
              ))
            )}
          </div>
          <p className="bench-hint">Déposez ici pour retirer un joueur.</p>
        </aside>
      </div>

      <DragOverlay dropAnimation={null}>
        {activePlayer ? (
          <div className="player-chip overlay drag-ghost">
            <span className="chip-num">{activePlayer.number || "·"}</span>
            <span className="chip-name">{playerShortName(activePlayer)}</span>
          </div>
        ) : null}
      </DragOverlay>
    </>
  );
}

export default function CompositionBoard({
  composition,
  players,
  onChange,
  saving,
}: Props) {
  const [activePlayer, setActivePlayer] = useState<Player | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const onDragStart = (event: DragStartEvent) => {
    const playerId = event.active.data.current?.playerId as number | undefined;
    setActivePlayer(players.find((x) => x.id === playerId) || null);
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setActivePlayer(null);
    const { active, over } = event;
    if (!over) return;

    const playerId = active.data.current?.playerId as number;
    const next = new Map<number, number | null>();
    for (let i = 1; i <= MAX_POSITION; i++) next.set(i, null);
    for (const s of composition.slots) next.set(s.position, s.player_id);

    for (const [pos, pid] of next) {
      if (pid === playerId) next.set(pos, null);
    }

    const overId = String(over.id);
    const activeId = String(active.id);

    if (overId === "drop-bench") {
      // already cleared
    } else if (overId.startsWith("drop-")) {
      const position = Number(overId.replace("drop-", ""));
      if (position < 1 || position > MAX_POSITION) return;
      const previous = next.get(position) ?? null;
      const fromSlot = activeId.startsWith("slot-")
        ? Number(activeId.replace("slot-", ""))
        : null;
      next.set(position, playerId);
      if (fromSlot !== null && previous !== null) next.set(fromSlot, previous);
    } else {
      return;
    }

    await onChange(
      Array.from({ length: MAX_POSITION }, (_, i) => ({
        position: i + 1,
        player_id: next.get(i + 1) ?? null,
      })),
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <BoardBody
        composition={composition}
        players={players}
        saving={saving}
        activePlayer={activePlayer}
      />
    </DndContext>
  );
}
