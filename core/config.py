from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SECRET_KEY: str = "change-this-secret-key-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    DATABASE_URL: str = ""
    USE_SQLITE: bool = True

    GROQ_API_KEY: str = ""
    ADMIN_PASSWORD: str = "admin@123"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
