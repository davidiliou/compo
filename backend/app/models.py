from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
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

    slots: Mapped[list["CompositionSlot"]] = relationship(back_populates="player")


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    opponent: Mapped[str] = mapped_column(String(150), nullable=False)
    match_date: Mapped[date] = mapped_column(Date, nullable=False)
    venue: Mapped[str] = mapped_column(String(150), default="Domicile")
    score_home: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score_away: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    compositions: Mapped[list["Composition"]] = relationship(
        back_populates="match", cascade="all, delete-orphan"
    )


class Composition(Base):
    __tablename__ = "compositions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100), nullable=False, default="XV de départ")
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
