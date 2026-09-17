import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState } from "react";
import type { Composition, Player } from "../types";
import { POSITION_LABELS, POSITION_LAYOUT } from "../types";
import "./CompositionBoard.css";

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
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: { playerId: player.id },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.35 : 1,
      }}
      className={`player-chip ${compact ? "compact" : ""}`}
      {...listeners}
      {...attributes}
    >
      <span className="chip-num">{player.number}</span>
      <span className="chip-name">{player.first_name}</span>
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
    for (let i = 1; i <= 15; i++) map.set(i, null);
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

  const bench = players.filter((p) => !assignedIds.has(p.id));
  const { setNodeRef, isOver } = useDroppable({ id: "drop-bench" });

  return (
    <>
      <div className="compo-layout">
        <div className="pitch-wrap">
          <img src="/pitch.png" alt="Terrain de rugby" className="pitch-img" />
          {Array.from({ length: 15 }, (_, i) => i + 1).map((pos) => (
            <PitchSlot key={pos} position={pos} player={slotsByPos.get(pos) ?? null} />
          ))}
          {saving && <div className="saving-badge">Enregistrement…</div>}
        </div>

        <aside className="bench-panel">
          <h3>Banc / effectif</h3>
          <p className="bench-hint">Glissez un joueur sur une case du terrain.</p>
          <div ref={setNodeRef} className={`bench-list ${isOver ? "over" : ""}`}>
            {bench.length === 0 ? (
              <p className="empty">Tous les joueurs sont placés.</p>
            ) : (
              bench.map((p) => (
                <PlayerChip key={p.id} player={p} dragId={`bench-${p.id}`} />
              ))
            )}
          </div>
          <p className="bench-hint">Déposez ici pour retirer un joueur du terrain.</p>
        </aside>
      </div>

      <DragOverlay>
        {activePlayer ? (
          <div className="player-chip overlay">
            <span className="chip-num">{activePlayer.number}</span>
            <span className="chip-name">{activePlayer.first_name}</span>
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
    for (let i = 1; i <= 15; i++) next.set(i, null);
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
      Array.from({ length: 15 }, (_, i) => ({
        position: i + 1,
        player_id: next.get(i + 1) ?? null,
      })),
    );
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <BoardBody
        composition={composition}
        players={players}
        saving={saving}
        activePlayer={activePlayer}
      />
    </DndContext>
  );
}
