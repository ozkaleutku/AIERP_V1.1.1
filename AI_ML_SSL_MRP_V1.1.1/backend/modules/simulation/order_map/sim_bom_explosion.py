from backend.database.db_helper import run_query
from backend.logger import get_logger

logger = get_logger(__name__)


def explode_bom(parent_id, amount_needed, due_date):
    """
    Üretim yapılması gereken bir mamül/yarı mamülün alt bileşenlerini bulup,
    onların demand_processor üzerinden stoktan düşülmesini/üretilmesini/satın alınmasını tetikler.
    """
    # Circular dependency import error'ı önlemek için runtime'da import ediyoruz
    from backend.modules.simulation.order_map.demand_processor import process_demand
    
    query = """
    SELECT child_id, amount as bom_multiplier 
    FROM bom 
    WHERE parent_id = %s AND activity_status = 'Aktif'
    """
    df_bom = run_query(query, (parent_id,))
    
    if df_bom.empty:
        logger.warning(f"{parent_id} üretim için reçeteye (BOM) sahip değil! Stok eksiye düşebilir.")
        return
        
    for _, row in df_bom.iterrows():
        child_id = row['child_id']
        required_qty = amount_needed * float(row['bom_multiplier'])
        
        # Recurse down
        process_demand(child_id, required_qty, due_date)
