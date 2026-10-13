from datetime import date, datetime

from sqlalchemy import Boolean, JSON, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    number: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    license_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    positions: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # titulaire | remplacant | apprentissage
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="titulaire")

    slots: Mapped[list["CompositionSlot"]] = relationship(back_populates="player")
    events: Mapped[list["MatchEvent"]] = relationship(back_populates="player")


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    opponent: Mapped[str] = mapped_column(String(150), nullable=False)
    match_date: Mapped[date] = mapped_column(Date, nullable=False)
    venue: Mapped[str] = mapped_column(String(150), default="Domicile")
    # 7 / 12 / 15 (défaut XV)
    team_size: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    half_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=35)
    score_home: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score_away: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Chrono mode match (partagé avec les visiteurs)
    clock_half: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    clock_remaining_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=35 * 60_000)
    clock_running: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    clock_started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    compositions: Mapped[list["Composition"]] = relationship(
        back_populates="match", cascade="all, delete-orphan"
    )
    events: Mapped[list["MatchEvent"]] = relationship(
        back_populates="match", cascade="all, delete-orphan"
    )


class MatchEvent(Base):
    """Événement de score pendant un match (mode match)."""

    __tablename__ = "match_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"))
    half: Mapped[int] = mapped_column(Integer, nullable=False, default=1)  # 1 ou 2
    minute: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # essai | transformation | penalite | drop
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # home = nous, away = adversaire
    team: Mapped[str] = mapped_column(String(10), nullable=False, default="home")
    player_id: Mapped[int | None] = mapped_column(
        ForeignKey("players.id", ondelete="SET NULL"), nullable=True
    )
    points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    match: Mapped["Match"] = relationship(back_populates="events")
    player: Mapped["Player | None"] = relationship(back_populates="events")


class Composition(Base):
    __tablename__ = "compositions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100), nullable=False, default="XV de départ")
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    match: Mapped["Match"] = relationship(back_populates="compositions")
    slots: Mapped[list["CompositionSlot"]] = relationship(
        back_populates="composition", cascade="all, delete-orphan"
    )


class CompositionSlot(Base):
    __tablename__ = "composition_slots"
    __table_args__ = (
        UniqueConstraint("composition_id", "position", name="uq_comp_position"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    composition_id: Mapped[int] = mapped_column(
        ForeignKey("compositions.id", ondelete="CASCADE")
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    player_id: Mapped[int] = mapped_column(
        ForeignKey("players.id", ondelete="SET NULL"), nullable=True
    )

    composition: Mapped["Composition"] = relationship(back_populates="slots")
    player: Mapped["Player | None"] = relationship(back_populates="slots")


# --- Planification des entraînements ---


class TrainingSeason(Base):
    """Saison sportive (typiquement septembre → juin)."""

    __tablename__ = "training_seasons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    slots: Mapped[list["TrainingWeeklySlot"]] = relationship(
        back_populates="season", cascade="all, delete-orphan", order_by="TrainingWeeklySlot.sort_order"
    )
    periods: Mapped[list["TrainingPeriod"]] = relationship(
        back_populates="season", cascade="all, delete-orphan", order_by="TrainingPeriod.start_date"
    )


class TrainingWeeklySlot(Base):
    """Créneau hebdomadaire récurrent (ex. mercredi 90 min)."""

    __tablename__ = "training_weekly_slots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    season_id: Mapped[int] = mapped_column(
        ForeignKey("training_seasons.id", ondelete="CASCADE"), nullable=False
    )
    # 0 = lundi … 6 = dimanche
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=90)
    label: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    season: Mapped["TrainingSeason"] = relationship(back_populates="slots")
    assignments: Mapped[list["TrainingAssignment"]] = relationship(
        back_populates="weekly_slot"
    )


class TrainingTemplate(Base):
    """Entraînement type réutilisable (bibliothèque)."""

    __tablename__ = "training_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
    themes: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    exercises: Mapped[list["TrainingExercise"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="TrainingExercise.sort_order",
    )
    assignments: Mapped[list["TrainingAssignment"]] = relationship(
        back_populates="template"
    )


class TrainingExercise(Base):
    """Exercice / atelier d'un entraînement type."""

    __tablename__ = "training_exercises"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    template_id: Mapped[int] = mapped_column(
        ForeignKey("training_templates.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(String(4000), nullable=False, default="")
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    template: Mapped["TrainingTemplate"] = relationship(back_populates="exercises")


class TrainingPeriod(Base):
    """Période thématique dans une saison."""

    __tablename__ = "training_periods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    season_id: Mapped[int] = mapped_column(
        ForeignKey("training_seasons.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False, default="")
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    themes: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    notes: Mapped[str] = mapped_column(String(2000), nullable=False, default="")

    season: Mapped["TrainingSeason"] = relationship(back_populates="periods")
    assignments: Mapped[list["TrainingAssignment"]] = relationship(
        back_populates="period", cascade="all, delete-orphan"
    )


class TrainingAssignment(Base):
    """Affectation d'un entraînement type à une période (+ créneau ou tous)."""

    __tablename__ = "training_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    period_id: Mapped[int] = mapped_column(
        ForeignKey("training_periods.id", ondelete="CASCADE"), nullable=False
    )
    template_id: Mapped[int] = mapped_column(
        ForeignKey("training_templates.id", ondelete="CASCADE"), nullable=False
    )
    # None = tous les créneaux de la semaine
    weekly_slot_id: Mapped[int | None] = mapped_column(
        ForeignKey("training_weekly_slots.id", ondelete="SET NULL"), nullable=True
    )

    period: Mapped["TrainingPeriod"] = relationship(back_populates="assignments")
    template: Mapped["TrainingTemplate"] = relationship(back_populates="assignments")
    weekly_slot: Mapped["TrainingWeeklySlot | None"] = relationship(
        back_populates="assignments"
    )
