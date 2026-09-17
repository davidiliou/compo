from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator


# --- Players ---
class PlayerBase(BaseModel):
    number: int = Field(0, ge=0, le=99)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field("", max_length=100)
    license_number: str = Field(..., min_length=1, max_length=50)
    positions: list[int] = Field(default_factory=list)

    @field_validator("positions")
    @classmethod
    def validate_positions(cls, value: list[int]) -> list[int]:
        cleaned: list[int] = []
        for p in value:
            if not isinstance(p, int) or p < 1 or p > 15:
                raise ValueError("Les postes doivent être des numéros entre 1 et 15")
            if p not in cleaned:
                cleaned.append(p)
        return cleaned


class PlayerCreate(PlayerBase):
    pass


class PlayerUpdate(BaseModel):
    number: int | None = Field(None, ge=0, le=99)
    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    license_number: str | None = Field(None, min_length=1, max_length=50)
    positions: list[int] | None = None

    @field_validator("positions")
    @classmethod
    def validate_positions(cls, value: list[int] | None) -> list[int] | None:
        if value is None:
            return value
        cleaned: list[int] = []
        for p in value:
            if not isinstance(p, int) or p < 1 or p > 15:
                raise ValueError("Les postes doivent être des numéros entre 1 et 15")
            if p not in cleaned:
                cleaned.append(p)
        return cleaned


class PlayerOut(PlayerBase):
    id: int

    model_config = {"from_attributes": True}


class PlayerImportResult(BaseModel):
    created: int
    updated: int
    skipped: int
    errors: list[str] = []


# --- Matches ---
class MatchBase(BaseModel):
    opponent: str = Field(..., min_length=1, max_length=150)
    match_date: date
    venue: str = Field(default="Domicile", max_length=150)
    team_size: int = Field(default=15, description="7, 12 ou 15")
    half_duration_minutes: int = Field(default=35, ge=1, le=60)
    score_home: int | None = Field(None, ge=0)
    score_away: int | None = Field(None, ge=0)

    @field_validator("team_size")
    @classmethod
    def validate_team_size(cls, value: int) -> int:
        if value not in (7, 12, 15):
            raise ValueError("Le type de match doit être 7, 12 ou 15")
        return value


class MatchCreate(MatchBase):
    pass


class MatchUpdate(BaseModel):
    opponent: str | None = Field(None, min_length=1, max_length=150)
    match_date: date | None = None
    venue: str | None = Field(None, max_length=150)
    team_size: int | None = None
    half_duration_minutes: int | None = Field(None, ge=1, le=60)
    score_home: int | None = Field(None, ge=0)
    score_away: int | None = Field(None, ge=0)

    @field_validator("team_size")
    @classmethod
    def validate_team_size(cls, value: int | None) -> int | None:
        if value is None:
            return value
        if value not in (7, 12, 15):
            raise ValueError("Le type de match doit être 7, 12 ou 15")
        return value


class MatchOut(MatchBase):
    id: int
    created_at: datetime
    compositions_count: int = 0
    clock_half: int = 1
    clock_remaining_ms: int = 35 * 60_000
    clock_running: bool = False
    clock_started_at: datetime | None = None

    model_config = {"from_attributes": True}


class MatchClockUpdate(BaseModel):
    clock_half: int = Field(..., ge=1, le=2)
    clock_remaining_ms: int = Field(..., ge=0)
    clock_running: bool
    # Si running=True, le serveur pose clock_started_at = maintenant
    # Si running=False, clock_started_at est effacé


EVENT_POINTS = {
    "essai": 5,
    "transformation": 2,
    "penalite": 3,
    "drop": 3,
}

EVENT_TYPES = frozenset(EVENT_POINTS.keys())


class MatchEventCreate(BaseModel):
    half: int = Field(1, ge=1, le=2)
    minute: int = Field(0, ge=0, le=120)
    event_type: str
    team: str = Field("home")
    player_id: int | None = None

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, value: str) -> str:
        cleaned = (value or "").strip().lower()
        if cleaned not in EVENT_TYPES:
            raise ValueError("Type d'événement invalide")
        return cleaned

    @field_validator("team")
    @classmethod
    def validate_team(cls, value: str) -> str:
        cleaned = (value or "").strip().lower()
        if cleaned not in ("home", "away"):
            raise ValueError("Équipe invalide (home/away)")
        return cleaned


class MatchEventOut(BaseModel):
    id: int
    match_id: int
    half: int
    minute: int
    event_type: str
    team: str
    player_id: int | None
    points: int
    created_at: datetime
    player: PlayerOut | None = None

    model_config = {"from_attributes": True}


# --- Compositions ---
class SlotOut(BaseModel):
    id: int
    position: int
    player_id: int | None
    player: PlayerOut | None = None

    model_config = {"from_attributes": True}


class SlotAssign(BaseModel):
    position: int = Field(..., ge=1, le=23)
    player_id: int | None = None


class CompositionCreate(BaseModel):
    name: str = Field(default="Composition", min_length=1, max_length=100)


class CompositionUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    is_public: bool | None = None


class CompositionOut(BaseModel):
    id: int
    match_id: int
    name: str
    is_public: bool = False
    created_at: datetime
    slots: list[SlotOut] = []

    model_config = {"from_attributes": True}


class PublicPlayerOut(BaseModel):
    """Joueur exposé au public (sans n° de licence)."""

    id: int
    number: int
    first_name: str
    last_name: str = ""
    positions: list[int] = []

    model_config = {"from_attributes": True}


class PublicSlotOut(BaseModel):
    id: int
    position: int
    player_id: int | None
    player: PublicPlayerOut | None = None

    model_config = {"from_attributes": True}


class PublicCompositionOut(BaseModel):
    id: int
    match_id: int
    name: str
    created_at: datetime
    slots: list[PublicSlotOut] = []

    model_config = {"from_attributes": True}


class PublicMatchEventOut(BaseModel):
    id: int
    match_id: int
    half: int
    minute: int
    event_type: str
    team: str
    player_id: int | None
    points: int
    created_at: datetime
    player: PublicPlayerOut | None = None

    model_config = {"from_attributes": True}


class SlotsBulkUpdate(BaseModel):
    slots: list[SlotAssign]
