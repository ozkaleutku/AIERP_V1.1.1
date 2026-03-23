import psycopg2
from fastapi import HTTPException
from backend.logger import get_logger

logger = get_logger(__name__)


def handle_db_error(e):
    err_msg = str(e)
    if isinstance(e, psycopg2.errors.ForeignKeyViolation):
        raise HTTPException(status_code=409, detail="İşlem yapılamadı: Kayıt başka bir yerde kullanılıyor. (FK Error)")
    if isinstance(e, psycopg2.errors.UniqueViolation):
        raise HTTPException(status_code=409, detail="Bu kayıt zaten mevcut.")
    if "update or delete on table" in err_msg and "violates foreign key constraint" in err_msg:
        raise HTTPException(status_code=409, detail="Bu kayıt silinemez çünkü başka verilerle ilişkili (Sipariş veya Reçete).")
    logger.error(f"DB Error: {e}")
    raise HTTPException(status_code=500, detail=err_msg)
