# ⚖️ Karşılaştırma ve Onay Kullanım Kılavuzu

**Dosya:** `SafetyStockComparison.jsx`
**Erişim:** `/comparison`

1.  **Genel Bakış**
    *   Yöneticiler için karar destek ekranıdır.
    *   **"Makine mi haklı, Formül mü?"** sorusunu görselleştirir.

2.  **Grafik Analizi**
    *   Grafikte iki çizgi göreceksiniz:
        *   🔴 **Kırmızı (King):** Yüksek stok tutmayı seven, riskten kaçan geleneksel yöntem.
        *   🟢 **Yeşil (AI - LightGBM):** Daha düşük stokla aynı işi yapmayı hedefleyen modern yöntem.
    
3.  **Karar Verme**
    *   Eğer AI önerisi (Yeşil), Gelenekselin (Kırmızı) çok altındaysa; Yapay Zeka size "Gereksiz stok tutuyorsun, paranı boşa harcama" diyor demektir.
    *   Bu ekranı kullanarak AI önerilerine ne kadar güvenebileceğinizi test edebilirsiniz.
