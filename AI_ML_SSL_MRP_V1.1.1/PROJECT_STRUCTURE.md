# OptiStock AI — Proje Yapısı (Görev Bazlı)

Her `.py` dosyası tek bir görevi temsil eder. Dosya adına bakarak ne yaptığını anlarsın.

---

## BACKEND

```
backend/
├── main.py                                    # FastAPI uygulama + Router kayıtları
├── config.py                                  # Veritabanı konfigürasyonu
├── logger.py                                  # Loglama
│
├── shared/
│   └── utils/
│       ├── validations.py                     # Ortak doğrulama kuralları
│       └── error_handler.py                   # Merkezi hata yönetimi (handle_db_error)
│
├── database/
│   ├── db_helper.py                           # DB bağlantı ve sorgu yardımcıları
│   └── database_setup.py                      # Tablo oluşturma
│
└── modules/
    │
    ├── core/                                  # Ana Veri Modülü
    │   ├── products/                          # 🏭 Ürün Yönetimi
    │   │   ├── product_routes.py              #   API: GET/POST/PUT /api/products
    │   │   ├── product_schemas.py             #   Veri modelleri: ProductCreate, ProductUpdate
    │   │   ├── product_crud.py                #   CRUD: oluştur, ara, güncelle, sil
    │   │   └── product_status_cascade.py      #   İş mantığı: ürün pasif olunca BOM güncelle
    │   │
    │   ├── bom/                               # 📋 Reçete (BOM) Yönetimi
    │   │   ├── bom_routes.py                  #   API: GET/POST/PUT/DELETE /api/bom
    │   │   ├── bom_schemas.py                 #   Veri modelleri: BomCreate, BomUpdate
    │   │   ├── bom_crud.py                    #   CRUD: ekle, ara, güncelle, sil
    │   │   └── bom_circular_check.py          #   İş mantığı: döngüsel bağımlılık kontrolü
    │   │
    │   ├── bom_explosion/                     # 💥 BOM Patlatma Motoru
    │   │   └── bom_explosion_engine.py        #   Algoritma: reçeteyi seviye seviye patlatma
    │   │
    │   ├── cost_calculation/                  # 💰 Maliyet Hesaplama
    │   │   └── cost_calculator.py             #   Algoritma: bottom-up BOM maliyet hesaplama
    │   │
    │   └── price_analytics/                   # 📈 Fiyat Analizi
    │       ├── price_analytics_routes.py      #   API: /api/products/{id}/price-history, /details
    │       └── price_history_builder.py       #   İş mantığı: 3 kaynaktan fiyat geçmişi oluşturma
    │
    ├── inventory/                             # Depo & Stok Modülü
    │   ├── stock/                             # 📦 Envanter Durumu
    │   │   ├── inventory_routes.py            #   API: GET/PUT /api/inventory, GET /api/locations
    │   │   ├── inventory_schemas.py           #   Veri modelleri: InventoryUpdate, LocationResponse
    │   │   ├── inventory_query.py             #   Sorgu: envanter listele, mevcut stok getir
    │   │   └── inventory_update.py            #   Güncelleme: stok miktarı düzelt
    │   │
    │   ├── movements/                         # 🔄 Stok Hareketleri
    │   │   ├── movement_routes.py             #   API: GET/POST /api/stock-movements
    │   │   ├── movement_schemas.py            #   Veri modelleri: StockMovementCreate
    │   │   ├── movement_creator.py            #   İş mantığı: hareket oluştur (giriş/çıkış/üretim)
    │   │   ├── movement_query.py              #   Sorgu: hareketleri filtrele
    │   │   ├── movement_completer.py          #   Güncelleme: hareketi tamamlandı olarak işaretle
    │   │   └── tracking_code_generator.py     #   Yardımcı: SiparişNo-Ürün-Sıra kodu üret
    │   │
    │   └── sales_records/                     # 📊 Satış Kayıtları
    │       ├── sales_record_routes.py         #   API: GET/POST/PUT/DELETE /api/sales
    │       ├── sales_record_schemas.py        #   Veri modelleri: SalesRecordCreate, SalesRecordUpdate
    │       ├── sales_record_crud.py           #   CRUD: satış kaydı ekle, güncelle, sil
    │       └── sales_history_query.py         #   Sorgu: tüm satış geçmişi (müşteri+sipariş bilgili)
    │
    ├── procurement/                           # Tedarik Modülü
    │   ├── suppliers/                         # 🤝 Tedarikçi Yönetimi
    │   │   ├── supplier_routes.py             #   API: GET/POST/PUT/DELETE /api/suppliers
    │   │   ├── supplier_schemas.py            #   Veri modelleri: SupplierItemCreate/Update
    │   │   ├── supplier_crud.py               #   CRUD: ekle, ara, güncelle, sil
    │   │   └── missing_supplier_finder.py     #   Sorgu: tedarikçisiz ürünleri bul
    │   │
    │   └── purchase_orders/                   # 🛒 Satın Alma Siparişleri
    │       ├── purchase_routes.py             #   API: GET/POST/PUT/DELETE /api/orders
    │       ├── purchase_schemas.py            #   Veri modelleri: OrderCreate/Update/Edit
    │       ├── purchase_crud.py               #   CRUD: sipariş oluştur, güncelle, sil
    │       └── purchase_receiver.py           #   İş mantığı: sipariş teslim al + stok giriş
    │
    ├── sales/                                 # Satış Modülü
    │   └── customer_orders/                   # 📬 Müşteri Siparişleri
    │       ├── customer_order_routes.py        #   API: GET/POST/PUT/DELETE /api/customer-orders
    │       ├── customer_order_schemas.py       #   Veri modelleri: Create/Update/Response
    │       ├── customer_order_crud.py          #   CRUD: listele, sil
    │       ├── customer_order_creator.py       #   İş mantığı: sipariş oluştur + BOM simülasyon
    │       └── customer_order_updater.py       #   İş mantığı: güncelle + simülasyon tekrar çalıştır
    │
    ├── forecasting/                           # Tahmin & AI Modülü
    │   ├── demand_forecast/                   # 🔮 Talep Tahmini
    │   │   ├── forecast_routes.py             #   API: GET/PUT/POST /api/forecast/*
    │   │   ├── forecast_schemas.py            #   Veri modelleri: ForecastUpdate, ApprovalItem
    │   │   ├── forecast_query.py              #   Sorgu: tahmin verileri getir, detay getir
    │   │   ├── forecast_updater.py            #   Güncelleme: tahmin değeri düzelt
    │   │   ├── forecast_approver.py           #   İş mantığı: geçici → history onaylama
    │   │   └── prophet_ai_engine.py           #   AI: Prophet model eğitim + tahmin
    │   │
    │   └── safety_stock/                      # 🛡️ Emniyet Stoğu
    │       ├── safety_stock_routes.py         #   API: GET/POST /api/safety-stock/*
    │       ├── safety_stock_schemas.py        #   Veri modelleri: ApprovalItem
    │       ├── safety_stock_query.py          #   Sorgu: temp, kings, active, final, detail
    │       ├── safety_stock_approver.py       #   İş mantığı: onaylama
    │       ├── safety_stock_calculator.py     #   Orkestrasyon: 5 adımlı hesaplama akışı
    │       ├── historical_consumption_builder.py  # Algoritma: geçmiş tüketim BOM patlatma
    │       └── lightgbm_ai_engine.py          #   AI: LightGBM model eğitim + tahmin
    │
    └── simulation/                            # Simülasyon Modülü
        └── order_map/                         # 🗺️ Sipariş Haritası (MRP)
            ├── order_map_routes.py            #   API: GET/POST /api/simulation/*
            ├── simulation_initializer.py      #   İş mantığı: simülasyon sıfırla + replay
            ├── suggestion_generator.py        #   İş mantığı: sipariş önerisi oluştur
            ├── demand_processor.py            #   Algoritma: recursive BOM patlatma + stok düşme
            ├── sim_stock_manager.py           #   Yardımcı: simülasyon stok kontrol/güncelle
            ├── order_effect_tracker.py        #   Yardımcı: sipariş etkisi takip/geri al
            └── sim_supplier_checker.py        #   Yardımcı: tedarikçi varlık kontrolü
```

