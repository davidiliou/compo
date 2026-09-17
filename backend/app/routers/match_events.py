from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user
from ..database import get_db
from ..models import Match, MatchEvent, Player
from ..schemas import EVENT_POINTS, MatchEventCreate, MatchEventOut, MatchOut
from .matches import _to_out

router = APIRouter(
    tags=["match-events"],
    dependencies=[Depends(get_current_user)],
)


def _recompute_scores(db: Session, match: Match) -> None:
    home = 0
    away = 0
    for ev in (
        db.query(MatchEvent).filter(MatchEvent.match_id == match.id).all()
    ):
        if ev.team == "home":
            home += ev.points
        else:
            away += ev.points
    match.score_home = home
    match.score_away = away
    db.commit()


def _load_event(db: Session, event_id: int) -> MatchEvent | None:
    return (
        db.query(MatchEvent)
        .options(joinedload(MatchEvent.player))
        .filter(MatchEvent.id == event_id)
        .first()
    )


@router.get("/matches/{match_id}/events", response_model=list[MatchEventOut])
def list_events(match_id: int, db: Session = Depends(get_db)):
    if not db.get(Match, match_id):
        raise HTTPException(status_code=404, detail="Match introuvable")
    return (
        db.query(MatchEvent)
        .options(joinedload(MatchEvent.player))
        .filter(MatchEvent.match_id == match_id)
        .order_by(MatchEvent.half, MatchEvent.minute, MatchEvent.id)
        .all()
    )


@router.post(
    "/matches/{match_id}/events",
    response_model=MatchEventOut,
    status_code=201,
)
def create_event(
    match_id: int, payload: MatchEventCreate, db: Session = Depends(get_db)
):
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match introuvable")

    player_id = payload.player_id
    if payload.team == "away":
        player_id = None
    elif player_id is not None and not db.get(Player, player_id):
        raise HTTPException(status_code=400, detail="Joueur introuvable")

    event = MatchEvent(
        match_id=match_id,
        half=payload.half,
        minute=payload.minute,
        event_type=payload.event_type,
        team=payload.team,
        player_id=player_id,
        points=EVENT_POINTS[payload.event_type],
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    _recompute_scores(db, match)
    loaded = _load_event(db, event.id)
    if not loaded:
        raise HTTPException(status_code=500, detail="Événement non rechargé")
    return loaded


@router.delete("/events/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db)):
    event = db.get(MatchEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    match = db.get(Match, event.match_id)
    db.delete(event)
    db.commit()
    if match:
        _recompute_scores(db, match)


@router.get("/matches/{match_id}/live", response_model=MatchOut)
def get_match_live(match_id: int, db: Session = Depends(get_db)):
    """Rafraîchit le match (scores inclus) pour le mode live."""
    match = (
        db.query(Match)
        .options(joinedload(Match.compositions))
        .filter(Match.id == match_id)
        .first()
    )
    if not match:
        raise HTTPException(status_code=404, detail="Match introuvable")
    return _to_out(match)
