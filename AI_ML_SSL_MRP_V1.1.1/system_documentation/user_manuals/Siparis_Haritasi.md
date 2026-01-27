# 🎮 Sipariş Haritası (Simülasyon) Kullanım Kılavuzu

**Dosya:** `OrderMap.jsx`
**Erişim:** `/simulation/map`

1.  **Genel Bakış**
    *   "Elimdeki stok ve yoldaki siparişler, müşteriye verdiğim sözleri tutmamı sağlar mı?" sorusunun cevabıdır.
    *   Sanal bir zaman çizelgesi üzerinde geleceği gösterir.

2.  **Ekran Bölümleri**
    *   **Eksik Malzeme Listesi:** Hangi sipariş için, hangi hammaddeden kaç tane eksik olduğunu kırmızı ile listeler.
    *   **Önerilen Aksiyon:** "Acil olarak 500 adet HM-01 sipariş etmelisin" gibi tavsiyeler verir.

3.  **Nasıl Kullanılır?**
    *   Bu ekranda veri girişi yapılmaz, sadece **analiz** yapılır.
    *   Müşteri Siparişleri ekranında yeni bir giriş yapıldığında burası otomatik güncellenir.
    *   **Sıfırla:** Simülasyon verileri karışırsa, sağ üstteki `Simülasyonu Sıfırla` butonu ile sanal stoğu gerçek stokla eşitleyebilirsiniz.
