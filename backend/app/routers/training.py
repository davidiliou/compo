from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user
from ..database import get_db
from ..models import (
    TrainingAssignment,
    TrainingExercise,
    TrainingPeriod,
    TrainingSeason,
    TrainingTemplate,
    TrainingWeeklySlot,
)
from ..schemas import (
    DEFAULT_TRAINING_THEMES,
    WEEKDAYS_FR,
    TrainingAssignmentIn,
    TrainingAssignmentOut,
    TrainingExerciseOut,
    TrainingPeriodCreate,
    TrainingPeriodOut,
    TrainingPeriodUpdate,
    TrainingSeasonCreate,
    TrainingSeasonOut,
    TrainingSeasonSummary,
    TrainingSeasonUpdate,
    TrainingTemplateCreate,
    TrainingTemplateOut,
    TrainingTemplateUpdate,
    TrainingWeeklySlotOut,
)

router = APIRouter(
    prefix="/training",
    tags=["training"],
    dependencies=[Depends(get_current_user)],
)


def _slot_out(slot: TrainingWeeklySlot) -> TrainingWeeklySlotOut:
    return TrainingWeeklySlotOut(
        id=slot.id,
        season_id=slot.season_id,
        weekday=slot.weekday,
        duration_minutes=slot.duration_minutes,
        label=slot.label or "",
        sort_order=slot.sort_order,
        weekday_label=WEEKDAYS_FR[slot.weekday] if 0 <= slot.weekday <= 6 else "",
    )


def _template_out(tpl: TrainingTemplate) -> TrainingTemplateOut:
    exercises = sorted(tpl.exercises or [], key=lambda e: (e.sort_order, e.id))
    total = sum(e.duration_minutes for e in exercises)
    return TrainingTemplateOut(
        id=tpl.id,
        title=tpl.title,
        description=tpl.description or "",
        themes=list(tpl.themes or []),
        created_at=tpl.created_at,
        exercises=[
            TrainingExerciseOut(
                id=e.id,
                title=e.title,
                description=e.description or "",
                duration_minutes=e.duration_minutes,
                sort_order=e.sort_order,
            )
            for e in exercises
        ],
        total_duration_minutes=total,
    )


def _assignment_out(a: TrainingAssignment) -> TrainingAssignmentOut:
    return TrainingAssignmentOut(
        id=a.id,
        period_id=a.period_id,
        template_id=a.template_id,
        weekly_slot_id=a.weekly_slot_id,
        template=_template_out(a.template) if a.template else None,
        weekly_slot=_slot_out(a.weekly_slot) if a.weekly_slot else None,
    )


def _period_out(period: TrainingPeriod) -> TrainingPeriodOut:
    return TrainingPeriodOut(
        id=period.id,
        season_id=period.season_id,
        name=period.name or "",
        start_date=period.start_date,
        end_date=period.end_date,
        themes=list(period.themes or []),
        notes=period.notes or "",
        assignments=[_assignment_out(a) for a in (period.assignments or [])],
    )


def _season_out(season: TrainingSeason) -> TrainingSeasonOut:
    slots = sorted(season.slots or [], key=lambda s: (s.sort_order, s.weekday, s.id))
    periods = sorted(season.periods or [], key=lambda p: (p.start_date, p.id))
    return TrainingSeasonOut(
        id=season.id,
        name=season.name,
        start_date=season.start_date,
        end_date=season.end_date,
        created_at=season.created_at,
        slots=[_slot_out(s) for s in slots],
        periods=[_period_out(p) for p in periods],
    )


def _get_season(db: Session, season_id: int) -> TrainingSeason:
    season = (
        db.query(TrainingSeason)
        .options(
            joinedload(TrainingSeason.slots),
            joinedload(TrainingSeason.periods)
            .joinedload(TrainingPeriod.assignments)
            .joinedload(TrainingAssignment.template)
            .joinedload(TrainingTemplate.exercises),
            joinedload(TrainingSeason.periods)
            .joinedload(TrainingPeriod.assignments)
            .joinedload(TrainingAssignment.weekly_slot),
        )
        .filter(TrainingSeason.id == season_id)
        .first()
    )
    if not season:
        raise HTTPException(status_code=404, detail="Saison introuvable")
    return season


def _get_template(db: Session, template_id: int) -> TrainingTemplate:
    tpl = (
        db.query(TrainingTemplate)
        .options(joinedload(TrainingTemplate.exercises))
        .filter(TrainingTemplate.id == template_id)
        .first()
    )
    if not tpl:
        raise HTTPException(status_code=404, detail="Entraînement type introuvable")
    return tpl


