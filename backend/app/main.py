from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .auth import seed_users
from .database import Base, SessionLocal, engine
from .routers import auth, compositions, matches, players, settings
from .routers.players import ensure_player_columns

app = FastAPI(title="Compo Rugby API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(players.router, prefix="/api")
app.include_router(matches.router, prefix="/api")
app.include_router(compositions.router, prefix="/api")
app.include_router(settings.router, prefix="/api")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    ensure_player_columns()
    db: Session = SessionLocal()
    try:
        seed_users(db)
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok"}
