# 🗄️ Veritabanı Şeması ve İlişki Haritası (Database Schema)

Bu belge, AI tabanlı MRP sisteminin veritabanı yapısını, tablolar arası ilişkileri ve otomasyonu sağlayan trigger mekanizmalarını detaylandırır.

---

## 📋 ENUM Tipleri

Sistemde kullanılan tüm PostgreSQL ENUM tipleri:

| ENUM Adı | Değerler | Kullanıldığı Yer |
| :--- | :--- | :--- |
| `item_type_enum` | `mamül`, `yarı_mamül`, `hammadde` | `item.item_type` |
| `quantity_type_enum` | `gram`, `adet`, `litre` | `item.item_quantity_type` |
| `movement_purpose_enum` | `üretime_giden`, `satış_çıkışı`, `giriş`, `çıkış` | `stock_movement.purpose` |
| `purchase_purpose_enum` | `emniyet_stoku_için`, `acil_sipariş`, `normal_sipariş` | `purchase.purpose` |
| `activity_status_enum` | `Aktif`, `Pasif` | `item`, `bom`, `supplier_item` |
| `customer_order_status_enum` | `Bekleniyor`, `Üretimde`, `Hazır`, `Sevk Edildi` | `customer_orders.status` |
| `level_status_enum` | `Level 0` ~ `Level 9` | `calculated_full_ss_ai_temp.status` |

---

## 📊 Varlık İlişki Diyagramı (ERD)

Aşağıdaki diyagram, sistemdeki **TÜM** tabloların sütun ve veri tiplerini kapsamlı bir şekilde gösterir.

