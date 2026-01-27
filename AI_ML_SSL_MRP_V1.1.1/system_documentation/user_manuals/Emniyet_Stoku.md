# 🛡️ Emniyet Stoku (Nihai) Kullanım Kılavuzu

**Dosya:** `SafetyStock.jsx`
**Erişim:** `/safety-stock`

1.  **Genel Bakış**
    *   Sistemin en stratejik ekranıdır. "Depoda fazladan ne kadar mal tutmalıyım?" sorusunu cevaplar.
    *   Hem **AI (LightGBM)** hem de **Geleneksel (King's Formula)** yöntemleri aynı anda çalıştırır.

2.  **Tablo Sütunları**
    *   **Önerilen (AI):** Yapay zekanın önerdiği stok miktarı. (Genelde daha optimize).
    *   **King's Formula:** İstatistiksel formülün sonucu. (Genelde daha garantici ve yüksek).
    *   **Mevcut Stok:** Şu an depoda olan.
    *   **Fark (Action):** `Önerilen - Mevcut`. Negatif ise "Acil Sipariş Ver" demektir.

3.  **Kullanım**
    1.  `Hesapla` butonuna basın (Tüm algoritmalar çalışır).
    2.  Sonuçları inceleyin.
    3.  Onaylamak istediğiniz satırların başındaki kutucuğu işaretleyin.
    4.  `Planı Onayla` butonuna basın.
    *   Bu işlem, eksik miktarları otomatik olarak **Satın Alma Sipariş Taslağına** dönüştürür.
