# 📦 Ürün Yönetimi Kullanım Kılavuzu

**Dosya:** `Products.jsx`
**Erişim:** `/products`

1.  **Genel Bakış**
    *   Şirketin alıp sattığı veya ürettiği tüm stok kalemlerinin (SKU) tanımlandığı ana veri ekranıdır.

2.  **Veri Alanları**
    *   **Ürün Kodu (Item ID):** Benzersiz kimlik. (Örn: `HM-001`, `YM-MOTOR`, `M-TABLET`)
    *   **Tip:**
        *   `Hammadde`: Satın alınır.
        *   `Yarı Mamül`: Üretilir (BOM gerektirir).
        *   `Mamül`: Üretilir ve satılır.
    *   **Talep (Demand Avg):** Sistem tarafından otomatik hesaplanır. (Manuel değiştirilemez).

3.  **Adım Adım Kullanım**

    **A. Yeni Ürün Ekleme**
    1.  Sayfanın üst kısmındaki `+ Yeni Ürün Ekle` butonuna basın.
    2.  Açılan formda Ürün Kodu, Tipi ve Birimini (Adet, Kg) girin.
    3.  `Kaydet` butonuna basın.

    **B. Ürün Düzenleme/Pasife Alma**
    1.  Listeden ilgili ürünü bulun.
    2.  `Düzenle` (Kalem ikonu) butonuna basın.
    3.  Durumunu `Pasif` yaparsanız, artık siparişlerde ve hesaplamalarda görünmez.

4.  **Dikkat Edilmesi Gerekenler**
    *   Bir ürünü silmek için, önce o ürüne bağlı sipariş ve stok hareketlerinin olmaması gerekir.
