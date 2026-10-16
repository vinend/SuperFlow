from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    database_url: str = "postgresql+psycopg://superflow:superflow_demo@127.0.0.1:5432/superflow"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    llm_provider: Literal["deterministic", "ollama"] = "deterministic"
    retrieval_provider: Literal["keyword", "hybrid"] = "keyword"
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_cache_dir: str = str(ROOT / ".runtime/models")
    embedding_threads: int = Field(default=2, ge=1, le=8)
    semantic_min_score: float = Field(default=0.65, ge=0, le=1)
    ocr_enabled: bool = True
    web_capture_enabled: bool = True
    web_node_executable: str = "node"
    web_browser_executable: str | None = None
    vision_model: str = "qwen3.5:0.8b"
    vision_timeout_seconds: float = Field(default=600, ge=10, le=600)
    vision_threads: int = Field(default=4, ge=1, le=8)
    ocr_max_pages: int = Field(default=30, ge=1, le=200)
    pdf_max_pages: int = Field(default=200, ge=1, le=1000)
    ocr_max_pixels: int = Field(default=20_000_000, ge=1_000_000, le=50_000_000)
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "qwen3.5:9b"
    ollama_num_ctx: int = Field(default=8192, ge=2048, le=131072)
    ollama_num_predict: int = Field(default=512, ge=64, le=2048)
    ollama_temperature: float = Field(default=0.1, ge=0, le=1)
    ollama_timeout_seconds: float = Field(default=120, ge=5, le=600)


settings = Settings()
