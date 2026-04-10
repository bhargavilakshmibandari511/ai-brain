from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, Dict
import time
from datetime import timedelta

import app_state
from services.auth_service import create_access_token, get_current_user

router = APIRouter()

# Simple in-memory rate limiting for login
login_attempts: Dict[str, list] = {}
RATE_LIMIT_WINDOW = 60  # seconds
MAX_ATTEMPTS = 5

class UserAuth(BaseModel):
    username: str
    password: str

@router.post("/register")
async def register(auth: UserAuth):
    user_id = app_state.user_service.create_user(auth.username, auth.password)
    if not user_id:
        raise HTTPException(status_code=400, detail="Username already exists")
    return {"message": "User registered successfully", "user_id": user_id}

@router.post("/login")
async def login(auth: UserAuth, request: Request):
    # Basic rate limiting
    client_ip = request.client.host
    now = time.time()
    
    # Clean old attempts
    if client_ip in login_attempts:
        login_attempts[client_ip] = [t for t in login_attempts[client_ip] if now - t < RATE_LIMIT_WINDOW]
    else:
        login_attempts[client_ip] = []
        
    if len(login_attempts[client_ip]) >= MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many login attempts. Please try again later.")
    
    user = app_state.user_service.authenticate_user(auth.username, auth.password)
    if not user:
        login_attempts[client_ip].append(now)
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Create JWT token
    access_token = create_access_token(
        data={"sub": str(user["id"]), "username": user["username"]}
    )
    
    return {
        "message": "Login successful", 
        "access_token": access_token, 
        "token_type": "bearer",
        "user": user
    }

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return the current authenticated user's profile."""
    # Fetch full user details from DB
    user = app_state.user_service.get_user(current_user["user_id"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
