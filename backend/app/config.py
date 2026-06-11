from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str
    ANTHROPIC_API_KEY: str
    GEMINI_API_KEY: str = ""
    CHANNEL_SERVICE_URL: str = "http://localhost:8001"

    model_config = SettingsConfigDict(
        # Try loading from .env in the parent or current directory
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
