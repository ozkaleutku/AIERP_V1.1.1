# 📈 Tahminleme Kullanım Kılavuzu

**Dosya:** `DemandForecast.jsx`
**Erişim:** `/demand-forecast`

1.  **Genel Bakış**
    *   **Facebook Prophet** algoritmasını kullanarak, geçmiş satış verilerinden geleceği tahmin eder.
    *   Mevsimsellik (Yazın artan dondurma satışı gibi) ve Trend (Yıllık büyüme) faktörlerini dikkate alır.

2.  **Kullanım Adımları**

    **A. Tahmin Çalıştırma**
    1.  `Tahmini Hesapla` butonuna basın.
    2.  Sistem yaklaşık 5-10 saniye boyunca son verileri analiz eder.
    3.  Ekrana önümüzdeki 3-6 ayın tahmini satış grafiği gelir.

    **B. İnceleme ve Müdahale**
    *   **Mavi Çizgi:** Yapay zekanın tahmini.
    *   **Noktalar:** Gerçekleşen satışlar.
    *   Eğer AI'nin tahmini size mantıksız gelirse, tablodan ilgili ayı bulup `Miktar` hücresine tıklayarak elle düzeltebilirsiniz.

    **C. Onaylama**
    *   Sonuçlardan eminseniz `Onayla` butonuna basın. Bu işlem tahminleri kesinleştirir ve Güvenlik Stoğu hesabına (Girdi olarak) gönderir.
