import psycopg2
from psycopg2 import sql
import sys
import os

# Correct sys.path to find 'backend' module
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if root_dir not in sys.path:
    sys.path.append(root_dir)

from backend.config import DB_CONFIG
from backend.logger import get_logger

logger = get_logger(__name__)

def create_tables():
    """
    Tablo yapılarını oluşturur.
    """
    commands = [
        # 0. Enum Types
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_type_enum') THEN
                CREATE TYPE item_type_enum AS ENUM ('mamül', 'yarı_mamül', 'hammadde');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quantity_type_enum') THEN
                CREATE TYPE quantity_type_enum AS ENUM ('gram', 'adet', 'litre');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movement_purpose_enum') THEN
                -- Hareket nedenleri (Backend kodlarıyla uyumlu)
                CREATE TYPE movement_purpose_enum AS ENUM (
                    'satın_alma_girişi', 
                    'üretim_çıkışı', 
                    'üretim_girişi', 
                    'satış_çıkışı', 
                    'kalite_transferi',
                    'üretime_giden', -- Eski uyumluluk için
                    'giriş', 
                    'çıkış', 
                    'iade'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_purpose_enum') THEN
                CREATE TYPE purchase_purpose_enum AS ENUM ('emniyet_stoku_için', 'acil_sipariş', 'normal_sipariş');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_status_enum') THEN
                CREATE TYPE activity_status_enum AS ENUM ('Aktif', 'Pasif');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_order_status_enum') THEN
                CREATE TYPE customer_order_status_enum AS ENUM ('Bekleniyor', 'Üretimde', 'Hazır', 'Sevk Edildi');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'production_time_unit_enum') THEN
                CREATE TYPE production_time_unit_enum AS ENUM ('saat', 'gün');
            END IF;
        END$$;
        """,

        # 1. item (Diğer tabloların bağımlı olduğu ana tablo)
        """
        CREATE TABLE IF NOT EXISTS item (
            item_id VARCHAR(20) PRIMARY KEY,
            item_type item_type_enum,
            item_quantity_type quantity_type_enum,
            activity_status activity_status_enum,
            demand_avg DECIMAL(10, 2),
            demand_deviation DECIMAL(10, 2),
            unit_cost DECIMAL(12, 2) DEFAULT 0,
            unit_price DECIMAL(12, 2) DEFAULT 0,
            additional_cost DECIMAL(12, 2) DEFAULT 0,
            currency VARCHAR(5) DEFAULT 'TRY',
            production_time_value DECIMAL(10, 2) DEFAULT 0,
            production_time_unit VARCHAR(10) DEFAULT 'saat'
        )
        """,
        # 1b. Update existing item table if columns missing (ERP Expansion)
        "ALTER TABLE item ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(12, 2) DEFAULT 0",
        "ALTER TABLE item ADD COLUMN IF NOT EXISTS unit_price DECIMAL(12, 2) DEFAULT 0",
        "ALTER TABLE item ADD COLUMN IF NOT EXISTS additional_cost DECIMAL(12, 2) DEFAULT 0",
        "ALTER TABLE item ADD COLUMN IF NOT EXISTS currency VARCHAR(5) DEFAULT 'TRY'",
        "ALTER TABLE item ADD COLUMN IF NOT EXISTS production_time_value DECIMAL(10, 2) DEFAULT 0",
        "ALTER TABLE item ADD COLUMN IF NOT EXISTS production_time_unit VARCHAR(10) DEFAULT 'saat'",
        
        # 1c. item_price_history (Snapshots of item costs/prices)
        """
        CREATE TABLE IF NOT EXISTS item_price_history (
            id SERIAL PRIMARY KEY,
            item_id VARCHAR(20) REFERENCES item(item_id),
            unit_cost DECIMAL(12, 2),
            unit_price DECIMAL(12, 2),
            date DATE DEFAULT CURRENT_DATE,
            UNIQUE (item_id, date)
        )
        """,
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'item_price_history_item_id_date_key') THEN
                ALTER TABLE item_price_history ADD CONSTRAINT item_price_history_item_id_date_key UNIQUE (item_id, date);
            END IF;
        END$$;
        """,
        
        
        # 2. supplier_item (item tablosuna bağımlı)
        """
        CREATE TABLE IF NOT EXISTS supplier_item (
            item_id VARCHAR(20) REFERENCES item(item_id),
            supplier_id VARCHAR(20),
            calculated_leadtime_avg DECIMAL(10, 2),
            calculated_leadtime_deviation DECIMAL(10, 2),
            given_leadtime DECIMAL(10, 2),
            given_leadtime_deviation DECIMAL(10, 2),
            lot_size DECIMAL(10, 2) DEFAULT 0,
            min_size DECIMAL(10, 2) DEFAULT 0,
            max_size DECIMAL(10, 2) DEFAULT 0,
            calculated BOOLEAN,
            activity_status activity_status_enum,
            PRIMARY KEY (item_id, supplier_id)
        )
        """,
        
        # 2.5. warehouse_location
        """
        CREATE TABLE IF NOT EXISTS warehouse_location (
            location_id VARCHAR(50) PRIMARY KEY,
            location_name VARCHAR(100),
            is_active BOOLEAN DEFAULT TRUE
        )
        """,
        # Seed default locations
        """
        INSERT INTO warehouse_location (location_id, location_name)
        VALUES 
            ('GİRİŞ_KALİTE', 'Giriş Kalite Kontrol'),
            ('ANA_DEPO', 'Ana Depo'),
            ('ÜRETİM', 'Üretim Sahası'),
            ('ÇIKIŞ_KALİTE', 'Çıkış Kalite Kontrol'),
            ('SEVKİYAT_DEPO', 'Sevkiyat Alanı')
        ON CONFLICT (location_id) DO NOTHING;
        """,

        # 3. stock_movement
        """
        CREATE TABLE IF NOT EXISTS stock_movement (
            id SERIAL PRIMARY KEY,
            item_id VARCHAR(20) REFERENCES item(item_id),
            amount DECIMAL(12, 2),
            purpose movement_purpose_enum,
            date DATE,
            source_location_id VARCHAR(50) REFERENCES warehouse_location(location_id),
            target_location_id VARCHAR(50) REFERENCES warehouse_location(location_id),
            tracking_code VARCHAR(100),
            parent_id INTEGER REFERENCES stock_movement(id),
            is_completed BOOLEAN DEFAULT FALSE,
            order_id INTEGER
        )
        """,
        # Expansion for existing tables
        "ALTER TABLE stock_movement ADD COLUMN IF NOT EXISTS source_location_id VARCHAR(50) REFERENCES warehouse_location(location_id)",
        "ALTER TABLE stock_movement ADD COLUMN IF NOT EXISTS target_location_id VARCHAR(50) REFERENCES warehouse_location(location_id)",
        "ALTER TABLE stock_movement ADD COLUMN IF NOT EXISTS tracking_code VARCHAR(100)",
        "ALTER TABLE stock_movement ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES stock_movement(id)",
        "ALTER TABLE stock_movement ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE",
        "ALTER TABLE stock_movement ADD COLUMN IF NOT EXISTS order_id INTEGER",
        
        # 4. start_inventories
        """
        CREATE TABLE IF NOT EXISTS start_inventories (
            item_id VARCHAR(20) REFERENCES item(item_id),
            date DATE,
            amount DECIMAL(12, 2),
            PRIMARY KEY (item_id, date)
        )
        """,
        
        # 5. sales_out_history
        """
        CREATE TABLE IF NOT EXISTS sales_out_history (
            id SERIAL PRIMARY KEY,
            item_id VARCHAR(20) REFERENCES item(item_id),
            amount DECIMAL(12, 2),
            unit_price DECIMAL(12, 2) DEFAULT 0,
            date DATE,
            customer_name VARCHAR(100),
            order_id INTEGER
        )
        """,
        "ALTER TABLE sales_out_history ADD COLUMN IF NOT EXISTS unit_price DECIMAL(12, 2) DEFAULT 0",
        "ALTER TABLE sales_out_history ADD COLUMN IF NOT EXISTS customer_name VARCHAR(100)",
        "ALTER TABLE sales_out_history ADD COLUMN IF NOT EXISTS order_id INTEGER",
        
        # 6. prophet_table_history
        """
        CREATE TABLE IF NOT EXISTS prophet_table_history (
            item_id VARCHAR(20) REFERENCES item(item_id),
            date DATE,
            amount DECIMAL(12, 2),
            yhat_lower DECIMAL(12, 2),
            yhat_upper DECIMAL(12, 2),
            PRIMARY KEY (item_id, date)
        )
        """,
        
        # 7. prophet_table_temporary
        """
        CREATE TABLE IF NOT EXISTS prophet_table_temporary (
            item_id VARCHAR(20) REFERENCES item(item_id),
            date DATE,
            amount DECIMAL(12, 2),
            yhat_lower DECIMAL(12, 2),
            yhat_upper DECIMAL(12, 2),
            PRIMARY KEY (item_id, date)
        )
        """,
        
        # 8. ss_ai_history
        """
        CREATE TABLE IF NOT EXISTS ss_ai_history (
            item_id VARCHAR(20) REFERENCES item(item_id),
            date DATE,
            amount DECIMAL(12, 2),
            PRIMARY KEY (item_id, date)
        )
        """,
        
        # 9. ss_ai_temporary
        """
        CREATE TABLE IF NOT EXISTS ss_ai_temporary (
            item_id VARCHAR(20) REFERENCES item(item_id),
            date DATE,
            amount DECIMAL(12, 2),
            PRIMARY KEY (item_id, date)
        )
        """,

        # 9.2. final_safety_stock (Report Table)
        """
        CREATE TABLE IF NOT EXISTS final_safety_stock (
            item_id VARCHAR(20) REFERENCES item(item_id),
            safety_stock DECIMAL(12, 2) DEFAULT 0,
            item_quantity_type quantity_type_enum,
            preference VARCHAR(20) DEFAULT 'AI',
            date DATE,
            PRIMARY KEY (item_id, date)
        )
        """,

        # 9.5. calculated_full_ss_ai_temp
        """
        CREATE TABLE IF NOT EXISTS calculated_full_ss_ai_temp (
            item_id VARCHAR(20) REFERENCES item(item_id),
            date DATE,
            amount DECIMAL(12, 2),
            status VARCHAR(20),
            item_type item_type_enum,
            item_quantity_type quantity_type_enum,
            PRIMARY KEY (item_id, date, status)
        )
        """,

        # 9.6. historical_consumption (BOM-exploded historical requirement)
        """
        CREATE TABLE IF NOT EXISTS historical_consumption (
            item_id VARCHAR(20) REFERENCES item(item_id),
            date DATE,
            amount DECIMAL(12, 2) DEFAULT 0,
            PRIMARY KEY (item_id, date)
        )
        """,

        # 9.7. bom (Bill of Materials)
        """
        CREATE TABLE IF NOT EXISTS bom (
            parent_id VARCHAR(20) REFERENCES item(item_id),
            child_id VARCHAR(20) REFERENCES item(item_id),
            amount DECIMAL(12, 2),
            activity_status activity_status_enum,
            deactivated_by_item_ids TEXT,
            PRIMARY KEY (parent_id, child_id)
        )
        """,
        
        # 10. purchase
        """
        CREATE TABLE IF NOT EXISTS purchase (
            id SERIAL PRIMARY KEY,
            item_id VARCHAR(20) REFERENCES item(item_id),
            supplier_id VARCHAR(20),
            amount DECIMAL(12, 2),
            unit_price DECIMAL(12, 2) DEFAULT 0,
            purchase_date DATE,
            expected_coming_date DATE,
            actual_coming_date DATE,
            delay_day NUMERIC GENERATED ALWAYS AS (actual_coming_date - expected_coming_date) STORED,
            status VARCHAR GENERATED ALWAYS AS (
                CASE 
                    WHEN actual_coming_date IS NOT NULL THEN 'Geldi' 
                    ELSE 'Bekleniyor' 
                END
            ) STORED,
            purpose purchase_purpose_enum,
            FOREIGN KEY (item_id, supplier_id) REFERENCES supplier_item(item_id, supplier_id)
        )
        """,
        "ALTER TABLE purchase ADD COLUMN IF NOT EXISTS unit_price DECIMAL(12, 2) DEFAULT 0",

        # 11. Active Inventory Table
        """
        CREATE TABLE IF NOT EXISTS active_inventory (
            item_id VARCHAR(20) REFERENCES item(item_id),
            location_id VARCHAR(50) REFERENCES warehouse_location(location_id),
            current_stock DECIMAL(12, 2) DEFAULT 0,
            PRIMARY KEY (item_id, location_id)
        )
        """,
        # Migration for existing active_inventory
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'active_inventory') THEN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='active_inventory' AND column_name='location_id') THEN
                    ALTER TABLE active_inventory ADD COLUMN location_id VARCHAR(50) REFERENCES warehouse_location(location_id);
                    UPDATE active_inventory SET location_id = 'ANA_DEPO' WHERE location_id IS NULL;
                    ALTER TABLE active_inventory DROP CONSTRAINT IF EXISTS active_inventory_pkey;
                    ALTER TABLE active_inventory ADD PRIMARY KEY (item_id, location_id);
                END IF;
            END IF;
        END$$;
        """,

        # 11.5. Müşteri Siparişleri (Customer Orders)
        """
        CREATE TABLE IF NOT EXISTS customer_orders (
            id SERIAL PRIMARY KEY,
            customer_name VARCHAR(100),
            item_id VARCHAR(20) REFERENCES item(item_id),
            amount DECIMAL(12, 2),
            order_date DATE,
            expected_delivery_date DATE,
            delivery_date DATE,
            production_time_days INTEGER,
            status customer_order_status_enum DEFAULT 'Bekleniyor'
        )
        """,

        # 11.6. Sipariş Haritası Simülasyon Envanteri
        """
        CREATE TABLE IF NOT EXISTS sip_harita_active_inventory (
            item_id VARCHAR(20) PRIMARY KEY REFERENCES item(item_id),
            current_stock DECIMAL(12, 2) DEFAULT 0
        )
        """,

        # 11.6.5. Sipariş Malzeme Tüketimi (Order Material Consumption)
        """
        CREATE TABLE IF NOT EXISTS order_material_consumption (
            id SERIAL PRIMARY KEY,
            order_id INTEGER REFERENCES customer_orders(id) ON DELETE CASCADE,
            item_id VARCHAR(20) REFERENCES item(item_id) ON DELETE CASCADE,
            amount NUMERIC DEFAULT 0,
            date DATE DEFAULT CURRENT_DATE,
            UNIQUE(order_id, item_id)
        )
        """,

        # 11.6.6. Simülasyon Planlı Envanter
        # Simülasyon sırasında active_inventory'den kopyalanır,
        # sonra her sipariş işlenirken düşülür. Gerçek stoku ETKİLEMEZ.
        """
        CREATE TABLE IF NOT EXISTS planned_inventory (
            item_id VARCHAR(20) PRIMARY KEY REFERENCES item(item_id),
            planned_stock DECIMAL(12, 5) DEFAULT 0
        )
        """,

        # 11.7. Sipariş Simülasyon Etkileri Takip Tablosu
        # Her müşteri siparişinin hangi kalemlerde ne kadar stok değişikliği yaptığını kaydeder
        # Sipariş silindiğinde bu etkiler geri alınır
        """
        CREATE TABLE IF NOT EXISTS order_simulation_effects (
            id SERIAL PRIMARY KEY,
            order_id INTEGER REFERENCES customer_orders(id) ON DELETE CASCADE,
            item_id VARCHAR(20) REFERENCES item(item_id),
            amount DECIMAL(12, 5),
            effect_type VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,

        # 11.8. Sipariş Simülasyon Satın Alma Önerileri
        # Simülasyon motorunun backward scheduling + BOM explosion sonucu ürettiği
        # "bu tarihte bu ürünü sipariş ver" önerileri.
        # Gerçek purchase tablosundan TAMAMEN BAĞIMSIZ bir tablodur.
        """
        CREATE TABLE IF NOT EXISTS purchase_simulation (
            id SERIAL PRIMARY KEY,
            item_id VARCHAR(20) REFERENCES item(item_id),
            supplier_id VARCHAR(20),
            amount DECIMAL(12, 5),
            order_date DATE
        )
        """,
        
        # 12. ss_kings_formula (item ve supplier_item tablolarına bağımlı)
        """
        CREATE TABLE IF NOT EXISTS ss_kings_formula (
            item_id VARCHAR(20) REFERENCES item(item_id),
            supplier_id VARCHAR(20),
            demand_avg DECIMAL(10, 2),
            leadtime_avg DECIMAL(10, 2),
            demand_deviation DECIMAL(10, 2),
            leadtime_deviation DECIMAL(10, 2),
            z_score NUMERIC DEFAULT 1.64,
            result_king NUMERIC GENERATED ALWAYS AS (
                z_score * SQRT(
                    (leadtime_avg * demand_deviation * demand_deviation) + 
                    (demand_avg * demand_avg * leadtime_deviation * leadtime_deviation)
                )
            ) STORED,
            activity_status activity_status_enum,
            PRIMARY KEY (item_id, supplier_id),
            FOREIGN KEY (item_id, supplier_id) REFERENCES supplier_item(item_id, supplier_id)
        )
        """,

        #==================================================================================================================
        # 13. Trigger Functions ve Triggers
        """
        CREATE OR REPLACE FUNCTION update_calculated_leadtime_avg() RETURNS TRIGGER AS $$
        DECLARE
            v_item_id VARCHAR(20);
            v_supplier_id VARCHAR(20);
        BEGIN
            -- UPDATE ile item_id veya supplier_id değiştiyse: HEM eski HEM yeni çift için hesapla
            IF TG_OP = 'UPDATE' AND (OLD.item_id != NEW.item_id OR OLD.supplier_id != NEW.supplier_id) THEN
                PERFORM _recalc_leadtime(OLD.item_id, OLD.supplier_id);
                PERFORM _recalc_leadtime(NEW.item_id, NEW.supplier_id);
                RETURN NEW;
            END IF;

            IF TG_OP = 'DELETE' THEN
                v_item_id := OLD.item_id;
                v_supplier_id := OLD.supplier_id;
            ELSE
                v_item_id := NEW.item_id;
                v_supplier_id := NEW.supplier_id;
            END IF;
            
            PERFORM _recalc_leadtime(v_item_id, v_supplier_id);
            
            IF TG_OP = 'DELETE' THEN
                RETURN OLD;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """,
        
        """
        CREATE OR REPLACE FUNCTION _recalc_leadtime(p_item_id VARCHAR(20), p_supplier_id VARCHAR(20)) RETURNS VOID AS $$
        BEGIN
            UPDATE supplier_item
            SET 
                calculated_leadtime_avg = (
                    SELECT AVG(actual_coming_date - purchase_date)
                    FROM purchase
                    WHERE item_id = p_item_id AND supplier_id = p_supplier_id
                    AND actual_coming_date IS NOT NULL AND purchase_date IS NOT NULL
                ),
                calculated_leadtime_deviation = (
                    SELECT STDDEV(actual_coming_date - purchase_date)
                    FROM purchase
                    WHERE item_id = p_item_id AND supplier_id = p_supplier_id
                    AND actual_coming_date IS NOT NULL AND purchase_date IS NOT NULL
                )
            WHERE item_id = p_item_id AND supplier_id = p_supplier_id;
        END;
        $$ LANGUAGE plpgsql;
        """,
        
        """
        DROP TRIGGER IF EXISTS trigger_update_leadtime_avg ON purchase;
        CREATE TRIGGER trigger_update_leadtime_avg
        AFTER INSERT OR UPDATE OR DELETE ON purchase
        FOR EACH ROW
        EXECUTE FUNCTION update_calculated_leadtime_avg();
        """,
        
        # 14. Cross-Table Sync Triggers (ss_kings_formula <-> supplier_item)
        """
        CREATE OR REPLACE FUNCTION propagate_supplier_item_changes() RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                INSERT INTO ss_kings_formula (item_id, supplier_id, activity_status)
                VALUES (NEW.item_id, NEW.supplier_id, NEW.activity_status)
                ON CONFLICT (item_id, supplier_id) DO NOTHING;
            ELSIF TG_OP = 'UPDATE' THEN
                UPDATE ss_kings_formula
                SET
                    leadtime_avg = CASE 
                        WHEN NEW.calculated = TRUE THEN NEW.calculated_leadtime_avg 
                        ELSE NEW.given_leadtime 
                    END,
                    leadtime_deviation = CASE 
                        WHEN NEW.calculated = TRUE THEN NEW.calculated_leadtime_deviation 
                        ELSE NEW.given_leadtime_deviation 
                    END,
                    activity_status = NEW.activity_status
                WHERE item_id = NEW.item_id AND supplier_id = NEW.supplier_id;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """,
        
        """
        DROP TRIGGER IF EXISTS trigger_propagate_supplier_changes ON supplier_item;
        CREATE TRIGGER trigger_propagate_supplier_changes
        AFTER INSERT OR UPDATE ON supplier_item
        FOR EACH ROW
        EXECUTE FUNCTION propagate_supplier_item_changes();
        """,
        
        """
        CREATE OR REPLACE FUNCTION fetch_ss_parameters() RETURNS TRIGGER AS $$
        DECLARE
            src_row supplier_item%ROWTYPE;
            item_row item%ROWTYPE;
        BEGIN
            -- 1. Fetch Leadtime from supplier_item
            SELECT * INTO src_row FROM supplier_item 
            WHERE item_id = NEW.item_id AND supplier_id = NEW.supplier_id;
            
            IF FOUND THEN
                IF src_row.calculated = TRUE THEN
                    NEW.leadtime_avg := src_row.calculated_leadtime_avg;
                    NEW.leadtime_deviation := src_row.calculated_leadtime_deviation;
                ELSE
                    NEW.leadtime_avg := src_row.given_leadtime;
                    NEW.leadtime_deviation := src_row.given_leadtime_deviation;
                END IF;
            END IF;

            -- 2. Fetch Demand from item
            SELECT * INTO item_row FROM item WHERE item_id = NEW.item_id;
            IF FOUND THEN
                NEW.demand_avg := item_row.demand_avg;
                NEW.demand_deviation := item_row.demand_deviation;
            END IF;
            
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """,
        
        """
        DROP TRIGGER IF EXISTS trigger_fetch_ss_parameters ON ss_kings_formula;
        CREATE TRIGGER trigger_fetch_ss_parameters
        BEFORE INSERT OR UPDATE ON ss_kings_formula
        FOR EACH ROW
        EXECUTE FUNCTION fetch_ss_parameters();
        """,
        
        # 14.5 Sync Logic (Push Demand from Item to SS)
        """
        CREATE OR REPLACE FUNCTION propagate_item_demand_changes() RETURNS TRIGGER AS $$
        BEGIN
            UPDATE ss_kings_formula
            SET 
                demand_avg = NEW.demand_avg,
                demand_deviation = NEW.demand_deviation
            WHERE item_id = NEW.item_id;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """,
        
        """
        DROP TRIGGER IF EXISTS trigger_propagate_item_demand ON item;
        CREATE TRIGGER trigger_propagate_item_demand
        AFTER UPDATE OF demand_avg, demand_deviation ON item
        FOR EACH ROW
        EXECUTE FUNCTION propagate_item_demand_changes();
        """,

        # 14.6 Price History Sync Logic
        """
        CREATE OR REPLACE FUNCTION propagate_item_price_changes() RETURNS TRIGGER AS $$
        BEGIN
            -- Log if it's a new item or if existing item's price/cost changed
            IF (TG_OP = 'INSERT') OR 
               (OLD.unit_cost IS DISTINCT FROM NEW.unit_cost) OR 
               (OLD.unit_price IS DISTINCT FROM NEW.unit_price) THEN
                INSERT INTO item_price_history (item_id, unit_cost, unit_price, date)
                VALUES (NEW.item_id, NEW.unit_cost, NEW.unit_price, CURRENT_DATE)
                ON CONFLICT (item_id, date) DO UPDATE SET
                    unit_cost = EXCLUDED.unit_cost,
                    unit_price = EXCLUDED.unit_price;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """,
        
        """
        DROP TRIGGER IF EXISTS trigger_log_price_history ON item;
        CREATE TRIGGER trigger_log_price_history
        AFTER INSERT OR UPDATE OF unit_cost, unit_price ON item
        FOR EACH ROW
        EXECUTE FUNCTION propagate_item_price_changes();
        """,
        
        # 15. Stock Movement Triggers (Auto-Log Sales)
        """
        CREATE OR REPLACE FUNCTION log_sales_to_history() RETURNS TRIGGER AS $$
        BEGIN
            -- On DELETE or UPDATE: remove old sales record if it was a sales movement
            IF TG_OP IN ('DELETE', 'UPDATE') THEN
                IF OLD.purpose = 'satış_çıkışı' THEN
                    DELETE FROM sales_out_history WHERE id = OLD.id;
                END IF;
            END IF;

            -- On INSERT or UPDATE: add new sales record if it is a sales movement
            IF TG_OP IN ('INSERT', 'UPDATE') THEN
                IF NEW.purpose = 'satış_çıkışı' THEN
                    INSERT INTO sales_out_history (id, item_id, amount, date)
                    VALUES (NEW.id, NEW.item_id, NEW.amount, NEW.date)
                    ON CONFLICT (id) DO UPDATE SET 
                        item_id = EXCLUDED.item_id, 
                        amount = EXCLUDED.amount, 
                        date = EXCLUDED.date;
                END IF;
            END IF;

            IF TG_OP = 'DELETE' THEN
                RETURN OLD;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """,
        
        """
        DROP TRIGGER IF EXISTS trigger_log_sales ON stock_movement;
        CREATE TRIGGER trigger_log_sales
        AFTER INSERT OR UPDATE OR DELETE ON stock_movement
        FOR EACH ROW
        EXECUTE FUNCTION log_sales_to_history();
        """,
        
        # 16. Dynamic Demand Calc (Item Type Based) + Helper Function
        """
        CREATE OR REPLACE FUNCTION update_item_demand_stats() RETURNS TRIGGER AS $$
        DECLARE
            target_item_id VARCHAR(20);
            item_t item_type_enum;
            avg_val DECIMAL(10, 2);
            std_val DECIMAL(10, 2);
        BEGIN
            -- On UPDATE with item_id change: recalculate BOTH old and new items
            IF TG_OP = 'UPDATE' AND OLD.item_id != NEW.item_id THEN
                -- 1. Recalculate OLD item's demand (reverse old effect)
                PERFORM _recalc_demand(OLD.item_id);
                -- 2. Recalculate NEW item's demand (apply new effect)
                PERFORM _recalc_demand(NEW.item_id);
                RETURN NEW;
            END IF;

            -- Standard: pick the right item_id
            IF TG_OP = 'DELETE' THEN
                target_item_id := OLD.item_id;
            ELSE
                target_item_id := NEW.item_id;
            END IF;
            
            PERFORM _recalc_demand(target_item_id);
            
            IF TG_OP = 'DELETE' THEN
                RETURN OLD;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """,
        
        """
        CREATE OR REPLACE FUNCTION _recalc_demand(p_item_id VARCHAR(20)) RETURNS VOID AS $$
        DECLARE
            item_t item_type_enum;
            avg_val DECIMAL(12, 2);
            std_val DECIMAL(12, 2);
        BEGIN
            SELECT item_type INTO item_t FROM item WHERE item_id = p_item_id;
            
            IF item_t = 'hammadde' OR item_t = 'yarı_mamül' THEN
                -- Net Consumption = Transfers to Production - Returns to Warehouse
                SELECT AVG(daily_net), STDDEV(daily_net)
                INTO avg_val, std_val
                FROM (
                    SELECT date, SUM(
                        CASE 
                            WHEN target_location_id = 'ÜRETİM' THEN amount 
                            WHEN source_location_id = 'ÜRETİM' THEN -amount 
                            ELSE 0 
                        END
                    ) as daily_net
                    FROM stock_movement
                    WHERE item_id = p_item_id
                    GROUP BY date
                ) daily;
                
                -- If no movements yet, fallback to older purpose logic for semi-finished if needed
                IF avg_val IS NULL AND item_t = 'yarı_mamül' THEN
                     SELECT AVG(amount), STDDEV(amount) 
                     INTO avg_val, std_val
                     FROM stock_movement 
                     WHERE item_id = p_item_id AND purpose IN ('üretime_giden', 'satış_çıkışı');
                END IF;
                
            ELSIF item_t = 'mamül' THEN
                -- Sales from Warehouse to Shipping or External
                SELECT AVG(amount), STDDEV(amount) 
                INTO avg_val, std_val
                FROM stock_movement 
                WHERE item_id = p_item_id 
                AND (source_location_id = 'ANA_DEPO' AND (target_location_id = 'SEVKİYAT_DEPO' OR target_location_id IS NULL));
                
                -- Fallback to sales_out_history if no movements recorded yet
                IF avg_val IS NULL THEN
                    SELECT AVG(amount), STDDEV(amount) 
                    INTO avg_val, std_val
                    FROM sales_out_history 
                    WHERE item_id = p_item_id;
                END IF;

            ELSE
                RETURN;
            END IF;
            
            UPDATE item 
            SET demand_avg = COALESCE(avg_val, 0), 
                demand_deviation = COALESCE(std_val, 0)
            WHERE item_id = p_item_id;
        END;
        $$ LANGUAGE plpgsql;
        """,
        
        """
        DROP TRIGGER IF EXISTS trigger_calc_demand_purchase ON purchase;
        CREATE TRIGGER trigger_calc_demand_purchase
        AFTER INSERT OR UPDATE OR DELETE ON purchase
        FOR EACH ROW
        EXECUTE FUNCTION update_item_demand_stats();
        """,
        
        """
        DROP TRIGGER IF EXISTS trigger_calc_demand_sales ON sales_out_history;
        CREATE TRIGGER trigger_calc_demand_sales
        AFTER INSERT OR UPDATE OR DELETE ON sales_out_history
        FOR EACH ROW
        EXECUTE FUNCTION update_item_demand_stats();
        """,
        
        """
        DROP TRIGGER IF EXISTS trigger_calc_demand_stock ON stock_movement;
        CREATE TRIGGER trigger_calc_demand_stock
        AFTER INSERT OR UPDATE OR DELETE ON stock_movement
        FOR EACH ROW
        EXECUTE FUNCTION update_item_demand_stats();
        """,

        
        # 18. Trigger: Real-time Active Inventory Update AND Simulation Inventory Sync
        """
        CREATE OR REPLACE FUNCTION update_active_inventory() RETURNS TRIGGER AS $$
        DECLARE
            v_item_id VARCHAR(20);
            v_amount DECIMAL(15, 4);
            v_source VARCHAR(50);
            v_target VARCHAR(50);
        BEGIN
            -- === PHASE 1: REVERSE OLD ROW (on UPDATE or DELETE) ===
            IF TG_OP IN ('UPDATE', 'DELETE') THEN
                v_source := OLD.source_location_id;
                v_target := OLD.target_location_id;
                
                -- Backward compatibility for purpose-based logic
                IF v_source IS NULL AND v_target IS NULL THEN
                    IF OLD.purpose = 'giriş' THEN v_target := 'ANA_DEPO';
                    ELSIF OLD.purpose IN ('üretime_giden', 'satış_çıkışı', 'çıkış') THEN v_source := 'ANA_DEPO';
                    END IF;
                END IF;

                IF v_source IS NOT NULL THEN
                    UPDATE active_inventory SET current_stock = current_stock + OLD.amount 
                    WHERE item_id = OLD.item_id AND location_id = v_source;
                END IF;
                IF v_target IS NOT NULL THEN
                    UPDATE active_inventory SET current_stock = current_stock - OLD.amount 
                    WHERE item_id = OLD.item_id AND location_id = v_target;
                END IF;
                
                -- Sip Harita (Total Inventory) - keep item_id based for now
                IF v_target IS NOT NULL AND v_source IS NULL THEN -- Incoming
                    UPDATE sip_harita_active_inventory SET current_stock = current_stock - OLD.amount WHERE item_id = OLD.item_id;
                ELSIF v_source IS NOT NULL AND v_target IS NULL THEN -- Outgoing
                    UPDATE sip_harita_active_inventory SET current_stock = current_stock + OLD.amount WHERE item_id = OLD.item_id;
                END IF;
            END IF;

            -- === PHASE 2: APPLY NEW ROW (on INSERT or UPDATE) ===
            IF TG_OP IN ('INSERT', 'UPDATE') THEN
                v_source := NEW.source_location_id;
                v_target := NEW.target_location_id;
                
                -- Backward compatibility
                IF v_source IS NULL AND v_target IS NULL THEN
                    IF NEW.purpose = 'giriş' THEN v_target := 'ANA_DEPO';
                    ELSIF NEW.purpose IN ('üretime_giden', 'satış_çıkışı', 'çıkış') THEN v_source := 'ANA_DEPO';
                    END IF;
                END IF;

                IF v_source IS NOT NULL THEN
                    INSERT INTO active_inventory (item_id, location_id, current_stock) VALUES (NEW.item_id, v_source, 0) ON CONFLICT (item_id, location_id) DO NOTHING;
                    UPDATE active_inventory SET current_stock = current_stock - NEW.amount 
                    WHERE item_id = NEW.item_id AND location_id = v_source;
                END IF;
                IF v_target IS NOT NULL THEN
                    INSERT INTO active_inventory (item_id, location_id, current_stock) VALUES (NEW.item_id, v_target, 0) ON CONFLICT (item_id, location_id) DO NOTHING;
                    UPDATE active_inventory SET current_stock = current_stock + NEW.amount 
                    WHERE item_id = NEW.item_id AND location_id = v_target;
                END IF;

                -- Sip Harita (Total Inventory)
                INSERT INTO sip_harita_active_inventory (item_id, current_stock) VALUES (NEW.item_id, 0) ON CONFLICT (item_id) DO NOTHING;
                IF v_target IS NOT NULL AND v_source IS NULL THEN -- Incoming
                    UPDATE sip_harita_active_inventory SET current_stock = current_stock + NEW.amount WHERE item_id = NEW.item_id;
                ELSIF v_source IS NOT NULL AND v_target IS NULL THEN -- Outgoing
                    UPDATE sip_harita_active_inventory SET current_stock = current_stock - NEW.amount WHERE item_id = NEW.item_id;
                END IF;
            END IF;

            IF TG_OP = 'DELETE' THEN
                RETURN OLD;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """,
        
        """
        DROP TRIGGER IF EXISTS trigger_update_active_inventory ON stock_movement;
        CREATE TRIGGER trigger_update_active_inventory
        AFTER INSERT OR UPDATE OR DELETE ON stock_movement
        FOR EACH ROW
        EXECUTE FUNCTION update_active_inventory();
        """,
        
        # 19. Trigger: Monthly Snapshot (Start Inventories) with Gap Filling
        """
        CREATE OR REPLACE FUNCTION record_monthly_snapshot() RETURNS TRIGGER AS $$
        DECLARE
            target_month DATE;
            last_snapshot DATE;
            current_inv DECIMAL(12, 2);
            missing_month DATE;
        BEGIN
            -- 1. Calculate 1st day of the month for the NEW movement
            target_month := DATE_TRUNC('month', NEW.date)::DATE;
            
            -- 2. Fetch current stock (carry-over from prev month)
            SELECT current_stock INTO current_inv 
            FROM active_inventory 
            WHERE item_id = NEW.item_id;
            
            IF current_inv IS NULL THEN
                current_inv := 0;
            END IF;

            -- 3. Find the last recorded snapshot date
            SELECT MAX(date) INTO last_snapshot
            FROM start_inventories
            WHERE item_id = NEW.item_id AND date < target_month;
            
            -- 4. Gap Filling Logic
            IF last_snapshot IS NULL THEN
                -- If no prior history, just ensure current month exists
                INSERT INTO start_inventories (item_id, date, amount)
                VALUES (NEW.item_id, target_month, current_inv)
                ON CONFLICT (item_id, date) DO NOTHING;
            ELSE
                -- Fill all months from Last Snapshot + 1 Month UP TO Target Month
                FOR missing_month IN 
                    SELECT d::DATE 
                    FROM generate_series(last_snapshot + INTERVAL '1 month', target_month, INTERVAL '1 month') AS d
                LOOP
                    INSERT INTO start_inventories (item_id, date, amount)
                    VALUES (NEW.item_id, missing_month, current_inv)
                    ON CONFLICT (item_id, date) DO NOTHING;
                END LOOP;
            END IF;
            
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """,
        
        """
        DROP TRIGGER IF EXISTS trigger_monthly_snapshot ON stock_movement;
        CREATE TRIGGER trigger_monthly_snapshot
        BEFORE INSERT ON stock_movement
        FOR EACH ROW
        EXECUTE FUNCTION record_monthly_snapshot();
        """,

        # 20. Trigger: Purchase -> Simulation Inventory (INSERT/UPDATE/DELETE)
        """
        CREATE OR REPLACE FUNCTION update_sim_inventory_on_purchase() RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'DELETE' THEN
                -- Sipariş silindi: eklenen stoğu geri al
                UPDATE sip_harita_active_inventory 
                SET current_stock = current_stock - OLD.amount 
                WHERE item_id = OLD.item_id;
                RETURN OLD;
                
            ELSIF TG_OP = 'UPDATE' THEN
                -- Eski etkiyi geri al
                UPDATE sip_harita_active_inventory 
                SET current_stock = current_stock - OLD.amount 
                WHERE item_id = OLD.item_id;
                
                -- Yeni etkiyi uygula
                INSERT INTO sip_harita_active_inventory (item_id, current_stock) VALUES (NEW.item_id, 0)
                ON CONFLICT (item_id) DO NOTHING;
                
                UPDATE sip_harita_active_inventory 
                SET current_stock = current_stock + NEW.amount 
                WHERE item_id = NEW.item_id;
                RETURN NEW;
                
            ELSE -- INSERT
                INSERT INTO sip_harita_active_inventory (item_id, current_stock) VALUES (NEW.item_id, 0)
                ON CONFLICT (item_id) DO NOTHING;
                
                UPDATE sip_harita_active_inventory 
                SET current_stock = current_stock + NEW.amount 
                WHERE item_id = NEW.item_id;
                RETURN NEW;
            END IF;
        END;
        $$ LANGUAGE plpgsql;
        """,
        
        """
        DROP TRIGGER IF EXISTS trigger_sim_upt_purchase ON purchase;
        CREATE TRIGGER trigger_sim_upt_purchase
        AFTER INSERT OR UPDATE OR DELETE ON purchase
        FOR EACH ROW
        EXECUTE FUNCTION update_sim_inventory_on_purchase();
        """
    ]

    try:
        # 1. Varsayilan 'postgres' veritabanina baglanarak hedef veritabanini olustur
        conn_default = psycopg2.connect(dbname='postgres', user=DB_CONFIG['user'], password=DB_CONFIG['password'], host=DB_CONFIG['host'], port=DB_CONFIG['port'])
        conn_default.autocommit = True
        cur_default = conn_default.cursor()
        
        cur_default.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{DB_CONFIG['dbname']}'")
        exists = cur_default.fetchone()
        if not exists:
            logger.warning(f"Veritabani '{DB_CONFIG['dbname']}' bulunamadi, olusturuluyor...")
            cur_default.execute(f"CREATE DATABASE \"{DB_CONFIG['dbname']}\"")
            logger.info("Veritabani olusturuldu.")
        else:
             logger.info(f"Veritabani '{DB_CONFIG['dbname']}' zaten mevcut.")
             
        cur_default.close()
        conn_default.close()

        # 2. Simdi hedef veritabanina baglan
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        # Komutları sırayla çalıştır
        logger.info("Tablolar olusturuluyor...")
        for command in commands:
            # Tablo adını logla (basit bir parse işlemi ile)
            if "CREATE TABLE" in command:
                 try:
                    table_name = command.split("EXISTS")[1].split("(")[0].strip()
                    logger.info(f"- {table_name}")
                 except:
                    pass
            cur.execute(command)

        # Değişiklikleri kaydet
        conn.commit()


        logger.info("Tum tablolar basariyla olusturuldu!")

        cur.close()
        conn.close()

    except (Exception, psycopg2.DatabaseError) as error:
        logger.error(f"Hata olustu: {error}")

if __name__ == '__main__':
    create_tables()
