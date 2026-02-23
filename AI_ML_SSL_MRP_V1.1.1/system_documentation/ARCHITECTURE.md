# 🏛️ Sistem Mimarisi ve Teknik Derinlik (System Architecture)

## 1. Giriş
**AI-ML SSL MRP**, yapay zeka destekli, dinamik bir Malzeme İhtiyaç Planlama (MRP) sistemidir. Klasik MRP'nin "statik stok seviyesi" mantığını reddeder ve bunun yerine **geleceği tahmin eden** ve **riski hesaplayan** bir yapı sunar.

## 2. Teknoloji Yığını (Tech Stack)

### 🖥️ Frontend (Kullanıcı Arayüzü)
*   **Core:** React 18 (Vite Build Tool ile)
*   **State Management:** React Hooks (`useState`, `useContext`, `useReducer`)
*   **UI Library:** TailwindCSS (Utility-first styling) & Lucide React Icons
*   **Data Fetching:** Axios (Interceptor yapısı ile)
*   **Routing:** React Router DOM v6

### ⚙️ Backend (Core Logic)
*   **Framework:** FastAPI (Asenkron, yüksek performanslı Python framework)
*   **Data Operations:** Pandas & NumPy (Vektörel veri işleme)
*   **Concurrency:** Thread-Local Storage (Simülasyon izolasyonu için)
*   **Validation:** Pydantic (Strict typing)

### 🧠 Yapay Zeka ve Analitik (AI Engine)
*   **Talep Tahmini (Demand Forecasting):** Facebook Prophet
    *   *Neden?* Mevsimsellik, tatiller ve trend değişimlerini yakalamak için.
*   **Güvenlik Stoğu Optimizasyonu:** LightGBM (Gradient Boosting Machine)
    *   *Neden?* Tedarikçi gecikmelerini ve talep sapmalarını (nonlinear ilişkileri) modellemek için.

### 🗄️ Veritabanı
*   **DB:** PostgreSQL 14+
*   **Advanced Features:**
    *   `PL/pgSQL` Triggerlar (Otomatik stok düşüşü, istatistik hesaplama)
    *   `ENUM` Types (Veri bütünlüğü için strict tipler)
    *   `GENERATED COLUMNS` (Otomatik hesaplanan alanlar, örn: King's Formula sonucu)

---

## 3. Kritik Mühendislik Çözümleri

### 🔄 Recursive BOM Explosion (Özyinelemeli Reçete Patlatma)
Sipariş simülasyonunda, bir ürünün üretilmesi için gereken alt parçaları bulmak gerekir. Bu sistemde BOM yapısı **Sınırsız Derinlikte** olabilir.
*   **Algoritma:** Depth-First Search (DFS) tabanlı recursive patlatma.
*   **Optimizasyon:** `sim_bom_explosion.py` içinde her bir sipariş için özel `_thread_local` storage kullanılır. Bu sayede aynı anda birden fazla sipariş işlense bile (multi-threaded server) veriler birbirine karışmaz.

### 🧵 Thread-Local Simulation Context
Simülasyon sırasında her siparişin "sanal tüketimi" takip edilmelidir.
*   FastAPI async çalıştığı için global değişken kullanılamaz.
*   Çözüm: `threading.local()` kullanılarak her request/simülasyon adımına özel bir `_missing_suppliers` ve `_current_order_id` bağlamı yaratılır.
*   Böylece, `sim_manager.py` içindeki `process_demand` fonksiyonu, veritabanına gitmeden bellekteki bu context üzerinden hızlıca eksik tedarikçileri toplar.

### ⚡ Trigger-Based Consistency (Trigger Tabanlı Tutarlılık)
Veri tutarlılığı uygulama katmanına (Python) bırakılmamıştır, veritabanı katmanında (SQL) garanti altına alınmıştır.
*   **Reversal Logic:** Bir stok hareketi silindiğinde veya güncellendiğinde, trigger önce **eski işlemin etkisini geri alır**, sonra **yeni işlemi uygular**.
    *   Örn: "Giriş" silinirse stok düşer. "Çıkış" silinirse stok artar.
*   **Analitik Senkronizasyonu:** Satın alma yapıldığında tedarikçi performansı (`supplier_item`) otomatik güncellenir.

---

## 4. AI Pipeline Akışı

Sistemdeki yapay zeka akışı 3 adımdan oluşur:

1.  **Veri Hazırlığı (Data Prep):**
    *   `sales_out_history` tablosundan geçmiş satış verileri çekilir.
    *   `orders` tablosundan tedarikçi gecikme verileri (`delay_day`) çekilir.

2.  **Tahminleme (Forecasting - Prophet):**
    *   Her ürün için ayrı bir Prophet modeli eğitilir.
    *   Gelecek 12 ayın talebi tahmin edilir (`prophet.run_full_analysis`).
    *   Sonuçlar `prophet_table_temporary` tablosuna yazılır.

3.  **Optimizasyon (Optimization - LightGBM):**
    *   Tedarikçi riski (Lead Time deviation) ve Talep belirsizliği (Demand deviation) input olarak alınır.
    *   Model, "Servis Seviyesi" hedefine (örn: %95) ulaşmak için gereken optimum stoku tahmin eder.
    *   Sonuçlar `ss_ai_temporary` tablosuna yazılır.

---

## 5. Klasör Yapısı (Directory Structure)

```
.
├── backend/
│   ├── AI_ML/             # Prophet ve LightGBM model eğitim/tahmin kodları
│   ├── crud/              # Veritabanı işlemleri (Transaction management)
│   ├── database/          # DB bağlantısı, şema kurulumu (setup.py)
│   ├── simulation/        # Simülasyon motoru (BOM patlatma, thread-local logic)
│   ├── config.py          # Env değişkenleri
│   ├── logger.py          # Merkezi loglama
│   └── main.py            # API Gateway (FastAPI)
│
├── frontend/
│   ├── src/
│   │   ├── components/    # Reusable UI bileşenleri
│   │   ├── hooks/         # Custom Hooks (useInfiniteScroll vb.)
│   │   ├── pages/         # Sayfa bileşenleri
│   │   └── api.js         # Axios instance
│
└── system_documentation/  # Proje teknik dokümanları
```
