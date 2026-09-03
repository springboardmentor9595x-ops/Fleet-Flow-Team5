from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # SMTP Email settings
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM: str = "noreply@fleetflow.com"
    EMAILS_FROM_NAME: str = "FleetFlow Admin"

    # HTTP Email APIs (Work on cloud hosts like Render where SMTP ports are blocked)
    RESEND_API_KEY: str = ""
    RESEND_FROM: str = "FleetFlow <onboarding@resend.dev>"
    BREVO_API_KEY: str = ""

    # Redis (optional)
    REDIS_URL: str = "redis://localhost:6379"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
