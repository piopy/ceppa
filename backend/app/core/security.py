from datetime import datetime, timedelta
from typing import Optional, Any, Union
from jose import jwt
from passlib.context import CryptContext
from cryptography.fernet import Fernet
import base64
import hashlib
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"

# Derive a Fernet key from the OPENAI_API_KEY (used as app secret)
_fernet_key = base64.urlsafe_b64encode(
    hashlib.sha256(settings.OPENAI_API_KEY.encode()).digest()
)
_fernet = Fernet(_fernet_key)


def create_access_token(
    subject: Union[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=30)  # Default

    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(
        to_encode, settings.OPENAI_API_KEY[:32], algorithm=ALGORITHM
    )  # Using API Key prefix as secret for simple dev, ideally use a separate SECRET_KEY
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def encrypt_value(value: str) -> str:
    """Encrypt a string value (e.g., API key) for storage in DB."""
    if not value:
        return value
    return _fernet.encrypt(value.encode()).decode()


def decrypt_value(encrypted: str) -> str:
    """Decrypt a stored encrypted value back to plaintext."""
    if not encrypted:
        return encrypted
    try:
        return _fernet.decrypt(encrypted.encode()).decode()
    except Exception:
        # If decryption fails (e.g., value was stored unencrypted before migration),
        # return the raw value as-is
        return encrypted
