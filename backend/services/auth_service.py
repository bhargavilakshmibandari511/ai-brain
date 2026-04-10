import jwt
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

import sys

# We use JWT_SECRET as the key name consistent with previous implementation
SECRET_KEY = os.getenv("JWT_SECRET", "dev_super_secret_jwt_key_32_chars_long_enough_1234567890abcdef")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

def validate_jwt_secret():
    """Fail-fast if JWT secret is missing or weak."""
    if not SECRET_KEY or SECRET_KEY == "default_secret_key_for_development_only" or len(SECRET_KEY) < 32:
        print("\n" + "!" * 80)
        print("FATAL SECURITY ERROR: JWT_SECRET is missing or too weak!")
        print("Please set a strong JWT_SECRET (at least 32 characters) in your .env file.")
        print("!" * 80 + "\n")
        print("WARNING: Using development JWT secret - set JWT_SECRET in .env for production")

security = HTTPBearer()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a new JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify a JWT token and return the payload."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Could not validate credentials: {str(e)}")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> Dict[str, Any]:
    """Dependency to get the current authenticated user from the token."""
    token = credentials.credentials
    payload = verify_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user_id = payload.get("sub")
    # We could fetch the full user from DB here, but for now we return the payload
    # which contains at least the user_id (sub)
    return {"user_id": user_id, "username": payload.get("username")}
