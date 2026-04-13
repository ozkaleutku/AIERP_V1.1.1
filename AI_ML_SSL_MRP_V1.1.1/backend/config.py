"""
Central Configuration File for Backend
All database and environment configurations should be imported from here.
"""
import os
from dotenv import load_dotenv

# Load environment variables from .env file if it exists (absolute path for robust execution)
dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(dotenv_path)

# Database Configuration
# Use environment variables for production, with sensible defaults for development
DB_CONFIG = {
    "dbname": os.getenv("DB_NAME", "AI_ML_SS_MRP"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", ""),
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "5432")
}

# API Configuration
API_PORT = int(os.getenv("API_PORT", "8000"))
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_RELOAD = os.getenv("API_RELOAD", "True").lower() == "true"

# Logging Configuration
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# Security Configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
