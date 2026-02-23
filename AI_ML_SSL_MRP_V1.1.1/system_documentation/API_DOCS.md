# 📡 API Dokümantasyonu (MRP System V1.1)

Bu belge, sistemin Backend servisi (`http://localhost:8000`) üzerinden sunduğu RESTful API servislerini listeler.
Sistemdeki **tüm** aktif endpointler aşağıda gruplandırılarak detaylandırılmıştır.

---

## 🏗️ Veri Modelleri (Data Models)

İstek gövdelerinde (Request Body) kullanılan Pydantic şemaları:

| Model | Alanlar (Fields) | Validasyonlar |
| :--- | :--- | :--- |
| **ProductCreate** | `item_id`, `item_type`, `item_quantity_type`, `activity_status` | - |
| **ProductUpdate** | `item_type`, `item_quantity_type`, `activity_status` | Opsiyonel alanlar |
| **BomCreate** | `parent_id`, `child_id`, `amount`, `activity_status` | `amount > 0` |
| **BomUpdate** | `amount`, `activity_status` | `amount > 0`, Opsiyonel |
| **SupplierItemCreate** | `item_id`, `supplier_id`, `given_leadtime`, `lot_size`, `min_size`, `max_size`, `calculated`, `status` | `given_leadtime > 0`, diğerleri `>= 0` |
| **SupplierItemUpdate** | `given_leadtime`, `lot_size`, ... (Tüm alanlar opsiyonel) | - |
| **OrderCreate** | `item_id`, `supplier_id`, `amount`, `purpose`, `purchase_date`, `expected_coming_date` | `amount > 0` |
| **OrderUpdate** | `id`, `actual_coming_date` | Sipariş karşılama için kullanılır (Receive) |
| **OrderEdit** | `id`, `item_id`, `amount`, ... | Sipariş düzenleme için, opsiyonel alanlar |
| **StockMovementCreate** | `item_id`, `amount`, `purpose`, `date`, `order_id` (Opt) | `amount > 0` |
| **InventoryUpdate** | `item_id`, `amount` | `amount >= 0` (Sayım düzeltme) |
| **CustomerOrderCreate** | `customer_name`, `item_id`, `amount`, `order_date`, `expected_delivery_date`, `production_time_days`, `status` | - |
| **CustomerOrderUpdate** | `customer_name`, `amount`, `status`, ... | Opsiyonel |
| **ForecastUpdate** | `item_id`, `date`, `amount` | `amount >= 0` |
| **SalesRecordCreate** | `item_id`, `amount`, `date` | `amount > 0` |
| **ApprovalItem** | `item_id`, `date`, `amount`, `item_quantity_type` | Güvenlik stoğu onayı için |

---

## 🌍 0. Genel (General)

| Method | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/` | API Sağlık Kontrolü. "AI-Driven MRP System API is Running (Refactored)" döner. |

---

## 📦 1. Ürün Yönetimi (Products)

| Method | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/api/products` | Tüm ürünleri listeler. <br> **Query Params:** `page` (def: 1), `limit` (def: 50), `search`, `item_type`, `status` |
| `POST` | `/api/products` | Yeni bir stok kartı oluşturur. <br> **Body:** `ProductCreate` |
| `PUT` | `/api/products/{item_id}` | Ürün detaylarını günceller. <br> **Body:** `ProductUpdate` |
| `DELETE` | `/api/products/{item_id}` | Ürünü siler (Hard Delete). |

---

## 🧬 2. Ürün Reçeteleri (BOM)

| Method | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/api/bom` | Tüm BOM (Parent-Child) ilişkilerini listeler. Düz liste döner. |
| `POST` | `/api/bom` | Bir ürüne alt bileşen ekler. <br> **Body:** `BomCreate` |
| `PUT` | `/api/bom/{parent_id}/{child_id}` | Reçete miktarını veya durumunu günceller. <br> **Body:** `BomUpdate` |
| `DELETE` | `/api/bom/{parent_id}/{child_id}` | Reçete bileşenini siler (Hard Delete). |

---

## 🚚 3. Tedarikçi Yönetimi (Suppliers)

| Method | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/api/suppliers` | Malzeme-Tedarikçi ilişkilerini listeler. |
| `POST` | `/api/suppliers` | Bir malzemeye tedarikçi tanımlar. <br> **Body:** `SupplierItemCreate` |
| `PUT` | `/api/suppliers/update` | Tedarikçi parametrelerini günceller. <br> **Body:** `SupplierItemUpdate` |
| `DELETE` | `/api/suppliers/{item_id}/{supplier_id}` | İlişkiyi pasife çeker (Soft Delete). |

