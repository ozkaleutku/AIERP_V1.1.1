from backend.database.db_helper import run_query, run_command
from backend.logger import get_logger
from collections import deque, defaultdict

logger = get_logger(__name__)

def recalculate_all_costs():
    """
    Bottom-up calculation of unit_cost for all items based on BOM and additional_cost.
    Formula: unit_cost = SUM(child.unit_cost * bom.amount) + parent.additional_cost
    """
    logger.info("Starting recursive unit cost recalculation...")
    
    try:
        # 1. Fetch all items (id, type, current cost, additional cost)
        items_df = run_query("SELECT item_id, item_type, unit_cost, additional_cost FROM item")
        if items_df.empty:
            logger.warning("No items found for cost recalculation.")
            return
            
        # Create a lookup for item data
        # item_data[item_id] = {type, unit_cost, additional_cost, calculated_cost}
        item_data = {}
        for _, row in items_df.iterrows():
            item_id = row['item_id']
            item_data[item_id] = {
                'type': row['item_type'],
                'base_unit_cost': float(row['unit_cost'] or 0),
                'additional_cost': float(row['additional_cost'] or 0),
                'calculated_cost': 0.0,
                'is_calculated': False
            }
            
        # 2. Fetch all active BOM components
        bom_df = run_query("SELECT parent_id, child_id, amount FROM bom WHERE activity_status = 'Aktif'")
        
        # Build graphs
        # parents_of[child] = list of parents
        # children_of[parent] = list of (child, amount)
        adj = defaultdict(list) # children of parent
        in_degree = defaultdict(int)
        all_item_ids = set(item_data.keys())
        
        for _, row in bom_df.iterrows():
            p, c, amt = row['parent_id'], row['child_id'], float(row['amount'])
            if p in item_data and c in item_data:
                adj[p].append((c, amt))
                # Note: For BOTTOM-UP calculation, we need to know when all children are ready.
                # So we actually want a dependency graph where Parent depends on Children.
                # Degree should represent number of children to be processed.
            
        # Let's use a standard topological sort approach:
        # 1. Hammaddeler (and items with no children) are the starting point.
        # 2. Process parents once all their children are processed.
        
        # child_to_parents[child] = list of parents that use this child
        child_to_parents = defaultdict(list)
        # parent_child_count[parent] = number of children this parent has
        parent_child_count = defaultdict(int)
        
        for p, children in adj.items():
            parent_child_count[p] = len(children)
            for c, _ in children:
                child_to_parents[c].append(p)
                
        # Queue for items with 0 pending children (starting with leaves / hammaddeler)
        queue = deque([iid for iid in all_item_ids if parent_child_count[iid] == 0])
        
        processed_count = 0
        while queue:
            curr_id = queue.popleft()
            curr_item = item_data[curr_id]
            
            # Calculate cost for curr_id
            # If it's a hammadde OR it has no children in the BOM, use its base unit_cost
            if curr_item['type'] == 'hammadde' or not adj[curr_id]:
                # For hammadde / orphan items, use base_unit_cost (manually entered) + additional_cost
                curr_item['calculated_cost'] = curr_item['base_unit_cost'] + curr_item['additional_cost']
            else:
                # For semi-finished/finished, it's SUM(child_cost * amount) + additional_cost
                total_material_cost = 0.0
                for child_id, amount in adj[curr_id]:
                    total_material_cost += item_data[child_id]['calculated_cost'] * amount
                
                curr_item['calculated_cost'] = total_material_cost + curr_item['additional_cost']
            
            curr_item['is_calculated'] = True
            processed_count += 1
            
            # Notify parents that this child is ready
            for parent_id in child_to_parents[curr_id]:
                parent_child_count[parent_id] -= 1
                if parent_child_count[parent_id] == 0:
                    queue.append(parent_id)
        
        logger.info(f"Calculated costs for {processed_count} / {len(all_item_ids)} items.")
        
        # 3. Batch Update Table
        # We only update unit_cost for mamül and yarı_mamül
        # Hammadde unit_cost is entered by user (though we might want to update it if additional_cost was added? 
        # User said "birim maliyet de şöyle hesaplanır... hammadde birim maliyetlerine göre...").
        # If I overwrite hammadde unit_cost with (unit_cost + additional_cost), it might double count if user edits it again.
        # Better: item.unit_cost always stores the FINAL calculated/entered cost.
        
        update_query = "UPDATE item SET unit_cost = %s WHERE item_id = %s"
        update_data = []
        for iid, data in item_data.items():
            if data['is_calculated']:
                # For hammadde, we don't necessarily need to update if it hasn't changed, 
                # but for simplicity and correctness (including additional_cost), we'll update all.
                # Round to 2 decimals for DB
                final_cost = round(data['calculated_cost'], 2)
                # Only update if it's different from current to avoid unnecessary price history entries
                if abs(final_cost - data['base_unit_cost']) > 0.001:
                    update_data.append((final_cost, iid))
        
        if update_data:
            from backend.database.db_helper import run_command_batch
            run_command_batch(update_query, update_data)
            logger.info(f"Updated {len(update_data)} item costs in database.")
        else:
            logger.info("No cost changes detected.")
            
    except Exception as e:
        logger.error(f"Error in recalculate_all_costs: {e}")
        raise e
