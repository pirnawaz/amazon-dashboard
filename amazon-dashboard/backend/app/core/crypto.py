"""Encryption-at-rest for sensitive tokens (e.g. LWA refresh token) using Fernet."""
from __future__ import annotations

from app.core.config import settings
from cryptography.fernet import Fernet, InvalidToken
from cryptography.exceptions import InvalidKey


class TokenEncryptionError(Exception):
    """Raised when encryption/decryption fails due to missing or invalid key or invalid ciphertext."""


def _get_fernet() -> Fernet:
    key = settings.token_encryption_key
    if not key or not key.strip():
        raise TokenEncryptionError(
            "TOKEN_ENCRYPTION_KEY is not set. Set it to a base64 urlsafe Fernet key "
            "(e.g. generate with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\")."
        )
    key_bytes = key.strip().encode("ascii")
    try:
        return Fernet(key_bytes)
    except (InvalidKey, Exception) as e:
        raise TokenEncryptionError(
            f"TOKEN_ENCRYPTION_KEY is invalid: {e!s}. "
            "It must be a base64 urlsafe-encoded 32-byte key (generate with Fernet.generate_key())."
        ) from e


def encrypt_token(plaintext: str) -> str:
    """Encrypt a plaintext token for storage. Raises TokenEncryptionError if key is missing or invalid."""
    if not plaintext:
        raise TokenEncryptionError("encrypt_token requires a non-empty plaintext string.")
    fernet = _get_fernet()
    ciphertext_bytes = fernet.encrypt(plaintext.encode("utf-8"))
    return ciphertext_bytes.decode("ascii")


def decrypt_token(ciphertext: str) -> str:
    """Decrypt a stored ciphertext token. Raises TokenEncryptionError if key is missing/invalid or ciphertext is invalid."""
    if not ciphertext or not ciphertext.strip():
        raise TokenEncryptionError("decrypt_token requires a non-empty ciphertext string.")
    fernet = _get_fernet()
    try:
        plaintext_bytes = fernet.decrypt(ciphertext.strip().encode("ascii"))
        return plaintext_bytes.decode("utf-8")
    except InvalidToken as e:
        raise TokenEncryptionError(
            f"Failed to decrypt token: ciphertext is invalid or was encrypted with a different key. {e!s}"
        ) from e
