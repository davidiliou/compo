"""API publique (visiteurs, sans authentification)."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Composition, CompositionSlot, Match, MatchEvent
from ..schemas import MatchOut, PublicCompositionOut, PublicMatchEventOut
from .matches import _to_out

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/matches", response_model=list[MatchOut])
def public_list_matches(db: Session = Depends(get_db)):
    matches = (
        db.query(Match)
        .options(joinedload(Match.compositions))
        .order_by(Match.match_date.desc(), Match.id.desc())
        .all()
    )
    return [_to_out(m) for m in matches]


@router.get("/matches/upcoming", response_model=MatchOut | None)
def public_next_match(db: Session = Depends(get_db)):
    today = date.today()
    match = (
        db.query(Match)
        .options(joinedload(Match.compositions))
        .filter(Match.match_date >= today)
        .order_by(Match.match_date.asc(), Match.id.asc())
        .first()
    )
    return _to_out(match) if match else None


@router.get("/matches/{match_id}", response_model=MatchOut)
def public_get_match(match_id: int, db: Session = Depends(get_db)):
    match = (
        db.query(Match)
        .options(joinedload(Match.compositions))
        .filter(Match.id == match_id)
        .first()
    )
    if not match:
        raise HTTPException(status_code=404, detail="Match introuvable")
    return _to_out(match)


@router.get(
    "/matches/{match_id}/compositions",
    response_model=list[PublicCompositionOut],
)
def public_list_compositions(match_id: int, db: Session = Depends(get_db)):
    if not db.get(Match, match_id):
        raise HTTPException(status_code=404, detail="Match introuvable")
    return (
        db.query(Composition)
        .options(joinedload(Composition.slots).joinedload(CompositionSlot.player))
        .filter(Composition.match_id == match_id, Composition.is_public.is_(True))
        .order_by(Composition.created_at)
        .all()
    )


@router.get("/compositions/{composition_id}", response_model=PublicCompositionOut)
def public_get_composition(composition_id: int, db: Session = Depends(get_db)):
    comp = (
        db.query(Composition)
        .options(joinedload(Composition.slots).joinedload(CompositionSlot.player))
        .filter(Composition.id == composition_id, Composition.is_public.is_(True))
        .first()
    )
    if not comp:
        raise HTTPException(status_code=404, detail="Composition introuvable")
    return comp


@router.get(
    "/matches/{match_id}/events",
    response_model=list[PublicMatchEventOut],
)
def public_list_events(match_id: int, db: Session = Depends(get_db)):
    if not db.get(Match, match_id):
        raise HTTPException(status_code=404, detail="Match introuvable")
    return (
        db.query(MatchEvent)
        .options(joinedload(MatchEvent.player))
        .filter(MatchEvent.match_id == match_id)
        .order_by(MatchEvent.half, MatchEvent.minute, MatchEvent.id)
        .all()
    )