```mermaid
erDiagram
    %% İlişkiler
    ITEM ||--o| ACTIVE_INVENTORY : "tracks"
    ITEM ||--o{ STOCK_MOVEMENT : "logs"
    ITEM ||--o{ SALES_OUT_HISTORY : "archives"
    ITEM ||--o{ START_INVENTORIES : "snapshots"
    ITEM ||--o{ CUSTOMER_ORDERS : "ordered"
    ITEM ||--o{ BOM : "parent"
    ITEM ||--o{ BOM : "child"
    ITEM ||--o{ SUPPLIER_ITEM : "supplied_by"
    
    SUPPLIER_ITEM ||--o{ PURCHASE : "fulfilled_by"
    SUPPLIER_ITEM ||--|| SS_KINGS_FORMULA : "risk_params"

    CUSTOMER_ORDERS ||--o{ SIM_ORDER_EFFECTS : "impacts"
    
    ITEM ||--o| SIP_HARITA_ACTIVE_INVENTORY : "simulates"
    ITEM ||--o{ PROPHET_TABLE_HISTORY : "forecasts"
    ITEM ||--o{ PROPHET_TABLE_TEMPORARY : "temp_forecasts"
    ITEM ||--o{ SS_AI_HISTORY : "ai_safety_stock"
    ITEM ||--o{ SS_AI_TEMPORARY : "temp_ai_ss"
    ITEM ||--o{ FINAL_SAFETY_STOCK : "final_report"
    ITEM ||--o{ CALCULATED_FULL_SS_AI_TEMP : "bom_explosion"

    %%-------------------------------------------------------------------------
    %% 1. ANA VERİ TABLOLARI (MASTER DATA)
    %%-------------------------------------------------------------------------
    
    ITEM {
        varchar item_id PK
        item_type_enum item_type "mamul, yari_mamul, hammadde"
        quantity_type_enum item_quantity_type "adet, gram, litre"
        activity_status_enum activity_status "Aktif, Pasif"
        decimal demand_avg "Trigger ile hesaplanir"
        decimal demand_deviation "Trigger ile hesaplanir"
    }

    SUPPLIER_ITEM {
        varchar item_id PK_FK
        varchar supplier_id PK
        decimal calculated_leadtime_avg "Trigger ile hesaplanir"
        decimal calculated_leadtime_deviation "Trigger ile hesaplanir"
        decimal given_leadtime
        decimal given_leadtime_deviation
        decimal lot_size
        decimal min_size
        decimal max_size
        boolean calculated "true ise sistem degerlerini kullan"
        activity_status_enum activity_status
    }

    BOM {
        varchar parent_id PK_FK
        varchar child_id PK_FK
        decimal amount
        activity_status_enum activity_status
    }

    ACTIVE_INVENTORY {
        varchar item_id PK_FK
        decimal current_stock "Trigger ile guncellenir"
    }

    %%-------------------------------------------------------------------------
    %% 2. HAREKET TABLOLARI (TRANSACTION DATA)
    %%-------------------------------------------------------------------------

    PURCHASE {
        serial id PK
        varchar item_id FK
        varchar supplier_id FK
        decimal amount
        date purchase_date
        date expected_coming_date
        date actual_coming_date
        numeric delay_day "Generated: actual - expected"
        varchar status "Generated: Beklemede veya Geldi"
        purchase_purpose_enum purpose "emniyet_stoku_icin, acil_siparis, normal_siparis"
    }

    STOCK_MOVEMENT {
        serial id PK
        varchar item_id FK
        decimal amount
        movement_purpose_enum purpose "uretime_giden, satis_cikisi, giris, cikis"
        date date
        integer order_id "Opsiyonel - musteri siparis iliskilendirme"
    }

    START_INVENTORIES {
        varchar item_id PK_FK
        date date PK
        decimal amount
    }

    SALES_OUT_HISTORY {
        serial id PK
        varchar item_id FK
        decimal amount
        date date
    }

    CUSTOMER_ORDERS {
        serial id PK
        varchar customer_name
        varchar item_id FK
        decimal amount
        date order_date
        date expected_delivery_date
        date delivery_date
        int production_time_days
        customer_order_status_enum status "Bekleniyor, Uretimde, Hazir, Sevk Edildi"
    }

    %%-------------------------------------------------------------------------
    %% 3. ANALİTİK VE YAPAY ZEKA TABLOLARI
    %%-------------------------------------------------------------------------

    SS_KINGS_FORMULA {
        varchar item_id PK_FK
        varchar supplier_id PK_FK
        decimal demand_avg
        decimal leadtime_avg
        decimal demand_deviation
        decimal leadtime_deviation
        numeric z_score
        numeric result_king "Generated Column"
        activity_status_enum activity_status
    }

    PROPHET_TABLE_HISTORY {
        varchar item_id PK_FK
        date date PK
        decimal amount
    }

    PROPHET_TABLE_TEMPORARY {
        varchar item_id PK_FK
        date date PK
        decimal amount
    }

    SS_AI_HISTORY {
        varchar item_id PK_FK
        date date PK
        decimal amount
    }

    SS_AI_TEMPORARY {
        varchar item_id PK_FK
        date date PK
        decimal amount
    }

    FINAL_SAFETY_STOCK {
        varchar item_id PK_FK
        date date PK
        decimal safety_stock
        quantity_type_enum item_quantity_type
    }

    CALCULATED_FULL_SS_AI_TEMP {
        varchar item_id PK_FK
        date date PK
        level_status_enum status PK "Level 0 - Level 9"
        decimal amount
        item_type_enum item_type
        quantity_type_enum item_quantity_type
        decimal formula_result
    }

    %%-------------------------------------------------------------------------
    %% 4. SİMÜLASYON TABLOLARI
    %%-------------------------------------------------------------------------

    SIP_HARITA_ACTIVE_INVENTORY {
        varchar item_id PK_FK
        decimal current_stock
    }

    SIM_ORDER_EFFECTS {
        serial id PK
        int order_id FK
        varchar item_id FK
        decimal amount_changed
        date due_date
        timestamp created_at
    }

    ORDER_MATERIAL_CONSUMPTION {
        serial id PK
        int order_id FK
        varchar item_id FK
        decimal amount
        date date
    }
```

---

## 📑 Tablo ve Sütun Açıklamaları

### 1. Ana Veri Tabloları (Master Data)

| Tablo | Açıklama | Önemli Notlar |
| :--- | :--- | :--- |
| **`item`** | Tüm stok kartlarının tanımlandığı ana tablodur. | `demand_avg` ve `demand_deviation` triggerlar ile sürekli güncel tutulur. |
| **`supplier_item`** | Malzeme-Tedarikçi ilişkisini tanımlar. | `calculated` alanı `true` ise sistem hesaplı leadtime kullanır, `false` ise elle girilen değer. |
| **`bom`** | Ürün reçetelerini (ağaç yapısı) tutar. | Parent-Child ilişkisi composite PK ile tanımlanır. |
| **`active_inventory`** | Depodaki anlık, fiziksel stok miktarını tutar. | `stock_movement` triggerı ile otomatik güncellenir. |

