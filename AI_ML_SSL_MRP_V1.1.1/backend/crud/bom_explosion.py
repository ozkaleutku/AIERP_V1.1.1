import sys
import os

# Add backend root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import pandas as pd
from backend.database.db_helper import run_query, run_command, run_command_batch
from backend.logger import get_logger

logger = get_logger(__name__)

def run_bom_explosion():
    logger.info("BOM Tablosu Parcalaniyor ve Full Safety Stock Hesaplaniyor...")

    # 1. Hedef Tabloyu Temizle
    run_command("TRUNCATE TABLE calculated_full_ss_ai_temp")
    
    # ---------------------------------------------------------
    # LEVEL 0: Mamuller (Direkt AI Tahminleri)
    # ---------------------------------------------------------
    logger.info("   -> Level 0 (Mamuller) isleniyor...")
    
    # Sadece Aktif ürünleri al, Type ve Quantity Type bilgilerini item tablosundan çek
    query_l0 = """
    INSERT INTO calculated_full_ss_ai_temp (item_id, date, amount, status, item_type, item_quantity_type)
    SELECT s.item_id, s.date, s.amount, 'Level 0', i.item_type, i.item_quantity_type
    FROM ss_ai_temporary s
    JOIN item i ON s.item_id = i.item_id
    WHERE i.activity_status = 'Aktif'
    """
    run_command(query_l0)
    
    # Döngü için başlangıç seviyesi
    current_level = 0
    
    # Sınırsız döngü: Parçalanacak child kalmadığında otomatik durur
    while True:
        next_level = current_level + 1
        logger.info(f"   -> Level {next_level} hesaplaniyor...")

        # Mevcut seviyedeki ürünleri ve miktarlarını çek
        query_fetch_current = f"""
        SELECT item_id, date, amount 
        FROM calculated_full_ss_ai_temp 
        WHERE status = 'Level {current_level}'
        """
        df_current = run_query(query_fetch_current)
        
        if df_current.empty:
            logger.info(f"      Level {current_level} bos veya tamamlandi. Parcalama tamamlandi.")
            break
            
        # BOM bilgisini çek
        parents = tuple(df_current['item_id'].unique())
        if not parents:
             break
             
        if len(parents) == 1:
            parents_str = f"('{parents[0]}')"
        else:
            parents_str = str(tuple(parents))

        # Sadece AKTİF reçete bileşenlerini çek
        query_bom = f"""
        SELECT parent_id, child_id, amount as bom_multiplier 
        FROM bom 
        WHERE parent_id IN {parents_str} AND activity_status = 'Aktif'
        """
        df_bom = run_query(query_bom)
        
        if df_bom.empty:
            logger.warning(f"      Level {next_level} icin alt parca (child) bulunamadi.")
            break
            
        # ---------------------------------------------------------
        # PARÇALAMA (EXPLOSION)
        # ---------------------------------------------------------
        # 1. Join: Parent Miktarı * BOM Adedi
        df_merged = df_current.merge(df_bom, left_on='item_id', right_on='parent_id', how='inner')
        
        # 2. Hesapla: Child İhtiyacı = Parent Tahmini * Kullanım Adedi
        df_merged['child_amount'] = df_merged['amount'] * df_merged['bom_multiplier']
        
        # 3. Aggregation (Toplama): Aynı child_id'ye sahip olanları topla
        df_next_level = df_merged.groupby(['child_id', 'date'])['child_amount'].sum().reset_index()
        
        # 4. Veritabanına Yaz
        if not df_next_level.empty:
            # Child itemların özelliklerini (Type, Qty Type) çek
            child_ids = tuple(df_next_level['child_id'].unique())
            if len(child_ids) == 1:
                child_ids_str = f"('{child_ids[0]}')"
            else:
                child_ids_str = str(tuple(child_ids))
                
            query_items = f"SELECT item_id, item_type, item_quantity_type FROM item WHERE item_id IN {child_ids_str}"
            df_items = run_query(query_items)
            
            # Özellikleri hesaplanan miktarlarla birleştir
            df_final = df_next_level.merge(df_items, left_on='child_id', right_on='item_id', how='left')
            
            # Batch Insert
            insert_query = """
            INSERT INTO calculated_full_ss_ai_temp (item_id, date, amount, status, item_type, item_quantity_type)
            VALUES (%s, %s, %s, %s, %s, %s)
            """
            
            status_str = f"Level {next_level}"
            
            # Tuple listesi hazırla
            rows_to_insert = [
                (
                    row['child_id'], 
                    row['date'], 
                    round(row['child_amount'], 2), 
                    status_str,
                    row['item_type'],
                    row['item_quantity_type']
                ) 
                for _, row in df_final.iterrows()
            ]
            
            # Batch insert for performance
            run_command_batch(insert_query, rows_to_insert)
            
            logger.info(f"      Level {next_level} tamamlandi. {len(df_final)} satir eklendi.")
            current_level += 1
        else:
            logger.info(f"       Hesaplanacak veri olusmadi.")
            break

    logger.info("TUM BOM PARCALAMA ISLEMI TAMAMLANDI!")

if __name__ == "__main__":
    run_bom_explosion()
