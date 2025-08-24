import logging
import sys
from datetime import datetime
import os

def setup_logger():
    """Setup logging configuration for the AI service"""
    
    # Create logs directory if it doesn't exist
    os.makedirs('logs', exist_ok=True)
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('logs/ai_service.log'),
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    logger = logging.getLogger('auramed_ai_service')
    return logger
