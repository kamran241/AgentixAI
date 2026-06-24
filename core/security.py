from datetime import datetime, timedelta, timezone
from typing import Optional
import base64
import hashlib

import bcrypt
from jose import JWTError, jwt
from cryptography.fernet import Fernet

from core.config import settings


def _get_fernet() -> Fernet:
    key = settings.DB_ENCRYPTION_KEY
    if key:
        # Use provided key directly if it's valid base64url 32-byte Fernet key
        try:
            return Fernet(key.encode() if isinstance(key, str) else key)
        except Exception:
            pass
    # Derive a stable Fernet key from SECRET_KEY so no extra env var is mandatory
    raw = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(raw))


def encrypt_db_url(url: str) -> str:
    """Encrypt a database connection string for storage."""
    return _get_fernet().encrypt(url.encode()).decode()


def decrypt_db_url(token: str) -> str:
    """Decrypt a stored database connection string."""
    return _get_fernet().decrypt(token.encode()).decode()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(subject: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(subject), "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[int]:
    """Returns user_id (int) or raises JWTError."""
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    sub = payload.get("sub")
    if sub is None:
        raise JWTError("Missing subject")
    return int(sub)