def _get_period(db: Session, period_id: int) -> TrainingPeriod:
    period = (
        db.query(TrainingPeriod)
        .options(
            joinedload(TrainingPeriod.assignments)
            .joinedload(TrainingAssignment.template)
            .joinedload(TrainingTemplate.exercises),
            joinedload(TrainingPeriod.assignments).joinedload(
                TrainingAssignment.weekly_slot
            ),
        )
        .filter(TrainingPeriod.id == period_id)
        .first()
    )
    if not period:
        raise HTTPException(status_code=404, detail="Période introuvable")
    return period


def _replace_exercises(
    db: Session, template: TrainingTemplate, exercises_data: list
) -> None:
    template.exercises.clear()
    db.flush()
    for i, ex in enumerate(exercises_data):
        template.exercises.append(
            TrainingExercise(
                title=ex.title,
                description=ex.description or "",
                duration_minutes=ex.duration_minutes,
                sort_order=ex.sort_order if ex.sort_order else i,
            )
        )


def _replace_slots(
    db: Session, season: TrainingSeason, slots_data: list
) -> None:
    """Met à jour les créneaux en place pour préserver les IDs (affectations)."""
    existing = sorted(season.slots or [], key=lambda s: (s.sort_order, s.id))
    for i, slot_in in enumerate(slots_data):
        label = slot_in.label or WEEKDAYS_FR[slot_in.weekday]
        sort_order = slot_in.sort_order if slot_in.sort_order else i
        if i < len(existing):
            slot = existing[i]
            slot.weekday = slot_in.weekday
            slot.duration_minutes = slot_in.duration_minutes
            slot.label = label
            slot.sort_order = sort_order
        else:
            season.slots.append(
                TrainingWeeklySlot(
                    weekday=slot_in.weekday,
                    duration_minutes=slot_in.duration_minutes,
                    label=label,
                    sort_order=sort_order,
                )
            )
    for slot in existing[len(slots_data) :]:
        db.delete(slot)


# --- Thèmes suggérés ---


@router.get("/themes")
def list_themes():
    return {"themes": DEFAULT_TRAINING_THEMES}


# --- Templates (entraînements types) ---


@router.get("/templates", response_model=list[TrainingTemplateOut])
def list_templates(db: Session = Depends(get_db)):
    rows = (
        db.query(TrainingTemplate)
        .options(joinedload(TrainingTemplate.exercises))
        .order_by(TrainingTemplate.title)
        .all()
    )
    return [_template_out(t) for t in rows]


@router.post("/templates", response_model=TrainingTemplateOut, status_code=201)
def create_template(payload: TrainingTemplateCreate, db: Session = Depends(get_db)):
    tpl = TrainingTemplate(
        title=payload.title.strip(),
        description=payload.description or "",
        themes=payload.themes,
    )
    db.add(tpl)
    db.flush()
    _replace_exercises(db, tpl, payload.exercises)
    db.commit()
    return _template_out(_get_template(db, tpl.id))


@router.get("/templates/{template_id}", response_model=TrainingTemplateOut)
def get_template(template_id: int, db: Session = Depends(get_db)):
    return _template_out(_get_template(db, template_id))


@router.put("/templates/{template_id}", response_model=TrainingTemplateOut)
def update_template(
    template_id: int,
    payload: TrainingTemplateUpdate,
    db: Session = Depends(get_db),
):
    tpl = _get_template(db, template_id)
    if payload.title is not None:
        tpl.title = payload.title.strip()
    if payload.description is not None:
        tpl.description = payload.description
    if payload.themes is not None:
        tpl.themes = payload.themes
    if payload.exercises is not None:
        _replace_exercises(db, tpl, payload.exercises)
    db.commit()
    return _template_out(_get_template(db, template_id))


@router.delete("/templates/{template_id}", status_code=204)
def delete_template(template_id: int, db: Session = Depends(get_db)):
    tpl = _get_template(db, template_id)
    db.delete(tpl)
    db.commit()


# --- Saisons ---


@router.get("/seasons", response_model=list[TrainingSeasonSummary])
def list_seasons(db: Session = Depends(get_db)):
    rows = (
        db.query(TrainingSeason)
        .options(
            joinedload(TrainingSeason.slots),
            joinedload(TrainingSeason.periods),
        )
        .order_by(TrainingSeason.start_date.desc())
        .all()
    )
    return [
        TrainingSeasonSummary(
            id=s.id,
            name=s.name,
            start_date=s.start_date,
            end_date=s.end_date,
            created_at=s.created_at,
            slots_count=len(s.slots or []),
            periods_count=len(s.periods or []),
        )
        for s in rows
    ]


