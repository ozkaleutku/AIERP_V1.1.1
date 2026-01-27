# 🚀 Kurulum ve Dağıtım Kılavuzu (Deployment Guide)

Bu proje, Python (FastAPI) ve Node.js (React) tabanlı modern bir web uygulamasıdır. Aşağıdaki adımları takiperek projeyi kendi bilgisayarınızda veya sunucuda çalıştırabilirsiniz.

## 1. Ön Gereksinimler (Prerequisites)
Sistemi çalıştırmadan önce bilgisayarınızda şunların kurulu olması gerekir:

*   **Python 3.9 veya üzeri**: [İndir](https://www.python.org/downloads/) (Kurarken "Add Python to PATH" seçeneğini işaretleyin!)
*   **Node.js 16 veya üzeri**: [İndir](https://nodejs.org/)
*   **PostgreSQL 14 veya üzeri**: [İndir](https://www.postgresql.org/download/)
*   **Git**: [İndir](https://git-scm.com/)

---

## 2. Veritabanı Kurulumu

1.  PostgreSQL'i açın ve `nu_mrp_db` adında boş bir veritabanı oluşturun.
    ```sql
    CREATE DATABASE nu_mrp_db;
    ```
2.  Veritabanına erişim için bir kullanıcı oluşturun (veya `postgres` kullanıcısını kullanın).

---

## 3. Backend Kurulumu

1.  Backend klasörüne gidin:
    ```bash
    cd backend
    ```

2.  Sanal ortam (Virtual Environment) oluşturun (Opsiyonel ama önerilir):
    ```bash
    python -m venv venv
    .\venv\Scripts\activate   # Windows için
    # source venv/bin/activate # Mac/Linux için
    ```

3.  Gerekli kütüphaneleri yükleyin:
    ```bash
    pip install -r requirements.txt
    ```

4.  `.env` dosyasını yapılandırın:
    *   `config.py` dosyası varsayılan olarak yerel ayarları kullanır. Eğer şifreniz farklıysa `DB_PASSWORD` alanını düzenleyin.

5.  Veritabanı tablolarını oluşturun (İlk kurulum):
    ```bash
    python database/database_setup.py
    ```

6.  Sunucuyu başlatın:
    ```bash
    python main.py
    ```
    *   API şu adreste çalışacaktır: `http://localhost:8000`
    *   Swagger Dokümantasyonu: `http://localhost:8000/docs`

---

## 4. Frontend Kurulumu

1.  Yeni bir terminal açın ve Frontend klasörüne gidin:
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

---

## 🛠️ Sorun Giderme
*   **Port Hatası:** Eğer 8000 veya 5173 portları doluysa, scriptler hata verebilir. İlgili portları kullanan diğer uygulamaları kapatın.
*   **Veritabanı Bağlantı Hatası:** `backend/config.py` içindeki şifre ve kullanıcı adının PostgreSQL kurulumunuzla eşleştiğinden emin olun.
