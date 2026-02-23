"""
Central Configuration File for Backend
All database and environment configurations should be imported from here.
"""
import os
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

# Database Configuration
# Use environment variables for production, with sensible defaults for development
DB_CONFIG = {
    "dbname": os.getenv("DB_NAME", "AI_ML_SS_MRP"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", ""),
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "5432")
}
