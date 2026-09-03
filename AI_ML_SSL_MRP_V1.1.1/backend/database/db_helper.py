import psycopg2
from psycopg2 import pool
import pandas as pd
import atexit

# Import centralized configuration
from backend.config import DB_CONFIG
from backend.logger import get_logger

logger = get_logger(__name__)

# Global Connection Pool
pg_pool = None

def init_db_pool():
    global pg_pool
    if pg_pool is None:
        try:
            pg_pool = psycopg2.pool.ThreadedConnectionPool(
                minconn=1,
                maxconn=20,
                **DB_CONFIG
            )
            logger.info("Database Connection Pool Initialized.")
        except Exception as e:
            logger.error(f"Error initializing DB Pool: {e}")

# Initialize pool on module load
init_db_pool()

# Ensure pool is closed on exit
def close_db_pool():
    global pg_pool
    if pg_pool:
        pg_pool.closeall()
        logger.info("Database Connection Pool Closed.")

atexit.register(close_db_pool)

def get_db_connection():
    global pg_pool
    try:
        if pg_pool is None:
            init_db_pool()
        if pg_pool:
            conn = pg_pool.getconn()
            if conn:
                return conn
    except Exception as e:
        logger.error(f"Connection Pool Error: {e}")
    if not pg_pool:
        logger.error("pg_pool is None after init attempt")
    return None

def release_db_connection(conn):
    """Returns the connection to the pool."""
    global pg_pool
    if pg_pool and conn:
        try:
            pg_pool.putconn(conn)
        except Exception as e:
            logger.warning(f"Error releasing connection: {e}")

import warnings

def run_query(query, params=None):
    """SELECT sorguları için (DataFrame döner)"""
    conn = get_db_connection()
    if conn:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter('ignore', UserWarning)
                df = pd.read_sql_query(query, conn, params=params)
            return df
        except Exception as e:
            logger.error(f"Query Error: {e}")
            raise e  # Re-raise to let caller handle it (e.g., API error response)
        finally:
            release_db_connection(conn)
    # If no connection, maybe raise or return empty with log
    logger.error("No DB connection available for query.")
    raise Exception("Database connection failed")

def run_command(command, params=None):
    """INSERT, UPDATE, DELETE komutları için"""
    conn = get_db_connection()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute(command, params)
            conn.commit()
            cur.close()
            return True
        except Exception as e:
            conn.rollback()
            logger.error(f"Command Error: {e}")
            # Do NOT re-raise e here if we want safe fallback, but usually we prefer to know
            raise e
        finally:
            release_db_connection(conn)
    return False

def run_command_returning(command, params=None):
    """Executes a command (like INSERT ... RETURNING id) and returns the first column of the first row."""
    conn = get_db_connection()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute(command, params)
            result = cur.fetchone()
            conn.commit()
            cur.close()
            return result[0] if result else None
        except Exception as e:
            conn.rollback()
            logger.error(f"Command Returning Error: {e}")
            raise e
        finally:
            release_db_connection(conn)
    return None

def run_command_batch(command, params_list):
    """
    Batch INSERT/UPDATE/DELETE for better performance.
    Uses executemany() instead of individual execute() calls.
    """
    if not params_list:
        return True
        
    conn = get_db_connection()
    if conn:
        try:
            cur = conn.cursor()
            cur.executemany(command, params_list)
            conn.commit()
            cur.close()
            return True
        except Exception as e:
            conn.rollback()
            logger.error(f"Batch Command Error: {e}")
            raise e
        finally:
            release_db_connection(conn)
    return False
