from fastapi import APIRouter
from backend.modules.core.price_analytics.price_history_builder import get_item_price_history
from backend.shared.utils.error_handler import handle_db_error

router = APIRouter()


@router.get("/api/products/{item_id}/price-history")
def price_history(item_id: str):
    try:
        data = get_item_price_history(item_id)
        return {"data": data}
    except Exception as e:
        handle_db_error(e)


@router.get("/api/products/{item_id}/details")
def product_details(item_id: str):
    """Ürün detaylarını (fiyat history, stok durumu vb) getirebilecek geniş bir endpoint"""
    try:
         # İhtiyaca göre stok vb eklenebilir
         history = get_item_price_history(item_id)
         return {"price_history": history}
    except Exception as e:
        handle_db_error(e)
