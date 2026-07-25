"""
Centralized application configuration.

All environment-dependent values are read here, once, so the rest of the
codebase never calls os.getenv() directly. This keeps configuration
auditable and makes it trivial to swap in a real settings library
(e.g. pydantic-settings) later without touching call sites.
"""

import os

from dotenv import load_dotenv

# Load variables from a local .env file (no-op in environments where the
# variables are already injected, e.g. Docker/CI).
load_dotenv()


class Settings:
    """Typed accessors for environment configuration.

    Note: JWT-related settings (SECRET_KEY, ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES) are read here in preparation for Step 7
    (authentication) but are not consumed anywhere yet in this milestone.
    """

    PROJECT_NAME: str = "FleetFlow API"

    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
    )

    # Comma-separated list of allowed CORS origins, e.g.
    # "http://localhost:5173,http://localhost:3000"
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    ]


settings = Settings()
