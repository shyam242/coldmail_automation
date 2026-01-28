"""Token encryption/decryption utilities using Fernet"""
import os
from cryptography.fernet import Fernet
import logging

logger = logging.getLogger(__name__)

# Get encryption key from environment
FERNET_KEY = os.getenv("FERNET_KEY")

if not FERNET_KEY:
    logger.warning("⚠️ FERNET_KEY not set in environment. Tokens will be stored unencrypted.")
    cipher = None
else:
    try:
        cipher = Fernet(FERNET_KEY.encode() if isinstance(FERNET_KEY, str) else FERNET_KEY)
    except Exception as e:
        logger.error(f"❌ Invalid FERNET_KEY: {str(e)}")
        cipher = None


def encrypt_token(token):
    """Encrypt a sensitive token"""
    if not token or not cipher:
        return token
    
    try:
        encrypted = cipher.encrypt(token.encode()).decode()
        return encrypted
    except Exception as e:
        logger.error(f"❌ Encryption failed: {str(e)}")
        return token


def decrypt_token(encrypted_token):
    """Decrypt a sensitive token"""
    if not encrypted_token or not cipher:
        return encrypted_token
    
    try:
        # Check if it looks like an encrypted token (starts with gAAAAAA...)
        if isinstance(encrypted_token, str) and encrypted_token.startswith("gAAAAA"):
            decrypted = cipher.decrypt(encrypted_token.encode()).decode()
            return decrypted
        # If not encrypted, return as-is
        return encrypted_token
    except Exception as e:
        logger.error(f"❌ Decryption failed: {str(e)}")
        return encrypted_token


def is_encrypted(token):
    """Check if a token is encrypted"""
    if not token:
        return False
    return isinstance(token, str) and token.startswith("gAAAAA")
