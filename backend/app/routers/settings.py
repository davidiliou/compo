import json
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Composition, CompositionSlot, Match, Player

router = APIRouter(
    prefix="/settings",
    tags=["settings"],
    dependencies=[Depends(get_current_user)],
)


class RestoreResult(BaseModel):
    players: int
    matches: int
    compositions: int
    slots: int


def _json_default(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    raise TypeError(f"Type non sérialisable: {type(value)}")


def _parse_date(value) -> date:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    return date.fromisoformat(str(value)[:10])


def _parse_datetime(value) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return datetime.utcnow()


@router.get("/backup")
def download_backup(db: Session = Depends(get_db)):
    """Exporte toute la base (joueurs, matchs, compositions, slots) en JSON."""
    players = db.query(Player).order_by(Player.id).all()
    matches = db.query(Match).order_by(Match.id).all()
    compositions = db.query(Composition).order_by(Composition.id).all()
    slots = db.query(CompositionSlot).order_by(CompositionSlot.id).all()

    payload = {
        "version": 1,
        "app": "compo-rugby",
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "players": [
            {
                "id": p.id,
                "number": p.number,
                "first_name": p.first_name,
                "last_name": p.last_name or "",
                "license_number": p.license_number,
                "positions": p.positions or [],
            }
            for p in players
        ],
        "matches": [
            {
                "id": m.id,
                "opponent": m.opponent,
                "match_date": m.match_date.isoformat(),
                "venue": m.venue,
                "score_home": m.score_home,
                "score_away": m.score_away,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in matches
        ],
        "compositions": [
            {
                "id": c.id,
                "match_id": c.match_id,
                "name": c.name,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in compositions
        ],
        "slots": [
            {
                "id": s.id,
                "composition_id": s.composition_id,
                "position": s.position,
                "player_id": s.player_id,
            }
            for s in slots
        ],
    }

    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"compo_backup_{stamp}.json"
    body = json.dumps(payload, ensure_ascii=False, indent=2, default=_json_default)

    return Response(
        content=body.encode("utf-8"),
        media_type="application/json; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.post("/restore", response_model=RestoreResult)
async def restore_backup(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Remplace toute la base par le contenu d’une sauvegarde JSON."""
    filename = (file.filename or "").lower()
    if not filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Fichier JSON attendu (.json)")

    try:
        payload = json.loads((await file.read()).decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"JSON invalide: {exc}") from exc

    if not isinstance(payload, dict) or "players" not in payload or "matches" not in payload:
        raise HTTPException(
            status_code=400,
            detail="Fichier de sauvegarde invalide (champs players/matches manquants)",
        )

    players_data = payload.get("players") or []
    matches_data = payload.get("matches") or []
    compositions_data = payload.get("compositions") or []
    slots_data = payload.get("slots") or []

    try:
        # Ordre FK
        db.query(CompositionSlot).delete()
        db.query(Composition).delete()
        db.query(Match).delete()
        db.query(Player).delete()
        db.flush()

        player_map: dict[int, int] = {}
        for row in players_data:
            old_id = row.get("id")
            player = Player(
                number=int(row.get("number") or 0),
                first_name=str(row.get("first_name") or "").strip() or "Sans prénom",
                last_name=str(row.get("last_name") or "").strip(),
                license_number=str(row.get("license_number") or "").strip(),
                positions=list(row.get("positions") or []),
            )
            if not player.license_number:
                raise HTTPException(
                    status_code=400,
                    detail=f"Joueur sans licence (ancien id={old_id})",
                )
            db.add(player)
            db.flush()
            if old_id is not None:
                player_map[int(old_id)] = player.id

        match_map: dict[int, int] = {}
        for row in matches_data:
            old_id = row.get("id")
            match = Match(
                opponent=str(row.get("opponent") or "").strip() or "Adversaire",
                match_date=_parse_date(row.get("match_date") or date.today().isoformat()),
                venue=str(row.get("venue") or "Domicile"),
                score_home=row.get("score_home"),
                score_away=row.get("score_away"),
                created_at=_parse_datetime(row.get("created_at")) or datetime.utcnow(),
            )
            db.add(match)
            db.flush()
            if old_id is not None:
                match_map[int(old_id)] = match.id

        comp_map: dict[int, int] = {}
        for row in compositions_data:
            old_id = row.get("id")
            old_match_id = row.get("match_id")
            new_match_id = match_map.get(int(old_match_id)) if old_match_id is not None else None
            if new_match_id is None:
                continue
            comp = Composition(
                match_id=new_match_id,
                name=str(row.get("name") or "Composition"),
                created_at=_parse_datetime(row.get("created_at")) or datetime.utcnow(),
            )
            db.add(comp)
            db.flush()
            if old_id is not None:
                comp_map[int(old_id)] = comp.id

        slots_count = 0
        for row in slots_data:
            old_comp_id = row.get("composition_id")
            new_comp_id = (
                comp_map.get(int(old_comp_id)) if old_comp_id is not None else None
            )
            if new_comp_id is None:
                continue
            old_player_id = row.get("player_id")
            new_player_id = None
            if old_player_id is not None:
                new_player_id = player_map.get(int(old_player_id))
            db.add(
                CompositionSlot(
                    composition_id=new_comp_id,
                    position=int(row.get("position") or 0),
                    player_id=new_player_id,
                )
            )
            slots_count += 1

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Import impossible: {exc}") from exc

    return RestoreResult(
        players=len(player_map) or len(players_data),
        matches=len(match_map) or len(matches_data),
        compositions=len(comp_map),
        slots=slots_count,
    )


@router.get("/info")
def settings_info(db: Session = Depends(get_db)):
    return {
        "players": db.query(Player).count(),
        "matches": db.query(Match).count(),
        "compositions": db.query(Composition).count(),
        "slots": db.query(CompositionSlot).count(),
    }
