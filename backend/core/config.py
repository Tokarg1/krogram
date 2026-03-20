from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "KroGram API"
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@db:5432/krogram"
    REDIS_URL: str = "redis://redis:6379/0"
    SECRET_KEY: str = "32char-secret-key-that-should-be-random"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 days for prototype

    class Config:
        env_file = ".env"

settings = Settings()
