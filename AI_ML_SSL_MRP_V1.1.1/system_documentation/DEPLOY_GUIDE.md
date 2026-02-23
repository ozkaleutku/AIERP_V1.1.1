# 🚀 Kurulum ve Dağıtım Kılavuzu (Deployment Guide)

Bu proje, Python (FastAPI) ve Node.js (React) tabanlı modern bir web uygulamasıdır. Aşağıdaki adımları takip ederek projeyi kendi bilgisayarınızda veya sunucuda çalıştırabilirsiniz.

## 1. Ön Gereksinimler (Prerequisites)
Sistemi çalıştırmadan önce bilgisayarınızda şunların kurulu olması gerekir:

*   **Python 3.9 veya üzeri**: [İndir](https://www.python.org/downloads/) (Kurarken "Add Python to PATH" seçeneğini işaretleyin!)
*   **Node.js 16 veya üzeri**: [İndir](https://nodejs.org/)
*   **PostgreSQL 14 veya üzeri**: [İndir](https://www.postgresql.org/download/)
*   **Git**: [İndir](https://git-scm.com/)

---

## 2. Veritabanı Kurulumu

1.  PostgreSQL'i (pgAdmin veya komut satırı ile) açın.
2.  `AI_ML_SS_MRP` adında **boş** bir veritabanı oluşturun:
    ```sql
    CREATE DATABASE "AI_ML_SS_MRP";
    ```
    *(Not: Büyük/küçük harf duyarlılığı için tırnak içine almanız önerilir)*

---

## 3. Backend Kurulumu

1.  Terminali açın ve `backend` klasörüne gidin:
    ```bash
    cd backend
    ```

2.  Sanal ortam (Virtual Environment) oluşturun (Önerilir):
    ```bash
    python -m venv venv
    .\venv\Scripts\activate   # Windows için
    # source venv/bin/activate # Mac/Linux için
    ```

3.  Gerekli kütüphaneleri yükleyin:
    ```bash
    pip install -r requirements.txt
    ```

4.  `.env` ayarları:
    *   Sistem varsayılan olarak `backend/config.py` içindeki ayarları kullanır.
    *   Veritabanı şifreniz `postgres` değilse, bir `.env` dosyası oluşturun veya Environment Variable olarak tanımlayın:
        `DB_PASSWORD=sifreniz`

5.  Veritabanı tablolarını oluşturun (İlk kurulum):
    ```bash
    python database/database_setup.py
    ```
    *Bu işlem tabloları, triggerları ve enum tiplerini oluşturacaktır.*

6.  Sunucuyu başlatın:
    ```bash
    python main.py
    ```
    *   Backend şu adreste çalışacaktır: `http://localhost:8000`
    *   Swagger API Dokümantasyonu: `http://localhost:8000/docs`

---

## 4. Frontend Kurulumu

1.  Yeni bir terminal açın ve `frontend` klasörüne gidin:
    ```bash
    cd frontend
    ```

2.  Paketleri yükleyin:
    ```bash
    npm install
    ```

3.  Uygulamayı başlatın:
    ```bash
    npm run dev
    ```
    *   Uygulama şu adreste açılacaktır: `http://localhost:5173`

---

## 5. Tek Tıkla Başlatma (Windows)

Geliştirme süreci için ana dizindeki `start_project.bat` dosyasına çift tıklayarak hem Backend hem Frontend'i aynı anda başlatabilirsiniz.
*Bu script, backend ve frontend için ayrı komut satırı pencereleri açar.*

---

## 6. Port Değiştirme (Port Configuration)

Varsayılan portlar (Backend: 8000, Frontend: 5173) çakışıyorsa veya değiştirmek istiyorsanız:

### A. Backend Portunu Değiştirme
1.  `backend/main.py` dosyasını açın.
2.  En alttaki `uvicorn.run(app, host="0.0.0.0", port=8000)` satırındaki `8000` değerini değiştirin.

### B. Frontend Portunu Değiştirme
1.  `frontend/package.json` dosyasını açın.
2.  `"dev": "vite --host"` komutunu `"dev": "vite --host --port 3000"` şeklinde güncelleyin.

### C. Bağlantıyı Güncelleme (Kritik!)
Backend portunu değiştirdiyseniz Frontend'e bunu bildirmeniz gerekir:
1.  `frontend/src/api.js` dosyasını açın.
2.  `baseURL` satırını güncelleyin:
    ```javascript
    baseURL: `http://${window.location.hostname}:YENI_PORT/api`,
    ```

---

## 🛠️ Sorun Giderme

*   **ModuleNotFoundError**: `requirements.txt` dosyasındaki tüm paketlerin yüklü olduğundan emin olun (`pip list`).
*   **FATAL: password authentication failed**: Veritabanı şifrenizin `config.py` veya ortam değişkenlerinde doğru ayarlandığını kontrol edin.
*   **Network Error (Frontend)**: Backend sunucusunun çalıştığından (8000 portu) emin olun.