---

## 🏭 4. Stok ve Depo (Inventory)

| Method | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/api/inventory` | Anlık depo mevcudunu listeler (`active_inventory`). <br> **Query Params:** `page`, `limit`, `search` |
| `PUT` | `/api/inventory/update` | Stok miktarını manuel düzeltir (Sayım farkı vb.). <br> **Body:** `InventoryUpdate` |
| `GET` | `/api/stock-movements` | Tüm giriş/çıkış hareket geçmişini listeler. Limit 100 ile sınırlıdır. |
| `POST` | `/api/stock-movements` | Manuel stok hareketi (Giriş/Çıkış) ekler. <br> **Body:** `StockMovementCreate` |

---

## 🛒 5. Satın Alma (Purchase Orders)

| Method | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/api/orders` | Tedarikçilere verilen siparişleri listeler. |
| `POST` | `/api/orders` | Yeni satın alma siparişi oluşturur. <br> **Body:** `OrderCreate` |
| `PUT` | `/api/orders/receive` | **Kritik:** Siparişin depoya gelişini onaylar. Stok artışı tetikler. <br> **Body:** `OrderUpdate` (`id`, `actual_coming_date`) |
| `PUT` | `/api/orders/update` | Mevcut bir siparişin bilgilerini düzenler. <br> **Body:** `OrderEdit` |
| `DELETE` | `/api/orders/{id}` | Siparişi iptal eder (Hard Delete). |

---

## 👥 6. Müşteri Siparişleri (Customer Orders)

| Method | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/api/customer-orders` | Müşteri siparişlerini listeler. Simülasyon verileri ile zenginleştirilmiştir (`shortage_items` vb.). |
| `POST` | `/api/customer-orders` | Sipariş oluşturur ve **Simülasyonu Tetikler**. <br> **Body:** `CustomerOrderCreate` |
| `PUT` | `/api/customer-orders/{id}` | Sipariş durumunu veya miktarını günceller. <br> **Body:** `CustomerOrderUpdate` |
| `DELETE` | `/api/customer-orders/{id}` | Siparişi siler ve simülasyon etkilerini geri alır. |

---

## 📈 7. Talep Tahmini (Demand Forecast)

| Method | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `POST` | `/api/forecast/calculate` | Gelecek dönem (Prophet) talep tahminini çalıştırır. (Gelecek yılın 12 ayı) |
| `GET` | `/api/forecast/temporary` | Tahmin sonuçlarını (`prophet_table_temporary`) çeker. |
| `PUT` | `/api/forecast/update` | AI tahminini manuel olarak (elle) düzeltir. <br> **Body:** `ForecastUpdate` |
| `POST` | `/api/forecast/approve` | Tahmin sonuçlarını onaylar ve `history` tablosuna aktarır. |

---

## 🤖 8. Güvenlik Stoğu AI (Safety Stock)

| Method | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/api/safety-stock` | Kesinleşmiş güvenlik stoğu raporunu (`final_safety_stock`) çeker. Stok farkını da hesaplar. |
| `GET` | `/api/safety-stock/temporary` | AI (LightGBM) ve Formül (King's) sonuçlarını karşılaştırmalı olarak çeker. |
| `POST` | `/api/safety-stock/calculate` | **Tetikleyici:** Prophet ve LightGBM modellerini çalıştırır, BOM patlatır ve öneri üretir. |
| `POST` | `/api/safety-stock/approve` | Kullanıcının seçtiği AI önerilerini onaylar. <br> **Body:** `List[ApprovalItem]` |

---

## 📊 9. Satış Yönetimi (Sales - Manual)

*Not: `satış_çıkışı` tipindeki stok hareketleri otomatik olarak buraya işlenir. Bu endpointler manuel düzeltmeler içindir.*

| Method | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/api/sales` | Satış kayıtlarını (`sales_out_history`) listeler. |
| `POST` | `/api/sales` | Yeni satış kaydı oluşturur. <br> **Body:** `SalesRecordCreate` |
| `PUT` | `/api/sales/{id}` | Satışı günceller. <br> **Body:** `SalesRecordUpdate` |
| `DELETE` | `/api/sales/{id}` | Satışı siler. |

---

## 🎮 10. Simülasyon (Simulation)

| Method | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/api/simulation/suggestions` | Mevcut siparişleri yetiştirmek için gereken eksik hammadde listesini (`sim_manager.get_missing_suppliers` dahil) döner. |
| `POST` | `/api/simulation/reset` | Simülasyon stoklarını gerçek stoklarla senkronize eder (Sıfırlar). Tüm siparişler yeniden simüle edilir. |
