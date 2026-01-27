# 📉 Stok Hareketleri Kullanım Kılavuzu

**Dosya:** `StockMovement.jsx`
**Erişim:** `/stock-movements`

1.  **Genel Bakış**
    *   Depoya giren ve çıkan her malzemenin kaydıdır. Muhasebe fişi gibidir.
    *   Stok miktarını değiştiren tek yasal yoldur.

2.  **Hareket Tipleri**
    *   `Giriş`: Satın alma veya iade girişi. (Stok Artar +)
    *   `Çıkış`: Hurda, zayi veya numune çıkışı. (Stok Azalır -)
    *   `Üretime Giden`: Yarımamül/Mamül üretimi için hammadde tüketimi. (Stok Azalır -)
    *   `Satış Çıkışı`: Müşteriye sevk. (Stok Azalır -)

3.  **Adım Adım Kullanım**

    **A. Manuel Hareket Ekleme**
    1.  Ürünü seçin.
    2.  Yönü seçin (`Giriş` veya `Çıkış`).
    3.  Miktarı girin.
    4.  Tarih seçin (Geçmişe dönük hareket girilebilir).
    5.  `Kaydet` butonuna basın.

    **B. Tarihçe İzleme**
    *   Alt kısımdaki tabloda kimin, ne zaman, ne işlem yaptığı listelenir.
