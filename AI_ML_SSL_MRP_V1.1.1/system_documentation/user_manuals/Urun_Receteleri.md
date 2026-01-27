# 🧬 Ürün Reçeteleri Kullanım Kılavuzu

**Dosya:** `Bom.jsx`
**Erişim:** `/bom`

1.  **Genel Bakış**
    *   MRP'nin kalbidir. Hangi ürünün (Parent) hangi malzemelerden (Child) oluştuğunu tanımlar.
    *   Sınırsız derinlikte ağaç yapısı kurabilirsiniz (Child da başka bir ürünün Parent'ı olabilir).

2.  **Ekran Yapısı**
    *   **Sol Panel:** Parent (Ana Ürün) seçimi.
    *   **Sağ Panel:** Seçili Parent'a eklenecek Child (Bileşen) seçimi.
    *   **Alt Liste:** Mevcut reçete detayları.

3.  **Adım Adım Kullanım**

    **A. Reçete Oluşturma**
    1.  Sol taraftan üretmek istediğiniz ürünü seçin (Örn: `M-TABLET`).
    2.  Sağ taraftan içine girecek malzemeyi seçin (Örn: `YM-EKRAN`).
    3.  **Miktar** alanına, 1 adet Tablet için kaç adet Ekran gerektiğini yazın (Örn: `1`).
    4.  `Reçeteye Ekle` butonuna basın.

    **B. Reçete Silme**
    1.  Aşağıdaki listeden ilgili satırı bulun.
    2.  `Sil` (Çöp Kutusu) butonuna basın.

4.  **İpuçları**
    *   **Döngüsel Hata (Circular Dependency):** `A` ürününü üretmek için `B`, `B` için tekrar `A` kullanmaya çalışırsanız sistem hata verir.
    *   Hammadde (Raw Material) tipindeki ürünlerin reçetesi olmaz (Onlar en alt seviyedir).
