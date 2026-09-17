from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Match
from ..schemas import MatchCreate, MatchOut, MatchUpdate

router = APIRouter(prefix="/matches", tags=["matches"])


def _to_out(match: Match) -> MatchOut:
    return MatchOut(
        id=match.id,
        opponent=match.opponent,
        match_date=match.match_date,
        venue=match.venue,
        score_home=match.score_home,
        score_away=match.score_away,
        created_at=match.created_at,
        compositions_count=len(match.compositions),
    )


@router.get("", response_model=list[MatchOut])
def list_matches(db: Session = Depends(get_db)):
    matches = (
        db.query(Match)
        .options(joinedload(Match.compositions))
        .order_by(Match.match_date.desc())
        .all()
    )
    return [_to_out(m) for m in matches]


@router.post("", response_model=MatchOut, status_code=201)
def create_match(payload: MatchCreate, db: Session = Depends(get_db)):
    match = Match(**payload.model_dump())
    db.add(match)
    db.commit()
    db.refresh(match)
    return _to_out(match)


@router.get("/{match_id}", response_model=MatchOut)
def get_match(match_id: int, db: Session = Depends(get_db)):
    match = (
        db.query(Match)
        .options(joinedload(Match.compositions))
        .filter(Match.id == match_id)
        .first()
    )
    if not match:
        raise HTTPException(status_code=404, detail="Match introuvable")
    return _to_out(match)


@router.put("/{match_id}", response_model=MatchOut)
def update_match(match_id: int, payload: MatchUpdate, db: Session = Depends(get_db)):
    match = (
        db.query(Match)
        .options(joinedload(Match.compositions))
        .filter(Match.id == match_id)
        .first()
    )
    if not match:
        raise HTTPException(status_code=404, detail="Match introuvable")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(match, key, value)
    db.commit()
    db.refresh(match)
    return _to_out(match)


@router.delete("/{match_id}", status_code=204)
def delete_match(match_id: int, db: Session = Depends(get_db)):
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match introuvable")
    db.delete(match)
    db.commit()