---

## FRONTEND

```
frontend/src/
├── App.jsx                                    # Route tanımları
├── api.js                                     # API base URL
├── main.jsx                                   # React entry point
│
├── shared/
│   ├── components/
│   │   ├── ConfirmModal.jsx                   # Onay popup
│   │   └── layout/                            # Sayfa yerleşimi
│   ├── hooks/
│   │   └── useInfiniteScroll.js               # Sonsuz kaydırma
│   ├── pages/
│   │   └── Home.jsx                           # Ana sayfa
│   └── utils/
│       └── stringUtils.js                     # Metin yardımcıları
│
└── modules/
    ├── core/
    │   ├── products/
    │   │   └── ProductsPage.jsx               # 🏭 Ürün Yönetimi Sayfası
    │   └── bom/
    │       └── BomPage.jsx                    # 📋 Reçete Sayfası
    │
    ├── inventory/
    │   ├── stock/
    │   │   └── InventoryPage.jsx              # 📦 Envanter Sayfası
    │   ├── movements/
    │   │   └── StockMovementPage.jsx          # 🔄 Stok Hareketleri Sayfası
    │   └── sales_records/
    │       └── SalesHistoryPage.jsx           # 📊 Satış Geçmişi Sayfası
    │
    ├── procurement/
    │   ├── suppliers/
    │   │   ├── SuppliersPage.jsx              # 🤝 Tedarikçi Sayfası
    │   │   └── components/
    │   │       └── MissingSupplierPopup.jsx   # Eksik tedarikçi popup
    │   └── purchase_orders/
    │       └── OrdersPage.jsx                 # 🛒 Satın Alma Sayfası
    │
    ├── sales/
    │   └── customer_orders/
    │       └── CustomerOrdersPage.jsx         # 📬 Müşteri Siparişleri Sayfası
    │
    ├── forecasting/
    │   ├── demand_forecast/
    │   │   ├── DemandForecastPage.jsx         # 🔮 Talep Tahmini Sayfası
    │   │   └── components/
    │   │       └── ForecastDetailChart.jsx    # Tahmin detay grafiği
    │   └── safety_stock/
    │       ├── SafetyStockPage.jsx            # 🛡️ Emniyet Stoğu Sayfası
    │       ├── ComparisonPage.jsx             # Karşılaştırma Sayfası
    │       └── components/
    │           └── SafetyStockDetailChart.jsx # Emniyet stoğu detay grafiği
    │
    └── simulation/
        └── order_map/
            └── OrderMapPage.jsx               # 🗺️ Sipariş Haritası Sayfası
```
