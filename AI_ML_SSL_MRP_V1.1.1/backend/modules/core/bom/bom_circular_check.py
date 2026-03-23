from backend.database.db_helper import run_query


def check_circular_dependency(target_child, current_parent, visited=None):
    """
    Recursively checks if target_child is an ancestor of current_parent.
    If true, adding (current_parent -> target_child) would create a cycle.
    """
    if visited is None:
        visited = set()
    
    if target_child == current_parent:
        return True
        
    if target_child in visited:
        return False
    visited.add(target_child)
    
    sql = "SELECT child_id FROM bom WHERE parent_id = %s"
    df = run_query(sql, (target_child,))
    
    if df.empty:
        return False
        
    children = df['child_id'].tolist()
    
    if current_parent in children:
        return True
        
    for child in children:
        if check_circular_dependency(child, current_parent, visited):
            return True
            
    return False
