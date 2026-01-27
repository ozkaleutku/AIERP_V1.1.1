import pandas as pd
import numpy as np
import lightgbm as lgb
import logging
from datetime import datetime
from dateutil.relativedelta import relativedelta
import sys
import os
import io

# Fix Windows encoding issues with Turkish characters
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Add backend root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database.db_helper import run_query, run_command, run_command_batch

# Uyarıları kapat
import warnings
warnings.filterwarnings('ignore')

def run_lightgbm_training():
    
    # ---------------------------------------------------------
    # 1. VERİLERİ VERİTABANINDAN ÇEK (Data Loading)
    # ---------------------------------------------------------
    print("1. Veritabanindan Veriler Cekiliyor...")
    
    # A. Prophet Tahminleri
    df_prophet = run_query("SELECT * FROM prophet_table_temporary")
    df_prophet['date'] = pd.to_datetime(df_prophet['date'])
    df_prophet['year'] = df_prophet['date'].dt.year
    df_prophet['month'] = df_prophet['date'].dt.month
    df_prophet.rename(columns={'amount': 'prophet_forecast'}, inplace=True) 

    # B. Siparis Gecmisi (Purchase)
    df_orders = run_query("SELECT * FROM purchase")
    df_orders['purchase_date'] = pd.to_datetime(df_orders['purchase_date'])
    df_orders['year'] = df_orders['purchase_date'].dt.year
    df_orders['month'] = df_orders['purchase_date'].dt.month
    # Amac (purpose) bossa 'stok' (normal siparis) olarak doldur ki hata vermesin
    if 'purpose' in df_orders.columns:
        df_orders['purpose'] = df_orders['purpose'].fillna('stok')

    # C. Stok Hareketleri (Stock Movement)
    df_movements = run_query("SELECT * FROM stock_movement")
    df_movements['date'] = pd.to_datetime(df_movements['date'])
    df_movements['year'] = df_movements['date'].dt.year
    df_movements['month'] = df_movements['date'].dt.month

    # D. Envanter Gecmisi (Start Inventories)
    df_inventory = run_query("SELECT * FROM start_inventories")
    df_inventory['date'] = pd.to_datetime(df_inventory['date'])
    df_inventory['year'] = df_inventory['date'].dt.year
    df_inventory['month'] = df_inventory['date'].dt.month
    df_inventory.rename(columns={'amount': 'start_stock'}, inplace=True)

    # E. Item & Supplier Bilgileri (Risk Parameters)
    item_query = """
    SELECT 
        i.item_id, 
        i.item_type, 
        i.item_quantity_type,
        i.demand_avg, 
        i.demand_deviation,
        s.supplier_id,
        sk.result_king,
        sk.leadtime_avg,
        sk.leadtime_deviation
    FROM item i
    LEFT JOIN ss_kings_formula sk ON i.item_id = sk.item_id
    LEFT JOIN supplier_item s ON i.item_id = s.item_id AND s.supplier_id = sk.supplier_id
    """
    df_master = run_query(item_query)

    # ---------------------------------------------------------
    # 2. FEATURE ENGINEERING (Gecmis Verilerden)
    # ---------------------------------------------------------
    print("2. Ozellik Muhendisligi (Feature Engineering)...")

    # A. Tuketim Istatistikleri (Aylik Bazda)
    # 1. Net Tuketimler: 'uretime_giden' ve 'satis_cikisi' her zaman tuketimdir.
    # 2. Genel 'cikis': Sadece ECCMIS (CUTOFF tarihinden onceki) kayitlarda tuketim sayilir.
    #    Bu tarihten sonraki 'cikis' kayitlari fire/zayi kabul edilir ve tuketime dahil edilmez.
    
    # A. Tuketim Istatistikleri (Aylik Bazda)
    # 1. Net Tuketimler: 'uretime_giden' ve 'satis_cikisi' her zaman tuketimdir.
        
    cons_mask = df_movements['purpose'].isin(['uretime_giden', 'satis_cikisi'])

    if not df_movements[cons_mask].empty:
        df_cons = df_movements[cons_mask].groupby(['item_id', 'year', 'month'])['amount'].agg(['sum', 'mean', 'std']).reset_index()
        df_cons.rename(columns={'sum': 'actual_consumption', 'mean': 'daily_avg', 'std': 'daily_std'}, inplace=True)
        # CV Hesaplama (Varyasyon Katsayısı)
        df_cons['current_cv'] = df_cons['daily_std'] / (df_cons['daily_avg'] + 0.001)
    else:
        df_cons = pd.DataFrame(columns=['item_id', 'year', 'month', 'actual_consumption', 'current_cv'])

    # B. Gecikme Istatistikleri
    if not df_orders.empty:
        df_late = df_orders[df_orders['delay_day'] > 0].copy()
        if not df_late.empty:
            df_delay = df_late.groupby(['item_id', 'year', 'month'])['delay_day'].agg(['mean', 'max', 'count']).reset_index()
            df_delay.rename(columns={'mean': 'current_avg_delay', 'max': 'current_max_delay', 'count': 'current_delay_freq'}, inplace=True)
        else:
            df_delay = pd.DataFrame(columns=['item_id', 'year', 'month', 'current_avg_delay', 'current_max_delay', 'current_delay_freq'])
        
        # C. Panik Siparis (Acil Siparis) - DUZELTILDI
        df_panic = df_orders[df_orders['purpose'] == 'acil_siparis']
        if not df_panic.empty:
            df_panic_agg = df_panic.groupby(['item_id', 'year', 'month']).agg({
                'amount': 'sum',
                'purchase_date': 'count'  # Siparis sayisi icin dogru kolon
            }).reset_index()
            df_panic_agg.rename(columns={
                'amount': 'current_recovery_qty',
                'purchase_date': 'current_panic_count'
            }, inplace=True)
        else:
            df_panic_agg = pd.DataFrame(columns=['item_id', 'year', 'month', 'current_recovery_qty', 'current_panic_count'])
    else:
        df_delay = pd.DataFrame(columns=['item_id', 'year', 'month', 'current_avg_delay', 'current_max_delay', 'current_delay_freq'])
        df_panic_agg = pd.DataFrame(columns=['item_id', 'year', 'month', 'current_recovery_qty', 'current_panic_count'])

    # ---------------------------------------------------------
    # 3. EGITIM SETINI HAZIRLA
    # ---------------------------------------------------------
    print("3. Egitim Seti Hazirlaniyor...")
    
    df_train = df_inventory[['item_id', 'year', 'month', 'start_stock']].copy()
    
    # Gercek Tuketimi Ekle (TARGET icin gerekli)
    df_train = df_train.merge(df_cons[['item_id', 'year', 'month', 'actual_consumption', 'current_cv']], 
                               on=['item_id', 'year', 'month'], how='left')
    df_train = df_train.merge(df_delay, on=['item_id', 'year', 'month'], how='left')
    df_train = df_train.merge(df_panic_agg, on=['item_id', 'year', 'month'], how='left')
    
    # Master Data ekle
    df_train = df_train.merge(df_master, on='item_id', how='left')

    # Prophet Tahminlerini Ekle
    df_train = df_train.merge(df_prophet[['item_id', 'year', 'month', 'prophet_forecast']], 
                               on=['item_id', 'year', 'month'], how='left')

    # NaN Doldurma
    df_train['actual_consumption'] = df_train['actual_consumption'].fillna(0)
    df_train['prophet_forecast'] = df_train['prophet_forecast'].fillna(0)
    
    cols_fill0 = ['current_cv', 'current_avg_delay', 'current_max_delay', 'current_delay_freq', 
                  'current_recovery_qty', 'current_panic_count', 'result_king', 
                  'leadtime_avg', 'leadtime_deviation', 'demand_avg', 'demand_deviation']
    for c in cols_fill0:
        if c in df_train.columns:
            df_train[c] = df_train[c].fillna(0)

    # ---------------------------------------------------------
    # 4. GEÇMİŞ PATTERN'LARI HESAPLA (LAG Features - Data Leakage Önleme)
    # ---------------------------------------------------------
    print("4. Gecmis Pattern'lar Hesaplaniyor (Lag Features)...")
    
    # Sıralama (Zaman Serisine Göre)
    df_train = df_train.sort_values(['item_id', 'year', 'month']).reset_index(drop=True)
    
    # Her item için GEÇMİŞ pattern'ları hesapla
    # Rolling window: Son 3 ayın ortalaması (minimum 1 ay)
    
    df_train['hist_cv'] = df_train.groupby('item_id')['current_cv'].transform(
        lambda x: x.shift(1).rolling(window=3, min_periods=1).mean()
    )
    
    df_train['hist_panic_count'] = df_train.groupby('item_id')['current_panic_count'].transform(
        lambda x: x.shift(1).rolling(window=3, min_periods=1).mean()
    )
    
    df_train['hist_avg_delay'] = df_train.groupby('item_id')['current_avg_delay'].transform(
        lambda x: x.shift(1).rolling(window=3, min_periods=1).mean()
    )
    
    df_train['hist_max_delay'] = df_train.groupby('item_id')['current_max_delay'].transform(
        lambda x: x.shift(1).rolling(window=3, min_periods=1).max()
    )
    
    # Tüketim Trendi (Son 3 ayın eğilimi)
    df_train['consumption_trend'] = df_train.groupby('item_id')['actual_consumption'].transform(
        lambda x: x.shift(1).rolling(window=3, min_periods=1).mean()
    )
    
    # Mevsimsellik (Sin/Cos encoding)
    df_train['month_sin'] = np.sin(2 * np.pi * df_train['month'] / 12)
    df_train['month_cos'] = np.cos(2 * np.pi * df_train['month'] / 12)
    
    # NaN'ları temizle (İlk aylar için lag yoktur)
    lag_cols = ['hist_cv', 'hist_panic_count', 'hist_avg_delay', 'hist_max_delay', 'consumption_trend']
    for c in lag_cols:
        df_train[c] = df_train[c].fillna(0)

    # ---------------------------------------------------------
    # 5. TARGET DEĞİŞKEN HESAPLAMA
    # ---------------------------------------------------------
    print("5. Target Degisken Hesaplaniyor...")
    
    # TARGET: O ayın GERÇEK ihtiyacı (Actual Consumption)
    
    df_train['TARGET_SAFETY_STOCK'] = df_train['actual_consumption']
    
    # ✅ Eğitim için yeterli veri kontrolü (ERKENDEN!)
    df_train_valid = df_train[df_train['TARGET_SAFETY_STOCK'] > 0].copy()
    
    if len(df_train_valid) < 20:
        print(f"⚠️ Yetersiz egitim verisi ({len(df_train_valid)} satir). Minimum 20 satir gerekli.")
        run_command("TRUNCATE TABLE ss_ai_temporary")
        return
    
    print(f"✓ {len(df_train_valid)} satir egitim verisi hazir.")

    # ---------------------------------------------------------
    # 6. KATEGORİK DEĞİŞKEN DÖNÜŞÜMLERİ
    # ---------------------------------------------------------
    cat_feats = ['supplier_id', 'item_type', 'item_quantity_type']
    for c in cat_feats:
        if c in df_train_valid.columns:
            df_train_valid[c] = df_train_valid[c].astype('category')

    # ---------------------------------------------------------
    # 7. FEATURE LİSTESİ (Data Leakage YOK!)
    # ---------------------------------------------------------
    features = [
        # Prophet Tahmini
        'prophet_forecast',
        
        # Başlangıç Durumu
        'start_stock',
        
        # Mevsimsellik
        'month_sin', 'month_cos',
        
        # Geçmiş Pattern'lar (LAG - Geleceği sızdırmaz!)
        'hist_cv',
        'hist_panic_count',
        'hist_avg_delay',
        'hist_max_delay',
        'consumption_trend',
        
        # Item Özellikleri (Sabit bilgiler)
        'result_king',  # Kings Formula sonucu (klasik safety stock)
        'demand_avg',
        'demand_deviation',
        'leadtime_avg',
        'leadtime_deviation',
        
        # Kategorik
        'supplier_id',
        'item_type',
        'item_quantity_type'
    ]
    
    valid_features = [f for f in features if f in df_train_valid.columns]
    
    print(f"✓ {len(valid_features)} feature kullanılıyor.")

    # ---------------------------------------------------------
    # 8. MODEL EĞİTİMİ (Quantile Regression) - DÜZELTİLDİ
    # ---------------------------------------------------------
    print("6. LightGBM Modeli Egitiliyor...")
    
    model = lgb.LGBMRegressor(
        objective='quantile',
        alpha=0.95,  # %95 güven aralığı (üst sınır tahmini)
        n_estimators=500,
        learning_rate=0.05,
        max_depth=6,
        num_leaves=31,
        min_child_samples=10,  # ✅ 5 → 10 (daha stabil)
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,  # ✅ L1 regularization (overfitting önleme)
        reg_lambda=0.1,  # ✅ L2 regularization (overfitting önleme)
        random_state=42,
        verbose=-1
    )
    
    model.fit(
        df_train_valid[valid_features], 
        df_train_valid['TARGET_SAFETY_STOCK'],
        categorical_feature=cat_feats
    )
    
    print("✓ Model egitimi tamamlandi.")
    
    # ✅ Feature Importance Analizi
    feature_importance = pd.DataFrame({
        'feature': valid_features,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    print("\n📊 En Onemli 10 Feature:")
    print(feature_importance.head(10).to_string(index=False))

    # ---------------------------------------------------------
    # 9. GELECEK DÖNEM TAHMİNLERİ - DÜZELTİLDİ
    # ---------------------------------------------------------
    print("\n7. Gelecek Donem Tahminleri Yapiliyor...")
    
    df_future = df_prophet.copy()
    df_future = df_future.merge(df_master, on='item_id', how='left')
    
    # ✅ Geçmiş GERÇEK değerlerin ortalamalarını al (Son 6 aylık)
    recent_patterns = df_train.groupby('item_id').tail(6).groupby('item_id').agg({
        'current_cv': 'mean',  # ✅ GERÇEK CV (hist_cv değil!)
        'current_panic_count': 'mean',
        'current_avg_delay': 'mean',
        'current_max_delay': 'max',
        'actual_consumption': 'mean'
    }).reset_index()
    
    # ✅ Feature isimleriyle eşleştir
    recent_patterns.rename(columns={
        'current_cv': 'hist_cv',
        'current_panic_count': 'hist_panic_count',
        'current_avg_delay': 'hist_avg_delay',
        'current_max_delay': 'hist_max_delay',
        'actual_consumption': 'consumption_trend'
    }, inplace=True)
    
    df_future = df_future.merge(recent_patterns, on='item_id', how='left')
    
    # Başlangıç Stoğu (Active Inventory'den)
    last_stock_query = "SELECT item_id, current_stock FROM active_inventory"
    df_last_stock = run_query(last_stock_query)
    df_future = df_future.merge(df_last_stock, on='item_id', how='left')
    df_future['start_stock'] = df_future['current_stock'].fillna(0)
    
    # Mevsimsellik
    df_future['month_sin'] = np.sin(2 * np.pi * df_future['month'] / 12)
    df_future['month_cos'] = np.cos(2 * np.pi * df_future['month'] / 12)
    
    # NaN temizleme
    for c in valid_features:
        if c in df_future.columns:
            df_future[c] = df_future[c].fillna(0)
    
    # Kategorik dönüşüm
    for c in cat_feats:
        if c in df_future.columns:
            df_future[c] = df_future[c].astype('category')
    
    # Tahmin
    preds = model.predict(df_future[valid_features])
    df_future['ai_safety_stock'] = np.maximum(preds, 0)  # Negatif değerleri temizle
    
    print(f"✓ {len(df_future)} adet tahmin yapildi.")

    # ---------------------------------------------------------
    # 10. SONUÇLARI KAYDET
    # ---------------------------------------------------------
    print("\n8. Sonuclar Veritabanina Kaydediliyor...")
    
    # A. History Yedekleme (Transaction benzeri güvenlik)
    print("Mevcut geçici veriler history tablosuna yedekleniyor...")
    run_command("""
    INSERT INTO ss_ai_history (item_id, date, amount)
    SELECT item_id, date, amount FROM ss_ai_temporary
    ON CONFLICT (item_id, date) DO NOTHING
    """)
    
    # B. Temizlik
    print("Geçici tablo temizleniyor...")
    run_command("TRUNCATE TABLE ss_ai_temporary")
    
    insert_query = """
    INSERT INTO ss_ai_temporary (item_id, date, amount)
    VALUES (%s, %s, %s)
    """
    
    # Prepare batch data
    batch_data = [
        (row['item_id'], row['date'].date(), round(row['ai_safety_stock'], 2))
        for _, row in df_future.iterrows()
    ]
    
    # Batch insert for performance
    if run_command_batch(insert_query, batch_data):
        print(f"✅ TAMAMLANDI! {len(batch_data)} adet AI Safety Stock tahmini olusturuldu.")
    else:
        print("❌ KAYIT HATASI! Veriler veritabanına yazılamadı.")

if __name__ == "__main__":
    run_lightgbm_training()
