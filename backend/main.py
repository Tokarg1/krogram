from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from backend.core.config import settings
from backend.db.session import engine
from backend.db.models import Base
from fastapi.staticfiles import StaticFiles
import logging
import os

# Initialize logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.PROJECT_NAME)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development, we'll tighten this later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure uploads dir exists
UPLOAD_DIR = "/app/backend/uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# Mount files for access
app.mount("/api/media/files", StaticFiles(directory=UPLOAD_DIR), name="media")

# Startup event: Initialize Database (create tables)
# In production, use Alembic migrations instead!
@app.on_event("startup")
async def startup():
    logger.info("Starting up and creating tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database initialized.")

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Welcome to KroGram API", "status": "online"}

# Routers
from backend.api import auth, users, servers, messages, friends
from backend.websockets.manager import handle_websocket_logic
from fastapi import WebSocket

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(servers.router, prefix="/api/servers", tags=["servers"])
app.include_router(messages.router, prefix="/api/messages", tags=["messages"])
from backend.api import media
app.include_router(media.router, prefix="/api/media", tags=["media"])
app.include_router(friends.router, prefix="/api/friends", tags=["friends"])

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str):
    await handle_websocket_logic(websocket, token)
