from backend.database.db_helper import run_query, run_command


def cascade_bom_status_change(item_id, is_active):
    """
    Cascades activity status changes to the BOM tree.
    If an item becomes passive, its child BOM rows, parent BOM rows, and their cascading BOM rows become passive.
    """
    visited_items = set()
    queue = [item_id]
    affected_rows = set()
    
    while queue:
        curr = queue.pop(0)
        if curr in visited_items:
            continue
        visited_items.add(curr)
        
        df1 = run_query("SELECT parent_id, child_id FROM bom WHERE parent_id = %s", (curr,))
        if not df1.empty:
            for _, r in df1.iterrows():
                affected_rows.add((r['parent_id'], r['child_id']))
                
        df2 = run_query("SELECT parent_id, child_id FROM bom WHERE child_id = %s", (curr,))
        if not df2.empty:
            for _, r in df2.iterrows():
                affected_rows.add((r['parent_id'], r['child_id']))
                queue.append(r['parent_id'])
                
    if not affected_rows:
        return
        
    for p, c in affected_rows:
        df_bom = run_query("SELECT deactivated_by_item_ids FROM bom WHERE parent_id = %s AND child_id = %s", (p, c))
        if df_bom.empty:
            continue
            
        current_ids_str = df_bom.iloc[0]['deactivated_by_item_ids']
        current_ids = [x.strip() for x in current_ids_str.split(',')] if current_ids_str else []
        
        if not is_active:
            if item_id not in current_ids:
                current_ids.append(item_id)
                new_ids_str = ",".join(current_ids)
                run_command("UPDATE bom SET activity_status = 'Pasif', deactivated_by_item_ids = %s WHERE parent_id = %s AND child_id = %s", 
                            (new_ids_str, p, c))
        else:
            if item_id in current_ids:
                current_ids.remove(item_id)
                new_ids_str = ",".join(current_ids) if current_ids else None
                new_status = 'Aktif' if not new_ids_str else 'Pasif'
                run_command("UPDATE bom SET activity_status = %s, deactivated_by_item_ids = %s WHERE parent_id = %s AND child_id = %s",
                            (new_status, new_ids_str, p, c))
