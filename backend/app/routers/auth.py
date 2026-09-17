from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import create_access_token, get_current_user, verify_password
from ..database import get_db
from ..models import User

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=200)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


class UserOut(BaseModel):
    id: int
    username: str

    model_config = {"from_attributes": True}


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    username = payload.username.strip().lower()
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Identifiants incorrects")
    token = create_access_token(user.username)
    return TokenResponse(access_token=token, username=user.username)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