### 2. Hareket Tabloları (Transaction Data)

| Tablo | Açıklama | Önemli Notlar |
| :--- | :--- | :--- |
| **`purchase`** | Tedarikçilere verilen siparişlerdir. | `delay_day`, `status` sütunları `GENERATED ALWAYS` olarak otomatik hesaplanır. `delay_day = actual_coming_date - expected_coming_date`. |
| **`stock_movement`** | Depodaki tüm giriş/çıkış hareketleridir. | 4 amaç tipi: `giriş` (stok artırır), `çıkış` (stok düşürür), `üretime_giden` (stok düşürür), `satış_çıkışı` (stok düşürür + satış kaydı). |
| **`customer_orders`** | Müşterilerden alınan satış siparişleridir. | 4 durum: `Bekleniyor` → `Üretimde` → `Hazır` → `Sevk Edildi`. Sevk'te otomatik `satış_çıkışı` kaydı oluşur. |
| **`start_inventories`** | Her ay başında sistemin otomatik aldığı stok fotoğraflarıdır (Snapshot). | Trigger ile `stock_movement` INSERT'inde ay başı kaydı yoksa otomatik oluşturulur. |
| **`sales_out_history`** | Satış amacıyla çıkış yapılan stok hareketlerinin kopyasıdır. | Talep tahminlemede (Prophet) kullanılır. Trigger ile `satış_çıkışı` hareketinden otomatik oluşturulur. |

### 3. Analitik ve Yapay Zeka Tabloları

