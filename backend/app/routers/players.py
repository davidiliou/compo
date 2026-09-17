from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Player
from ..schemas import PlayerCreate, PlayerOut, PlayerUpdate

router = APIRouter(prefix="/players", tags=["players"])


@router.get("", response_model=list[PlayerOut])
def list_players(db: Session = Depends(get_db)):
    return db.query(Player).order_by(Player.number).all()


@router.post("", response_model=PlayerOut, status_code=201)
def create_player(payload: PlayerCreate, db: Session = Depends(get_db)):
    if db.query(Player).filter(Player.license_number == payload.license_number).first():
        raise HTTPException(status_code=400, detail="Numéro de licence déjà utilisé")
    player = Player(**payload.model_dump())
    db.add(player)
    db.commit()
    db.refresh(player)
    return player


@router.get("/{player_id}", response_model=PlayerOut)
def get_player(player_id: int, db: Session = Depends(get_db)):
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Joueur introuvable")
    return player


@router.put("/{player_id}", response_model=PlayerOut)
def update_player(player_id: int, payload: PlayerUpdate, db: Session = Depends(get_db)):
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Joueur introuvable")
    data = payload.model_dump(exclude_unset=True)
    if "license_number" in data:
        existing = (
            db.query(Player)
            .filter(Player.license_number == data["license_number"], Player.id != player_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Numéro de licence déjà utilisé")
    for key, value in data.items():
        setattr(player, key, value)
    db.commit()
    db.refresh(player)
    return player


@router.delete("/{player_id}", status_code=204)
def delete_player(player_id: int, db: Session = Depends(get_db)):
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Joueur introuvable")
    db.delete(player)
    db.commit()
