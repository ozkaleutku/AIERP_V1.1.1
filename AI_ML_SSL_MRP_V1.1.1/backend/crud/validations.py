from backend.database.db_helper import run_query
import pandas as pd

def validate_item_for_order(item_id):
    """
    Checks if an item can be ordered.
    Validations:
    1. Item itself is not Pasif.
    2. No components in its BOM tree are Pasif or have Pasif BOM mappings.
    3. All bottom-level components (no BOM children) must have an active supplier defined.
       (If an item has no BOM children, it is assumed to be purchased).
       
    Returns: (is_valid: bool, error_msg: str)
    """
    # 1. Check item status
    df_item = run_query("SELECT activity_status, item_type FROM item WHERE item_id = %s", (item_id,))
    if df_item.empty:
        return False, f"Ürün '{item_id}' bulunamadı."
        
    if df_item.iloc[0]['activity_status'] == 'Pasif':
        return False, f"'{item_id}' ürünü Pasif durumdadır."

    visited = set()
    queue = [item_id]
    passive_components = set()
    missing_suppliers = set()
    
    # Cache to avoid duplicate queries
    supplier_check_cache = {}
    
    while queue:
        curr = queue.pop(0)
        if curr in visited:
            continue
        visited.add(curr)
        
        # Determine if it has BOM children
        df_bom = run_query("SELECT child_id, activity_status, deactivated_by_item_ids FROM bom WHERE parent_id = %s", (curr,))
        if not df_bom.empty:
            # It is a produced item
            for _, r in df_bom.iterrows():
                child = r['child_id']
                
                if r['activity_status'] == 'Pasif':
                    # If this BOM connection was made passive explicitly because of a missing/passive item,
                    # it means it is still needed for the recipe but is unavailable. Thus, block the parent order.
                    if pd.notna(r['deactivated_by_item_ids']) and str(r['deactivated_by_item_ids']).strip():
                        passive_components.add(child)
                    # For entirely manual passive states, we assume the component was removed from the recipe intentionally.
                    continue

                # Verify child item's own status
                df_child = run_query("SELECT activity_status FROM item WHERE item_id = %s", (child,))
                if not df_child.empty and df_child.iloc[0]['activity_status'] == 'Pasif':
                    passive_components.add(child)
                    
                queue.append(child)
        else:
            # It is a purchased item (no BOM children). 
            # Check its item_type first.
            df_curr_type = run_query("SELECT item_type FROM item WHERE item_id = %s", (curr,))
            if not df_curr_type.empty and df_curr_type.iloc[0]['item_type'] != 'mamül':
                # We must verify it has at least one active supplier in supplier_item.
                if curr not in supplier_check_cache:
                    df_sup = run_query("SELECT * FROM supplier_item WHERE item_id = %s AND activity_status = 'Aktif'", (curr,))
                    has_supplier = not df_sup.empty
                    supplier_check_cache[curr] = has_supplier
                    if not has_supplier:
                        missing_suppliers.add(curr)
                    
    # Format error messages if any issues found
    if passive_components:
        comps = ", ".join(sorted(list(passive_components)))
        return False, f"Sipariş girilemez. Şu ürünler veya reçete bağlantıları pasif: {comps}"
        
    if missing_suppliers:
        comps = ", ".join(sorted(list(missing_suppliers)))
        return False, f"Sipariş girilemez. Şu hammadde/bileşenler için Aktif tedarikçi tanımlanmamış: {comps}"
        
    return True, ""
