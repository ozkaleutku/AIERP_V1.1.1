# OptiStock AI - Modüler ERP & Yapay Zeka Ekosistemi: Master Vizyon ve Mimari Rehberi

Bu doküman, sistemin mevcut teknik altyapısını, tamamen yenilenmiş modüler mimarisini, halihazırda çalışan yapay zeka (AI/ML) modellerini ve gelecekte eklenecek yetenekleri kapsayan **tek ve en kapsamlı vizyon kütüğüdür.** 

Sistemimiz sıradan bir veri kayıt aracı (System of Record) olmaktan çıkıp, otonom kararlar alabilen bir yapay zeka beynine (System of Intelligence) dönüştürülmüştür.

---

## 🏗️ BÖLÜM 1: Mevcut Sistem, Modüler Mimari ve Sayfalar (Neredeyiz?)

Sistem, birbirine entegre çalışan ancak ticari olarak ayrı ayrı da satılabilen (microservice uyumlu) 6 ana modülden ve ortak (shared) bir yapıdan oluşmaktadır.

### 1. Envanter & Stok Yönetimi Modülü (`inventory`)
*   **İçerik:** `Inventory.jsx`, `StockMovement.jsx`
*   **İşlev:** Depo giriş-çıkış hareketleri, lokasyon bazlı aktif stok takibi.
*   **AI Gelecek Vizyonu:** Stoktaki binlerce ürünü devir hızı ve marja göre otomatik sınıflandırma (Akıllı ABC Analizi), stokta yaklaşan tükenme durumlarını trendlere göre önceden haber verme.

### 2. Tedarikçi & Satın Alma Yönetimi Modülü (`procurement`)
*   **İçerik:** `Suppliers.jsx`, `Orders.jsx`, `MissingSupplierPopup`
*   **İşlev:** Tedarikçi veritabanı yönetimi, B2B sipariş oluşturma, satın alma süreçleri. Stok modülüyle tam entegre çalışarak gelen siparişleri anında envantere işler.
*   **AI Gelecek Vizyonu:** Tedarikçi geçmiş teslimat performans verilerini analiz ederek "Gecikme Riski Puanı" oluşturma ve gelen teklifleri otomatik karşılaştırma.

### 3. Satış ve Müşteri Siparişleri Modülü (`sales`)
*   **İçerik:** `CustomerOrders.jsx`, `SalesHistory.jsx`
*   **İşlev:** Gelen müşteri siparişlerinin takibi, sevkiyat işlemleri ve tarihsel satış kayıtları.
*   **Entegrasyon:** Sipariş alındığında simülasyon (BOM algoritmaları) modülüne doğrudan bağlanarak ürün üretilebilirliğini test eder, sevkiyatta stokları otomatik düşer.

### 4. Temel Kurulum ve Reçete (BOM) Yönetimi Modülü (`core`)
*   **İçerik:** `Products.jsx`, `Bom.jsx`
*   **İşlev:** Ürün kartı tanımları, çok seviyeli ürün ağaçları (Bill of Materials) ve genel sistem ayarları. Maliyet hesaplamaları bu reçete yapısıyla desteklenir.
*   **AI Gelecek Vizyonu:** Hammadde yokluğunda veya aşırı fiyat artışında en uygun "Alternatif Reçete" senaryolarının saniyeler içinde simüle edilerek uygun içerik önerilmesi.

