# 📡 API Dokümantasyonu (MRP System V1.1)

Bu belge, sistemin Backend servisi (`http://localhost:8000`) üzerinden sunduğu RESTful API servislerini listeler.
Sistemdeki **tüm** aktif endpointler (toplam 41 adet) aşağıda detaylandırılmıştır.

---

## 🏗️ Veri Modelleri (Data Models)

İstek gövdelerinde (Request Body) kullanılan temel şemalar:

| Model | Açıklama |
| :--- | :--- |
| **ProductCreate** | `{ item_id, item_type, item_quantity_type, activity_status }` |
| **BomCreate** | `{ parent_id, child_id, amount, activity_status }` |
| **SupplierItemCreate** | `{ item_id, supplier_id, given_leadtime, lot_size, ... }` |
| **OrderCreate** | `{ item_id, supplier_id, amount, purpose, purchase_date, expected_coming_date }` |
| **OrderEdit** | `{ id, item_id, supplier_id, amount, purpose, purchase_date, ... }` |
| **StockMovementCreate** | `{ item_id, amount, purpose, date }` |
| **CustomerOrderCreate** | `{ customer_name, item_id, amount, order_date, expected_delivery_date, status }` |
| **SalesRecordCreate** | `{ item_id, amount, date }` |
| **ForecastUpdate** | `{ item_id, date, amount }` |

---

## 🌍 0. Genel (General)

| Method | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/` | API Sağlık Kontrolü. "API is Running" döner. |

---

## 📦 1. Ürün Yönetimi (Products)

| Method | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/api/products` | Tüm ürünleri listeler. Parametreler: `page`, `limit`, `search`, `item_type`. |
| `POST` | `/api/products` | Yeni bir stok kartı oluşturur. |
| `PUT` | `/api/products/{item_id}` | Ürün detaylarını günceller (Örn: Pasife çekme). |
| `DELETE` | `/api/products/{item_id}` | Ürünü siler. |

---

## 🧬 2. Ürün Reçeteleri (BOM)

| Method | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/api/bom` | Tüm BOM (Parent-Child) ilişkilerini listeler. |
| `POST` | `/api/bom` | Bir ürüne alt bileşen ekler. |
| `PUT` | `/api/bom/{p_id}/{c_id}` | Reçete miktarını günceller. |
| `DELETE` | `/api/bom/{p_id}/{c_id}` | Reçete bileşenini siler. |

---

## 🚚 3. Tedarikçi Yönetimi (Suppliers)

| Method | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/api/suppliers` | Hangi malzemenin hangi tedarikçiden alındığını listeler. |
| `POST` | `/api/suppliers` | Bir malzemeye tedarikçi tanımlar (Lead Time verisi ile). |
| `PUT` | `/api/suppliers/update` | Tedarikçi parametrelerini (Lead Time, Lot Size) günceller. |

---

## 🏭 4. Stok ve Depo (Inventory)

| Method | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/api/inventory` | Anlık depo mevcudunu listeler (`active_inventory`). |
| `PUT` | `/api/inventory/update` | Stok miktarını manuel düzeltir (Sayım farkı vb.). |
| `GET` | `/api/stock-movements` | Tüm giriş/çıkış hareket geçmişini listeler. |
| `POST` | `/api/stock-movements` | Manuel stok hareketi (Giriş/Çıkış) ekler. |

---

## 🛒 5. Satın Alma (Purchase Orders)

| Method | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/api/orders` | Tedarikçilere verilen siparişleri listeler. |
| `POST` | `/api/orders` | Yeni satın alma siparişi oluşturur. |
| `PUT` | `/api/orders/receive` | **Kritik:** Siparişin depoya gelişini onaylar (`actual_coming_date`). Gecikme hesaplanır. |
| `PUT` | `/api/orders/update` | Mevcut bir siparişin bilgilerini (Tarih, Miktar) düzenler. |
| `DELETE` | `/api/orders/{id}` | Siparişi iptal eder. |

---

## 👥 6. Müşteri Siparişleri (Customer Orders)

| Method | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/api/customer-orders` | Müşteri siparişlerini listeler. |
| `POST` | `/api/customer-orders` | Sipariş oluşturur ve **Simülasyonu Tetikler**. Eksik malzemeyi hesaplar. |
| `PUT` | `/api/customer-orders/{id}` | Sipariş durumunu günceller (`Sevk Edildi` olunca stoktan düşer). |
| `DELETE` | `/api/customer-orders/{id}` | Siparişi siler ve simülasyon etkilerini geri alır. |

---

## 📈 7. Talep Tahmini (Demand Forecast)

| Method | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `POST` | `/api/forecast/calculate` | Gelecek dönem (Prophet) talep tahminini çalıştırır. |
| `GET` | `/api/forecast/temporary` | Tahmin sonuçlarını grafik için çeker. |
| `PUT` | `/api/forecast/update` | AI tahminini manuel olarak (elle) düzeltir. |
| `POST` | `/api/forecast/approve` | Tahmin sonuçlarını onaylar ve geçmiş kayıtlara işler. |

---

## 🤖 8. Güvenlik Stoğu AI (Safety Stock)

| Method | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/api/safety-stock` | Kesinleşmiş güvenlik stoğu raporunu çeker. |
| `GET` | `/api/safety-stock/temporary` | AI tarafından hesaplanan ama henüz onaylanmamış taslak önerileri çeker. |
| `POST` | `/api/safety-stock/calculate` | **Tetikleyici:** Prophet ve LightGBM modellerini çalıştırır, BOM patlatır ve öneri üretir. |
| `POST` | `/api/safety-stock/approve` | Kullanıcının seçtiği AI önerilerini onaylar ve sisteme işler. |

---

## 📊 9. Satış Yönetimi (Sales - Manual)

*Otomatik sistemde satışlar stok hareketinden düşer. Burası manuel müdahale içindir.*

| Method | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/api/sales` | Satış kayıtlarını listeler. |
| `POST` | `/api/sales` | Yeni satış kaydı oluşturur. |
| `PUT` | `/api/sales/{id}` | Satışı günceller. |
| `DELETE` | `/api/sales/{id}` | Satışı siler. |

---

## 🎮 10. Simülasyon (Simulation)

| Method | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/api/simulation/suggestions` | Mevcut siparişleri yetiştirmek için gereken eksik hammadde listesini döner. |
| `POST` | `/api/simulation/reset` | Simülasyon stoklarını gerçek stoklarla senkronize eder (Sıfırlar). |
