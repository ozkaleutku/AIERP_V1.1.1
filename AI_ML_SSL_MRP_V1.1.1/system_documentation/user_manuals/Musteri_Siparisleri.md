# 👥 Müşteri Siparişleri Kullanım Kılavuzu

**Dosya:** `CustomerOrders.jsx`
**Erişim:** `/customer-orders`

1.  **Genel Bakış**
    *   Satış departmanının kullandığı ekrandır.
    *   **Simülasyonun Tetikleyicisidir:** Buraya girilen her sipariş, arka planda "Üretilebilir mi?" analizini başlatır.

2.  **Sipariş Durumları**
    *   `Bekleniyor`: Sipariş alındı, planlama aşamasında.
    *   `Üretimde`: Malzemeler rezerve edildi.
    *   `Hazır`: Üretim bitti, sevk bekliyor.
    *   `Sevk Edildi`: Müşteriye gitti (Stoktan düşer).

3.  **Adım Adım Kullanım**

    **A. Sipariş Girişi**
    1.  Müşteri Adı ve Ürün (Mamül) seçin.
    2.  Miktar ve Termin Tarihini girin.
    3.  `Kaydet` butonuna basın.
    
    **B. Simülasyon Sonucu**
    *   Sipariş kaydedildiği an sistem arka planda BOM patlatır.
    *   Eğer hammadde eksiği varsa, **Simülasyon Haritası** ekranında uyarı verir.

    **C. Sevk Etme**
    *   Ürün hazır olduğunda durumu `Sevk Edildi` yapın.
    *   Sistem otomatik olarak **Satış Çıkışı** fişi oluşturur ve mamül stoğunu düşer.
