import pytest
from fastapi.testclient import TestClient
import sys
import os

# Add parent directory to path to import app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app_state
from main import app
from services.auth_service import create_access_token

client = TestClient(app)

def test_register_user():
    """Test user registration."""
    response = client.post(
        "/api/auth/register",
        json={"username": "testuser_unique", "password": "testpassword"}
    )
    # 200 if new, 400 if already exists. Both are fine for a smoke test.
    assert response.status_code in [200, 400]

def test_login_and_me():
    """Test login issuance of JWT and use of /me endpoint."""
    # 1. Login
    login_response = client.post(
        "/api/auth/login",
        json={"username": "testuser_unique", "password": "testpassword"}
    )
    assert login_response.status_code == 200
    data = login_response.json()
    assert "access_token" in data
    token = data["access_token"]
    
    # 2. Access /me with token
    me_response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert me_response.status_code == 200
    user_data = me_response.json()
    assert user_data["username"] == "testuser_unique"

def test_invalid_token():
    """Test accessing protected route with invalid token."""
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid_token_here"}
    )
    assert response.status_code == 401
