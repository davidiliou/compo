"""Formats de match : nombre de titulaires / remplaçants."""

from typing import Literal

TeamSize = Literal[7, 12, 15]

FORMATS: dict[int, dict[str, int]] = {
    7: {"starters": 7, "subs": 5},
    12: {"starters": 12, "subs": 8},
    15: {"starters": 15, "subs": 8},
}

DEFAULT_TEAM_SIZE: TeamSize = 15
VALID_TEAM_SIZES = frozenset(FORMATS.keys())


def normalize_team_size(value) -> int:
    try:
        size = int(value)
    except (TypeError, ValueError):
        return DEFAULT_TEAM_SIZE
    return size if size in VALID_TEAM_SIZES else DEFAULT_TEAM_SIZE


def starter_count(team_size: int) -> int:
    return FORMATS[normalize_team_size(team_size)]["starters"]


def sub_count(team_size: int) -> int:
    return FORMATS[normalize_team_size(team_size)]["subs"]


def max_position(team_size: int) -> int:
    cfg = FORMATS[normalize_team_size(team_size)]
    return cfg["starters"] + cfg["subs"]


def default_composition_name(team_size: int) -> str:
    size = normalize_team_size(team_size)
    if size == 7:
        return "VII de départ"
    if size == 12:
        return "XII de départ"
    return "XV de départ"
