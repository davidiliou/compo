from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Composition, CompositionSlot, Match, Player
from ..schemas import (
    CompositionCreate,
    CompositionOut,
    CompositionUpdate,
    SlotsBulkUpdate,
)

router = APIRouter(tags=["compositions"])

POSITION_LABELS = {
    1: "Pilier gauche",
    2: "Talonneur",
    3: "Pilier droit",
    4: "2e ligne",
    5: "2e ligne",
    6: "3e ligne aile",
    7: "3e ligne aile",
    8: "3e ligne centre",
    9: "Demi de mêlée",
    10: "Demi d'ouverture",
    11: "Ailier",
    12: "Centre",
    13: "Centre",
    14: "Ailier",
    15: "Arrière",
}


def _load_composition(db: Session, composition_id: int) -> Composition | None:
    return (
        db.query(Composition)
        .options(joinedload(Composition.slots).joinedload(CompositionSlot.player))
        .filter(Composition.id == composition_id)
        .first()
    )


def _ensure_slots(db: Session, composition: Composition) -> None:
    existing = {s.position for s in composition.slots}
    for pos in range(1, 16):
        if pos not in existing:
            db.add(CompositionSlot(composition_id=composition.id, position=pos, player_id=None))
    db.commit()


@router.get("/matches/{match_id}/compositions", response_model=list[CompositionOut])
def list_compositions(match_id: int, db: Session = Depends(get_db)):
    if not db.get(Match, match_id):
        raise HTTPException(status_code=404, detail="Match introuvable")
    comps = (
        db.query(Composition)
        .options(joinedload(Composition.slots).joinedload(CompositionSlot.player))
        .filter(Composition.match_id == match_id)
        .order_by(Composition.created_at)
        .all()
    )
    return comps


@router.post(
    "/matches/{match_id}/compositions",
    response_model=CompositionOut,
    status_code=201,
)
def create_composition(
    match_id: int, payload: CompositionCreate, db: Session = Depends(get_db)
):
    if not db.get(Match, match_id):
        raise HTTPException(status_code=404, detail="Match introuvable")
    comp = Composition(match_id=match_id, name=payload.name)
    db.add(comp)
    db.commit()
    db.refresh(comp)
    for pos in range(1, 16):
        db.add(CompositionSlot(composition_id=comp.id, position=pos, player_id=None))
    db.commit()
    return _load_composition(db, comp.id)


@router.get("/compositions/{composition_id}", response_model=CompositionOut)
def get_composition(composition_id: int, db: Session = Depends(get_db)):
    comp = _load_composition(db, composition_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Composition introuvable")
    return comp


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
    _ensure_slots(db, comp)
    comp = _load_composition(db, composition_id)

    slot_by_pos = {s.position: s for s in comp.slots}
    used_players: set[int] = set()

    for item in payload.slots:
        if item.position not in slot_by_pos:
            raise HTTPException(status_code=400, detail=f"Position invalide: {item.position}")
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