### 5. AI Tahminleme & Emniyet Stoğu Modülü (`forecasting`)
*Sistemin anlık karar destek beynidir.*
*   **İçerik:** `DemandForecast.jsx`, `SafetyStock.jsx`, `SafetyStockComparison.jsx` + İleri Düzey Grafikler
*   **İşlev:**
    *   **Talep Tahminleme (Prophet):** Meta'nın The Prophet algoritması kullanılarak mevsimsellik eğilimleri ve tarihsel veriler ışığında aylık/yıllık talep projeksiyonu yapılır. Stoksuzluk veya atıl stok durumunu çift yönlü korur.
    *   **Akıllı Emniyet Stoğu (LightGBM):** `LightGBM Quantile Regression` (alpha=0.85 vb.) kullanılarak; sadece tüketim ortalamaları değil, talep belirsizliği riski ve tedarik süresi sapmaları hesaplanır. Klasik formüller (Örn: King's formülü) makine öğrenmesi yaklaşımları ile alt edilir.

### 6. Gelecek Sipariş Simülasyonu (Order Map) Modülü (`simulation`)
*   **İçerik:** `OrderMap.jsx`
*   **İşlev:** Mevcut müşteri siparişleri, tahmin edilen üretim ihtiyaçları ve emniyet stoğu eksikleri için devasa bir "BOM Patlatma (Explosion)" çalıştırılır. Planlama ekibinin haftalarca uğraştığı "Önümüzdeki ay ne satın almalıyız?" hesaplaması "Sipariş Haritası" üzerinde otomatik olarak kullanıcıya sunulur.

---

## 🚀 BÖLÜM 2: Gelecek Modüller ve Ekosistemin Genişleme Vizyonu (Nereye Gidiyoruz?)

Bu altı modüllük çekirdeğin etrafına zamanla eklenecek yeni "satılabilir" kapasiteler şunlardır:

### 7. Finans, Akıllı Muhasebe ve Karar Destek
Parayı sadece takip eden değil, nakit akışını yapay zeka ile yöneten bir CFO modülü.
*   **AI Çözümleri:** 
    *   **RNN ile Nakit Akış Tahmini:** Gelecek 6 aydaki beklenen ödemeler ve tahsilatları simüle ederek nakit açığı tehlikesini bildirir.
    *   **Anomali Tespiti (Unsupervised):** Normalin dışında, standart şablonlara uymayan yüksek hammadde alım faturalarını veya şüpheli hareketleri tespit edip onay sürecini durdurur.

### 8. Üretim Yönetimi (MES+) ve Çizelgeleme
Üretim katının dijital ikizi. Kapasite, operatör, makine performans üçgeni.
*   **AI Çözümleri:** 
    *   **Hibrid Optimizasyon Algoritmaları (MILP + Genetik):** Binlerce iş emrini, makine kapasitesini ve personel yetkinliğini gözeterek saniyeler içinde en kısa teslimatı yapacak sıraya sokar.
    *   **Computer Vision (CNN) Kalite Kontrol:** Kamera yardımıyla üretim bandındaki milimetrik çizikleri ve kalite hatalarını anında tespit eder.
    *   **Kestirimci Bakım (Predictive Maintenance):** IoT cihazlardan alınan ses ve ısı verileriyle bir motorun / makinenin ne zaman duracağını arızadan günler önce haber verir.

### 9. CRM ve Akıllı Satış Yönetimi
Eski usul "Müşteri defteri" yaklaşımını, davranış analizine çeviren satış hunisi.
*   **AI Çözümleri:** 
    *   **Lead Scoring (Potansiyel Puanlama):** Verilen bir teklifin (teklif içeriği ve pazar verisiyle) satışa dönüşme oranını tahmin eder.
    *   **Davranışsal Churn Tahmini:** Sipariş aralıkları seyrekleşen veya mail yazışmalarında tonu değişen müşterinin firmayı "Terk Etme Riski"ni hesaplar.

### 10. İK ve Akıllı Vardiya / Lojistik Ağ Tasarımı
*   **AI Çözümleri:** 
    *   **Vardiya Optimizasyonu (Constraint-Based):** Yasal kurallar, çalışan tercihleri ve verim istatistiklerini hesaplayarak optimum vardiya planı çıkarır.
    *   **Pekiştirmeli Öğrenme ile Lojistik:** Dağıtım/Sevkiyat rotalarının anlık trafik, teslimat pencereleri ve benzin maliyeti ekseninde saniye saniye RL algoritmaları ile optimize edilmesi.

---

## 🧠 BÖLÜM 3: Genel Sistem Zekası ve Deneyim (Genel AI Kapsayıcısı)

Tüm modüllerin tepesinde bir orkestra şefi gibi çalışan merkezi yapı:
*   **AI Yönetici Özeti (Daily Brief):** Günün başında sistemi tarayarak, "Bugün dikkat etmeniz gereken 3 risk (hammadde gecikmesi) ve 2 fırsat (kur düşüşü / indirim)" sunan kişisel kokpit.
*   **RAG Tabanlı İş Zekası (LLM Analyst):** SQL sorgusu yazmak veya karmaşık menülere girmek yerine doğal dille: *"Geçen ay kar marjımız neden %3 düştü?"* diye sorulduğunda; *"Kar düşüşünün %70'i plastik hammadde zammından, %30'u makine 4 arızasından kaynaklandı"* diyen metinsel rapor mekanizması.

---

> [!TIP]
> **Ticari ve Satış Stratejisi Özeti:** Sistem baştan aşağı "Microservice / API Router" mantığıyla bölünmüştür. Müşteriye tam paket ERP satılabileceği gibi; eğer kişinin zaten bir muhasebe yazılımı varsa sadece "Tahminleme" (Forecasting) ve "Akıllı Planlama" modülleri de API ile mevcut sistemine entegre edilerek satılabilir. Bu modülerlik piyasadaki kapı açma hızını eksponansiyel şekilde artırır.
