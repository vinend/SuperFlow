from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    database_url: str = "postgresql+psycopg://superflow:superflow_demo@127.0.0.1:5432/superflow"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"


settings = Settings()
