import json
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import (
    Composition,
    CompositionSlot,
    Match,
    MatchEvent,
    Player,
    TrainingAssignment,
    TrainingExercise,
    TrainingPeriod,
    TrainingSeason,
    TrainingTemplate,
    TrainingWeeklySlot,
)

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
    training_seasons: int = 0
    training_templates: int = 0


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
    events = db.query(MatchEvent).order_by(MatchEvent.id).all()
    training_seasons = db.query(TrainingSeason).order_by(TrainingSeason.id).all()
    training_slots = db.query(TrainingWeeklySlot).order_by(TrainingWeeklySlot.id).all()
    training_periods = db.query(TrainingPeriod).order_by(TrainingPeriod.id).all()
    training_templates = db.query(TrainingTemplate).order_by(TrainingTemplate.id).all()
    training_exercises = db.query(TrainingExercise).order_by(TrainingExercise.id).all()
    training_assignments = (
        db.query(TrainingAssignment).order_by(TrainingAssignment.id).all()
    )

    payload = {
        "version": 2,
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
                "team_size": getattr(m, "team_size", 15) or 15,
                "half_duration_minutes": getattr(m, "half_duration_minutes", 35) or 35,
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
                "is_public": bool(getattr(c, "is_public", False)),
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
        "events": [
            {
                "id": e.id,
                "match_id": e.match_id,
                "half": e.half,
                "minute": e.minute,
                "event_type": e.event_type,
                "team": e.team,
                "player_id": e.player_id,
                "points": e.points,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ],
        "training_seasons": [
            {
                "id": s.id,
                "name": s.name,
                "start_date": s.start_date.isoformat(),
                "end_date": s.end_date.isoformat(),
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in training_seasons
        ],
        "training_weekly_slots": [
            {
                "id": s.id,
                "season_id": s.season_id,
                "weekday": s.weekday,
                "duration_minutes": s.duration_minutes,
                "label": s.label or "",
                "sort_order": s.sort_order,
            }
            for s in training_slots
        ],
        "training_periods": [
            {
                "id": p.id,
                "season_id": p.season_id,
                "name": p.name or "",
                "start_date": p.start_date.isoformat(),
                "end_date": p.end_date.isoformat(),
                "themes": p.themes or [],
                "notes": p.notes or "",
            }
            for p in training_periods
        ],
        "training_templates": [
            {
                "id": t.id,
                "title": t.title,
                "description": t.description or "",
                "themes": t.themes or [],
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in training_templates
        ],
        "training_exercises": [
            {
                "id": e.id,
                "template_id": e.template_id,
                "title": e.title,
                "description": e.description or "",
                "duration_minutes": e.duration_minutes,
                "sort_order": e.sort_order,
            }
            for e in training_exercises
        ],
        "training_assignments": [
            {
                "id": a.id,
                "period_id": a.period_id,
                "template_id": a.template_id,
                "weekly_slot_id": a.weekly_slot_id,
            }
            for a in training_assignments
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
    events_data = payload.get("events") or []
    training_seasons_data = payload.get("training_seasons") or []
    training_slots_data = payload.get("training_weekly_slots") or []
    training_periods_data = payload.get("training_periods") or []
    training_templates_data = payload.get("training_templates") or []
    training_exercises_data = payload.get("training_exercises") or []
    training_assignments_data = payload.get("training_assignments") or []

    try:
        # Ordre FK
        db.query(TrainingAssignment).delete()
        db.query(TrainingExercise).delete()
        db.query(TrainingPeriod).delete()
        db.query(TrainingWeeklySlot).delete()
        db.query(TrainingTemplate).delete()
        db.query(TrainingSeason).delete()
        db.query(MatchEvent).delete()
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
                team_size=int(row.get("team_size") or 15)
                if int(row.get("team_size") or 15) in (7, 12, 15)
                else 15,
                half_duration_minutes=max(
                    1, min(60, int(row.get("half_duration_minutes") or 35))
                ),
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
                is_public=bool(row.get("is_public", False)),
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

        from ..schemas import EVENT_POINTS

        for row in events_data:
            old_match_id = row.get("match_id")
            new_match_id = (
                match_map.get(int(old_match_id)) if old_match_id is not None else None
            )
            if new_match_id is None:
                continue
            etype = str(row.get("event_type") or "").strip().lower()
            if etype not in EVENT_POINTS:
                continue
            old_player_id = row.get("player_id")
            new_player_id = None
            if old_player_id is not None:
                new_player_id = player_map.get(int(old_player_id))
            team = str(row.get("team") or "home").lower()
            if team not in ("home", "away"):
                team = "home"
            db.add(
                MatchEvent(
                    match_id=new_match_id,
                    half=1 if int(row.get("half") or 1) != 2 else 2,
                    minute=max(0, int(row.get("minute") or 0)),
                    event_type=etype,
                    team=team,
                    player_id=new_player_id if team == "home" else None,
                    points=int(row.get("points") or EVENT_POINTS[etype]),
                    created_at=_parse_datetime(row.get("created_at")) or datetime.utcnow(),
                )
            )

        season_map: dict[int, int] = {}
        for row in training_seasons_data:
            old_id = row.get("id")
            season = TrainingSeason(
                name=str(row.get("name") or "Saison").strip() or "Saison",
                start_date=_parse_date(row.get("start_date") or "2025-09-01"),
                end_date=_parse_date(row.get("end_date") or "2026-06-30"),
                created_at=_parse_datetime(row.get("created_at")) or datetime.utcnow(),
            )
            db.add(season)
            db.flush()
            if old_id is not None:
                season_map[int(old_id)] = season.id

        training_slot_map: dict[int, int] = {}
        for row in training_slots_data:
            old_id = row.get("id")
            old_season_id = row.get("season_id")
            new_season_id = (
                season_map.get(int(old_season_id)) if old_season_id is not None else None
            )
            if new_season_id is None:
                continue
            weekday = max(0, min(6, int(row.get("weekday") or 0)))
            slot = TrainingWeeklySlot(
                season_id=new_season_id,
                weekday=weekday,
                duration_minutes=max(15, min(300, int(row.get("duration_minutes") or 90))),
                label=str(row.get("label") or ""),
                sort_order=int(row.get("sort_order") or 0),
            )
            db.add(slot)
            db.flush()
            if old_id is not None:
                training_slot_map[int(old_id)] = slot.id

        period_map: dict[int, int] = {}
        for row in training_periods_data:
            old_id = row.get("id")
            old_season_id = row.get("season_id")
            new_season_id = (
                season_map.get(int(old_season_id)) if old_season_id is not None else None
            )
            if new_season_id is None:
                continue
            period = TrainingPeriod(
                season_id=new_season_id,
                name=str(row.get("name") or ""),
                start_date=_parse_date(row.get("start_date") or "2025-09-01"),
                end_date=_parse_date(row.get("end_date") or "2025-09-30"),
                themes=list(row.get("themes") or []),
                notes=str(row.get("notes") or ""),
            )
            db.add(period)
            db.flush()
            if old_id is not None:
                period_map[int(old_id)] = period.id

        template_map: dict[int, int] = {}
        for row in training_templates_data:
            old_id = row.get("id")
            tpl = TrainingTemplate(
                title=str(row.get("title") or "Entraînement").strip() or "Entraînement",
                description=str(row.get("description") or ""),
                themes=list(row.get("themes") or []),
                created_at=_parse_datetime(row.get("created_at")) or datetime.utcnow(),
            )
            db.add(tpl)
            db.flush()
            if old_id is not None:
                template_map[int(old_id)] = tpl.id

        for row in training_exercises_data:
            old_tpl_id = row.get("template_id")
            new_tpl_id = (
                template_map.get(int(old_tpl_id)) if old_tpl_id is not None else None
            )
            if new_tpl_id is None:
                continue
            db.add(
                TrainingExercise(
                    template_id=new_tpl_id,
                    title=str(row.get("title") or "Exercice").strip() or "Exercice",
                    description=str(row.get("description") or ""),
                    duration_minutes=max(
                        1, min(180, int(row.get("duration_minutes") or 10))
                    ),
                    sort_order=int(row.get("sort_order") or 0),
                )
            )

        for row in training_assignments_data:
            old_period_id = row.get("period_id")
            old_tpl_id = row.get("template_id")
            new_period_id = (
                period_map.get(int(old_period_id)) if old_period_id is not None else None
            )
            new_tpl_id = (
                template_map.get(int(old_tpl_id)) if old_tpl_id is not None else None
            )
            if new_period_id is None or new_tpl_id is None:
                continue
            old_slot_id = row.get("weekly_slot_id")
            new_slot_id = None
            if old_slot_id is not None:
                new_slot_id = training_slot_map.get(int(old_slot_id))
            db.add(
                TrainingAssignment(
                    period_id=new_period_id,
                    template_id=new_tpl_id,
                    weekly_slot_id=new_slot_id,
                )
            )

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
        training_seasons=len(season_map) or len(training_seasons_data),
        training_templates=len(template_map) or len(training_templates_data),
    )


@router.get("/info")
def settings_info(db: Session = Depends(get_db)):
    return {
        "players": db.query(Player).count(),
        "matches": db.query(Match).count(),
        "compositions": db.query(Composition).count(),
        "slots": db.query(CompositionSlot).count(),
        "training_seasons": db.query(TrainingSeason).count(),
        "training_templates": db.query(TrainingTemplate).count(),
    }
