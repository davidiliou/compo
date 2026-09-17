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
    score_home: int | None = Field(None, ge=0)
    score_away: int | None = Field(None, ge=0)


class MatchCreate(MatchBase):
    pass


class MatchUpdate(BaseModel):
    opponent: str | None = Field(None, min_length=1, max_length=150)
    match_date: date | None = None
    venue: str | None = Field(None, max_length=150)
    score_home: int | None = Field(None, ge=0)
    score_away: int | None = Field(None, ge=0)


class MatchOut(MatchBase):
    id: int
    created_at: datetime
    compositions_count: int = 0

    model_config = {"from_attributes": True}


# --- Compositions ---
class SlotOut(BaseModel):
    id: int
    position: int
    player_id: int | None
    player: PlayerOut | None = None

    model_config = {"from_attributes": True}


class SlotAssign(BaseModel):
    position: int = Field(..., ge=1, le=23)  # 1-15 titulaires, 16-23 remplaçants
    player_id: int | None = None


class CompositionCreate(BaseModel):
    name: str = Field(default="XV de départ", min_length=1, max_length=100)


class CompositionUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)


class CompositionOut(BaseModel):
    id: int
    match_id: int
    name: str
    created_at: datetime
    slots: list[SlotOut] = []

    model_config = {"from_attributes": True}


class SlotsBulkUpdate(BaseModel):
    slots: list[SlotAssign]
