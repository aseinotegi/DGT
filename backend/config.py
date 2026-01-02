"""Configuration settings for the DGT V16 Backend."""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database
    database_url: str = "postgresql://v16user:v16secret@db:5432/v16db"
    
    # DGT XML Sources
    dgt_nacional_url: str = "https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v36.xml"
    dgt_paisvasco_url: str = "https://infocar.dgt.es/datex2/dt-gv/SituationPublication/all/content.xml"
    dgt_cataluna_url: str = "https://infocar.dgt.es/datex2/sct/SituationPublication/all/content.xml"
    
    # Sync settings
    sync_interval_seconds: int = 60
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
