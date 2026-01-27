# 📊 Satış Geçmişi Kullanım Kılavuzu

**Dosya:** `SalesHistory.jsx`
**Erişim:** `/sales-history`

1.  **Genel Bakış**
    *   Yapay Zekanın (AI) beslendiği ana veri kaynağıdır.
    *   Hangi ürünün ne zaman satıldığı bilgisini ham veri olarak gösterir.
    *   Stok hareketlerinden "Satış Çıkışı" olanlar buraya otomatik düşer.

2.  **Neden Önemli?**
    *   Talep Tahmini (Forecast) yaparken sistem buradaki tarihlere ve miktarlara bakar.
    *   Eğer buradaki veri kirli veya yanlışsa, AI'nin tahmini de yanlış olur.

3.  **Kullanım**
    *   Genelde sadece izleme amaçlıdır.
    *   Ancak veri temizliği gerekiyorsa (Örn: İade edilen bir ürünü satış gibi gösterdiyseniz), buradan ilgili kaydı bulup silebilirsiniz.
