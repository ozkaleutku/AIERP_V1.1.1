# 🏭 Depo Envanteri Kullanım Kılavuzu

**Dosya:** `Inventory.jsx`
**Erişim:** `/inventory`

1.  **Genel Bakış**
    *   Burası sistemin "Gözü"dür. Depoda fiziksel olarak ne kadar mal olduğunu gösterir.
    *   **Active Inventory** (Aktif Stok) tablosundan beslenir.

2.  **Özellikler**
    *   **Anlık Stok:** Malzeme bazında eldeki miktar.
    *   **Değer:** Stok miktarı x Birim Fiyat (Eğer tanımlıysa).

3.  **Adım Adım Kullanım**

    **A. Stok Görüntüleme**
    *   Sayfa açıldığında tüm stoklar listelenir.
    *   Arama kutusu ile ürün kodu filtreleyebilirsiniz.

    **B. Manuel Düzeltme (Sayım Farkı)**
    *   Normalde stoklar "Stok Hareketleri" ile değişir. Ancak sayım farkı varsa:
    1.  İlgili satırın yanındaki `Düzenle` ikonuna basın.
    2.  Yeni miktarı yazın.
    3.  `Güncelle` diyerek kaydedin.
    *   *Uyarı: Buradan yapılan değişiklikler "Düzeltme" olarak loglanır.*

4.  **Aktif Üretim Emirleri Paneli (Sidebar)**
    *   Ekranın sağ tarafında yer alır. Sadece **"Bekleniyor"** ve **"Üretimde"** durumundaki siparişleri gösterir.
    *   Depocunun hangi sipariş için malzeme hazırlayacağını takip etmesini sağlar.
    *   Panel kapatılıp açılabilir.

5.  **Üretime Çıkış İşlemi (Sipariş Bazlı)**
    *   Bir sipariş için hammadde verirken:
    1.  **"Stok Hareketi Ekle"** butonuna basın.
    2.  Amaç bölümünden **"Üretime Çıkış"** seçeneğini işaretleyin.
    3.  Yeni açılan **"Hangi Sipariş İçin?"** kutusundan listedeki siparişi seçin.
    4.  Miktarı girin ve kaydedin.
    *   *Önemli: Bu seçim, simülasyonun "bu malzeme zaten verildi" diyerek mükerrer talep açmasını engeller.*
