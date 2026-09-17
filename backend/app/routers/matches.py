from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user
from ..database import engine, get_db
from ..match_formats import normalize_team_size
from ..models import Match
from ..schemas import MatchCreate, MatchOut, MatchUpdate
from .compositions import sync_match_compositions

router = APIRouter(
    prefix="/matches",
    tags=["matches"],
    dependencies=[Depends(get_current_user)],
)


def ensure_match_columns() -> None:
    """Ajoute team_size / half_duration_minutes si la table existait déjà."""
    with engine.begin() as conn:
        dialect = engine.dialect.name
        if dialect == "sqlite":
            cols = {
                row[1] for row in conn.execute(text("PRAGMA table_info(matches)")).fetchall()
            }
            if "team_size" not in cols:
                conn.execute(
                    text("ALTER TABLE matches ADD COLUMN team_size INTEGER DEFAULT 15")
                )
                conn.execute(
                    text("UPDATE matches SET team_size = 15 WHERE team_size IS NULL")
                )
            if "half_duration_minutes" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE matches ADD COLUMN half_duration_minutes "
                        "INTEGER DEFAULT 35"
                    )
                )
                conn.execute(
                    text(
                        "UPDATE matches SET half_duration_minutes = 35 "
                        "WHERE half_duration_minutes IS NULL"
                    )
                )
        else:
            cols = {
                row[0]
                for row in conn.execute(
                    text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_name = 'matches'"
                    )
                ).fetchall()
            }
            if "team_size" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE matches ADD COLUMN team_size INTEGER "
                        "NOT NULL DEFAULT 15"
                    )
                )
            if "half_duration_minutes" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE matches ADD COLUMN half_duration_minutes "
                        "INTEGER NOT NULL DEFAULT 35"
                    )
                )


def _to_out(match: Match) -> MatchOut:
    return MatchOut(
        id=match.id,
        opponent=match.opponent,
        match_date=match.match_date,
        venue=match.venue,
        team_size=normalize_team_size(getattr(match, "team_size", 15)),
        half_duration_minutes=int(getattr(match, "half_duration_minutes", 35) or 35),
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
    data = payload.model_dump()
    data["team_size"] = normalize_team_size(data.get("team_size", 15))
    match = Match(**data)
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
    data = payload.model_dump(exclude_unset=True)
    if "team_size" in data and data["team_size"] is not None:
        data["team_size"] = normalize_team_size(data["team_size"])
    old_size = normalize_team_size(getattr(match, "team_size", 15))
    for key, value in data.items():
        setattr(match, key, value)
    db.commit()
    db.refresh(match)
    new_size = normalize_team_size(getattr(match, "team_size", 15))
    if new_size != old_size:
        sync_match_compositions(db, match)
        match = (
            db.query(Match)
            .options(joinedload(Match.compositions))
            .filter(Match.id == match_id)
            .first()
        )
    return _to_out(match)


@router.delete("/{match_id}", status_code=204)
def delete_match(match_id: int, db: Session = Depends(get_db)):
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match introuvable")
    db.delete(match)
    db.commit()
