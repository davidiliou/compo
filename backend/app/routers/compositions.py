from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user
from ..database import get_db
from ..match_formats import default_composition_name, max_position, normalize_team_size
from ..models import Composition, CompositionSlot, Match, Player
from ..schemas import (
    CompositionCreate,
    CompositionOut,
    CompositionUpdate,
    SlotsBulkUpdate,
)

router = APIRouter(
    tags=["compositions"],
    dependencies=[Depends(get_current_user)],
)


def _load_composition(db: Session, composition_id: int) -> Composition | None:
    return (
        db.query(Composition)
        .options(joinedload(Composition.slots).joinedload(CompositionSlot.player))
        .filter(Composition.id == composition_id)
        .first()
    )


def _team_size_for_composition(db: Session, composition: Composition) -> int:
    match = db.get(Match, composition.match_id)
    if not match:
        return 15
    return normalize_team_size(getattr(match, "team_size", 15))


def sync_composition_slots(
    db: Session, composition: Composition, team_size: int | None = None
) -> None:
    """Crée les slots manquants et retire ceux hors format."""
    size = normalize_team_size(
        team_size if team_size is not None else _team_size_for_composition(db, composition)
    )
    limit = max_position(size)
    existing = {s.position: s for s in composition.slots}
    changed = False

    for pos in range(1, limit + 1):
        if pos not in existing:
            db.add(
                CompositionSlot(
                    composition_id=composition.id, position=pos, player_id=None
                )
            )
            changed = True

    for pos, slot in existing.items():
        if pos < 1 or pos > limit:
            db.delete(slot)
            changed = True

    if changed:
        db.commit()


def sync_match_compositions(db: Session, match: Match) -> None:
    size = normalize_team_size(getattr(match, "team_size", 15))
    comps = (
        db.query(Composition)
        .options(joinedload(Composition.slots))
        .filter(Composition.match_id == match.id)
        .all()
    )
    for comp in comps:
        sync_composition_slots(db, comp, size)


@router.get("/matches/{match_id}/compositions", response_model=list[CompositionOut])
def list_compositions(match_id: int, db: Session = Depends(get_db)):
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match introuvable")
    comps = (
        db.query(Composition)
        .options(joinedload(Composition.slots).joinedload(CompositionSlot.player))
        .filter(Composition.match_id == match_id)
        .order_by(Composition.created_at)
        .all()
    )
    size = normalize_team_size(getattr(match, "team_size", 15))
    for comp in comps:
        sync_composition_slots(db, comp, size)
    return [_load_composition(db, c.id) for c in comps]


@router.post(
    "/matches/{match_id}/compositions",
    response_model=CompositionOut,
    status_code=201,
)
def create_composition(
    match_id: int, payload: CompositionCreate, db: Session = Depends(get_db)
):
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match introuvable")
    size = normalize_team_size(getattr(match, "team_size", 15))
    name = payload.name.strip() if payload.name else ""
    if not name or name == "Composition":
        name = default_composition_name(size)
    comp = Composition(match_id=match_id, name=name)
    db.add(comp)
    db.commit()
    db.refresh(comp)
    sync_composition_slots(db, comp, size)
    return _load_composition(db, comp.id)


@router.get("/compositions/{composition_id}", response_model=CompositionOut)
def get_composition(composition_id: int, db: Session = Depends(get_db)):
    comp = _load_composition(db, composition_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Composition introuvable")
    sync_composition_slots(db, comp)
    return _load_composition(db, composition_id)


@router.put("/compositions/{composition_id}", response_model=CompositionOut)
def update_composition(
    composition_id: int, payload: CompositionUpdate, db: Session = Depends(get_db)
):
    comp = _load_composition(db, composition_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Composition introuvable")
    if payload.name is not None:
        comp.name = payload.name
    db.commit()
    return _load_composition(db, composition_id)


@router.delete("/compositions/{composition_id}", status_code=204)
def delete_composition(composition_id: int, db: Session = Depends(get_db)):
    comp = db.get(Composition, composition_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Composition introuvable")
    db.delete(comp)
    db.commit()


@router.put("/compositions/{composition_id}/slots", response_model=CompositionOut)
def update_slots(
    composition_id: int, payload: SlotsBulkUpdate, db: Session = Depends(get_db)
):
    comp = _load_composition(db, composition_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Composition introuvable")
    size = _team_size_for_composition(db, comp)
    limit = max_position(size)
    sync_composition_slots(db, comp, size)
    comp = _load_composition(db, composition_id)

    slot_by_pos = {s.position: s for s in comp.slots}
    used_players: set[int] = set()

    for item in payload.slots:
        if item.position < 1 or item.position > limit:
            raise HTTPException(
                status_code=400, detail=f"Position invalide: {item.position}"
            )
        if item.position not in slot_by_pos:
            raise HTTPException(
                status_code=400, detail=f"Position invalide: {item.position}"
            )
        if item.player_id is not None:
            if item.player_id in used_players:
                raise HTTPException(
                    status_code=400,
                    detail="Un joueur ne peut occuper qu'une seule position",
                )
            if not db.get(Player, item.player_id):
                raise HTTPException(status_code=400, detail="Joueur introuvable")
            used_players.add(item.player_id)
        slot_by_pos[item.position].player_id = item.player_id

    db.commit()
    return _load_composition(db, composition_id)