| Tablo | Açıklama | Akış |
| :--- | :--- | :--- |
| **`ss_kings_formula`** | Klasik istatistiksel yöntemle (King's Formula) hesaplanan güvenlik stoğu. | `result_king = z_score × √(LT × σ_d² + d² × σ_LT²)` — Bu bir **Generated Column**'dur. |
| **`prophet_table_temporary`** | Prophet tahmin taslağı (hesaplama sonrası). | Kullanıcı onaylayana kadar burada kalır. |
| **`prophet_table_history`** | Onaylanmış Prophet tahmin verisi. | `/forecast/approve` çağrıldığında temporary → history'ye kopyalanır. |
| **`ss_ai_temporary`** | LightGBM güvenlik stoğu taslağı. | Hesaplama sonrası geçici olarak burada tutulur. |
| **`ss_ai_history`** | Onaylanmış LightGBM güvenlik stoğu. | Onaylandığında temporary → history'ye taşınır. |
| **`calculated_full_ss_ai_temp`** | BOM patlatma sırasında her seviyedeki ihtiyacı hesaplayan çalışma tablosu. | `status` sütunu `Level 0` - `Level N` bilgisini taşır. `formula_result` sütunu King's Formula sonucunu içerir. |
| **`final_safety_stock`** | Tüm algoritmalar çalıştıktan sonra yöneticinin onayladığı nihai güvenlik stoğu. | Karşılaştırma ekranından AI/Formül/Manuel seçimi yapılarak buraya kaydedilir. |

### 4. Simülasyon Tabloları

| Tablo | Açıklama | Önemli Notlar |
| :--- | :--- | :--- |
| **`sip_harita_active_inventory`** | Sanal stok tablosu — "Ne olurdu?" senaryoları için. | Gerçek stoku bozmadan müşteri siparişlerinin etkisini simüle eder. `stock_movement` triggerı ile senkronize edilir. |
| **`sim_order_effects`** | Her müşteri siparişinin simülasyon stoğu üzerindeki etkisi. | Sipariş silindiğinde veya güncellendiğinde bu tablo üzerinden geri alma (reversal) yapılır. |
| **`order_material_consumption`** | Bir sipariş için üretime verilen malzeme kayıtları. | `üretime_giden` hareketi + `order_id` ile ilişkilendirildiğinde bu tabloya yazılır. Mükerrer hesabı engeller. |

---

## ⚡ Trigger Mekanizmaları (Detaylı)

Aşağıdaki tablo, sistemdeki tüm triggerları, hangi tabloda çalıştıklarını, ne zaman tetiklendiklerini ve ne yaptıklarını detaylı olarak açıklar.

### Stok Yönetimi Triggerları

| # | Trigger | Tetikleyen Tablo | Olay | Açıklama |
| :---: | :--- | :--- | :--- | :--- |
| 1 | **Stok Güncelleme** | `stock_movement` | INSERT / DELETE | **INSERT:** `giriş` → stok artar, diğer amaçlar → stok azalır. **DELETE:** Eski hareketin etkisi tersine çevrilir (giriş silindiyse stok düşer, çıkış silindiyse stok artar). |
| 2 | **Simülasyon Stok Senkronizasyonu** | `stock_movement` | INSERT / DELETE | Gerçek stok değiştiğinde `sip_harita_active_inventory` tablosu da aynı miktarda güncellenir. |
| 3 | **Satış Kaydı Otomasyonu** | `stock_movement` | INSERT / UPDATE / DELETE | `purpose = 'satış_çıkışı'` olan hareketler otomatik olarak `sales_out_history` tablosuna kopyalanır. UPDATE'de eski kayıt silinip yenisi eklenir. DELETE'de ilgili kayıt silinir. |
| 4 | **Aylık Stok Snapshot** | `stock_movement` | INSERT | Eğer hareketin tarihindeki ay başı için henüz `start_inventories` kaydı yoksa, o anki `current_stock` değeri snapshot olarak kaydedilir. |

### İstatistik ve Performans Triggerları

| # | Trigger | Tetikleyen Tablo | Olay | Açıklama |
| :---: | :--- | :--- | :--- | :--- |
| 5 | **Talep İstatistiği** | `sales_out_history` | INSERT / UPDATE / DELETE | `item` tablosundaki `demand_avg` ve `demand_deviation` değerleri, o ürünün tüm satış geçmişi üzerinden yeniden hesaplanır (ortalama ve standart sapma). |
| 6 | **Tedarikçi Performansı** | `purchase` | INSERT / UPDATE / DELETE | `supplier_item` tablosundaki `calculated_leadtime_avg` ve `calculated_leadtime_deviation`, o tedarikçinin tüm tamamlanmış siparişlerinin `delay_day` değerleri üzerinden yeniden hesaplanır. |
| 7 | **Risk Analizi (King's Formula)** | `supplier_item` | INSERT / UPDATE | `ss_kings_formula` tablosu güncellenir. `calculated = true` ise hesaplanan leadtime, değilse verilen leadtime kullanılır. `item` tablosundaki talep istatistikleri de dahil edilir. |

### Satın Alma Triggerları

| # | Trigger | Tetikleyen Tablo | Olay | Açıklama |
| :---: | :--- | :--- | :--- | :--- |
| 8 | **Sipariş Gelişi → Stok** | `purchase` | UPDATE | `actual_coming_date` NULL'dan bir tarihe değiştiğinde → `stock_movement` tablosuna `giriş` kaydı eklenir. Eğer önceden NULL değilken tekrar güncelleniyorsa, eski hareketin etkisi geri alınır. |
| 9 | **Satın Alma → Simülasyon** | `purchase` | INSERT / UPDATE / DELETE | Yeni sipariş verildiğinde simülasyon stoğuna beklenen miktar eklenir. Sipariş silindiğinde veya güncellendiğinde eski etki geri alınır. |

---

## 🔄 Trigger Geri Alma (Reversal) Mantığı

Sistemdeki triggerlar, **UPDATE ve DELETE** durumlarında eski verinin etkisini önce **GERİ ALIR**, sonra (UPDATE ise) yeni verinin etkisini uygular. Bu yaklaşım veri tutarlılığını garanti eder.

**Örnek — Stok Hareketi UPDATE:**
1. `OLD.purpose = 'giriş'` → Eski giriş geri alınır: `current_stock -= OLD.amount`
2. `OLD.purpose = 'çıkış'` → Eski çıkış geri alınır: `current_stock += OLD.amount`
3. Ardından `NEW` kaydın etkisi normal şekilde uygulanır.

Bu mantık **tüm** ilgili triggerlarda tutarlı olarak uygulanır:
- `active_inventory` ← stok hareketleri
- `sip_harita_active_inventory` ← stok hareketleri + satın alma
- `sales_out_history` ← satış çıkış hareketleri
- `item.demand_avg/deviation` ← satış geçmişi
- `supplier_item.calculated_leadtime` ← satın alma performansı
