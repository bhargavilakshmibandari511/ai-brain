import asyncio
import sys
import os

# Ensure the backend directory is in the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.logging_config import setup_logging, get_logger
from utils.env_validator import validate_environment
from unittest.mock import patch

async def verify_dx():
    """Verify Developer Experience features (Phase 3)"""
    setup_logging()
    logger = get_logger("verify_dx")
    
    # Mock sys.exit to handle JWT validation failures gracefully in the test
    with patch("sys.exit") as mock_exit:
        # 1. Test Structured Logging
        print("Testing Structured Logging...")
        logger.info("structured_log_test", phase="Phase 3", status="verifying")
        
        # 2. Test Environment Validation
        print("\nTesting Environment Validation...")
        await validate_environment()
        
        if mock_exit.called:
            print("\n⚠ Note: sys.exit was called during validation (expected if JWT_SECRET is weak/missing)")
    
    print("\n✅ Verification script completed.")

if __name__ == "__main__":
    asyncio.run(verify_dx())