@router.post("/seasons", response_model=TrainingSeasonOut, status_code=201)
def create_season(payload: TrainingSeasonCreate, db: Session = Depends(get_db)):
    if payload.end_date < payload.start_date:
        raise HTTPException(
            status_code=400, detail="La date de fin doit être après le début"
        )
    season = TrainingSeason(
        name=payload.name.strip(),
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    db.add(season)
    db.flush()
    if payload.slots:
        _replace_slots(db, season, payload.slots)
    db.commit()
    return _season_out(_get_season(db, season.id))


@router.get("/seasons/{season_id}", response_model=TrainingSeasonOut)
def get_season(season_id: int, db: Session = Depends(get_db)):
    return _season_out(_get_season(db, season_id))


@router.put("/seasons/{season_id}", response_model=TrainingSeasonOut)
def update_season(
    season_id: int,
    payload: TrainingSeasonUpdate,
    db: Session = Depends(get_db),
):
    season = _get_season(db, season_id)
    if payload.name is not None:
        season.name = payload.name.strip()
    if payload.start_date is not None:
        season.start_date = payload.start_date
    if payload.end_date is not None:
        season.end_date = payload.end_date
    if season.end_date < season.start_date:
        raise HTTPException(
            status_code=400, detail="La date de fin doit être après le début"
        )
    if payload.slots is not None:
        _replace_slots(db, season, payload.slots)
    db.commit()
    return _season_out(_get_season(db, season_id))


@router.delete("/seasons/{season_id}", status_code=204)
def delete_season(season_id: int, db: Session = Depends(get_db)):
    season = _get_season(db, season_id)
    db.delete(season)
    db.commit()


# --- Périodes ---


@router.post(
    "/seasons/{season_id}/periods",
    response_model=TrainingPeriodOut,
    status_code=201,
)
def create_period(
    season_id: int,
    payload: TrainingPeriodCreate,
    db: Session = Depends(get_db),
):
    season = _get_season(db, season_id)
    if payload.end_date < payload.start_date:
        raise HTTPException(
            status_code=400, detail="La date de fin doit être après le début"
        )
    if payload.start_date < season.start_date or payload.end_date > season.end_date:
        raise HTTPException(
            status_code=400,
            detail="La période doit être comprise dans la saison",
        )
    period = TrainingPeriod(
        season_id=season.id,
        name=payload.name.strip() if payload.name else "",
        start_date=payload.start_date,
        end_date=payload.end_date,
        themes=payload.themes,
        notes=payload.notes or "",
    )
    db.add(period)
    db.commit()
    return _period_out(_get_period(db, period.id))


@router.put("/periods/{period_id}", response_model=TrainingPeriodOut)
def update_period(
    period_id: int,
    payload: TrainingPeriodUpdate,
    db: Session = Depends(get_db),
):
    period = _get_period(db, period_id)
    season = db.query(TrainingSeason).filter(TrainingSeason.id == period.season_id).first()
    if payload.name is not None:
        period.name = payload.name.strip()
    if payload.start_date is not None:
        period.start_date = payload.start_date
    if payload.end_date is not None:
        period.end_date = payload.end_date
    if payload.themes is not None:
        period.themes = payload.themes
    if payload.notes is not None:
        period.notes = payload.notes
    if period.end_date < period.start_date:
        raise HTTPException(
            status_code=400, detail="La date de fin doit être après le début"
        )
    if season and (
        period.start_date < season.start_date or period.end_date > season.end_date
    ):
        raise HTTPException(
            status_code=400,
            detail="La période doit être comprise dans la saison",
        )
    db.commit()
    return _period_out(_get_period(db, period_id))


@router.delete("/periods/{period_id}", status_code=204)
def delete_period(period_id: int, db: Session = Depends(get_db)):
    period = _get_period(db, period_id)
    db.delete(period)
    db.commit()


# --- Affectations ---


@router.post(
    "/periods/{period_id}/assignments",
    response_model=TrainingAssignmentOut,
    status_code=201,
)
def create_assignment(
    period_id: int,
    payload: TrainingAssignmentIn,
    db: Session = Depends(get_db),
):
    period = _get_period(db, period_id)
    tpl = _get_template(db, payload.template_id)
    if payload.weekly_slot_id is not None:
        slot = (
            db.query(TrainingWeeklySlot)
            .filter(
                TrainingWeeklySlot.id == payload.weekly_slot_id,
                TrainingWeeklySlot.season_id == period.season_id,
            )
            .first()
        )
        if not slot:
            raise HTTPException(
                status_code=400,
                detail="Créneau introuvable pour cette saison",
            )

    assignment = TrainingAssignment(
        period_id=period.id,
        template_id=tpl.id,
        weekly_slot_id=payload.weekly_slot_id,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    # Recharger avec relations
    period = _get_period(db, period_id)
    for a in period.assignments:
        if a.id == assignment.id:
            return _assignment_out(a)
    raise HTTPException(status_code=500, detail="Affectation non trouvée après création")


@router.delete("/assignments/{assignment_id}", status_code=204)
def delete_assignment(assignment_id: int, db: Session = Depends(get_db)):
    assignment = (
        db.query(TrainingAssignment)
        .filter(TrainingAssignment.id == assignment_id)
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Affectation introuvable")
    db.delete(assignment)
    db.commit()
