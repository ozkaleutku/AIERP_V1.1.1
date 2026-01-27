# 🚚 Tedarikçi Yönetimi Kullanım Kılavuzu

**Dosya:** `Suppliers.jsx`
**Erişim:** `/suppliers`

1.  **Genel Bakış**
    *   Hangi malzemenin kimden alındığını ve tedarik koşullarını yönetir.
    *   Aynı malzeme birden fazla tedarikçiden alınabilir (Alternatifli).

2.  **Kritik Kavramlar**
    *   **Given Lead Time:** Tedarikçinin "Ben bu malı 10 günde getiririm" beyanı.
    *   **Calculated Lead Time:** Gerçekleşen siparişlerden sistemin ölçtüğü "Gerçek" süre. (Tedarikçi 10 dese bile sistem 15 ölçtüyse, güvenlik stoğu 15'e göre hesaplanır).
    *   **Lot Size:** Minimum sipariş miktarı (Örn: "En az 100 adet alabilirsin").

3.  **Adım Adım Kullanım**

    **A. Tedarikçi Atama**
    1.  Malzemeyi seçin.
    2.  Tedarikçi Kodu/Adı girin.
    3.  Teslim Süresi (Gün) girin.
    4.  `Ekle` butonuna basın.

    **B. Performans Takibi**
    1.  Listede `Avg Lead Time` (Ortalama Süre) ve `Deviation` (Sapma) sütunlarına bakın.
    2.  Sapması yüksek tedarikçiler "Riskli"dir, sistem bunlar için daha fazla güvenlik stoğu tutulmasını önerir.
