import logging
import sys

from backend.config import LOG_LEVEL

# Configure logging format
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

def get_logger(name):
    """
    Creates and returns a standardized logger instance.
    """
    return logging.getLogger(name)
