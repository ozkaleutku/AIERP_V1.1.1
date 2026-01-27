# 🛒 Satın Alma Siparişleri Kullanım Kılavuzu

**Dosya:** `Orders.jsx`
**Erişim:** `/orders`

1.  **Genel Bakış**
    *   Tedarikçilerden hammadde sipariş etme ve mal kabul sürecini yönetir.
    *   Tedarikçi performans puanı (Gecikme analizi) buradan beslenir.

2.  **Sipariş Süreci**

    **Adım 1: Sipariş Verme (Bekleniyor)**
    1.  `+ Yeni Sipariş` butonuna basın.
    2.  Tedarikçi ve Malzeme seçin.
    3.  Miktar ve Beklenen Teslim Tarihini girin.
    4.  Durum: `Bekleniyor` olarak kaydedilir.

    **Adım 2: Mal Kabul (Geldi)**
    1.  Kamyon fabrikaya yanaştığında, listeden ilgili siparişi bulun.
    2.  `Teslim Al` (Kutu ikonu) butonuna basın.
    3.  **Gerçekleşen Tarihi (Actual Date)** girin.
    *   *Kritik:* Eğer "Beklenen Tarih"ten geç bir tarih girerseniz, sistem bunu "Gecikme" olarak kaydeder ve tedarikçinin güvenilirliğini (Z-Score) düşürür. Bu da gelecekteki güvenlik stoğu önerisini artırır.

3.  **İpuçları**
    *   Yanlış girilen siparişler `Sil` butonu ile iptal edilebilir.
