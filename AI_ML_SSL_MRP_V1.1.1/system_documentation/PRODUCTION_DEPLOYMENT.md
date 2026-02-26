# Dış Sunucuya (VPS) Taşıma ve Domain Alma Rehberi

Bu rehber, uygulamanızı kendi bilgisayarınızdan çıkarıp internet üzerinde herkesin erişebileceği gerçek bir sunucuya (VPS) ve bir alan adına (Domain) taşımanız için gereken temel adımları içerir.

## 1. Alan Adı (Domain) Satın Alma
Uygulamanıza `sirketadi.com` veya `mrp.sirketiniz.com` gibi profesyonel bir isimle erişmek için bir domain almalısınız.
* **Firmalar:** GoDaddy, Namecheap, Google Domains, Turhost vb. üzerinden yıllık olarak satın alınabilir.
* Seçtiğiniz domaini satın aldıktan sonra, sağlayıcının yönetim paneline girerek ileride alacağımız Sunucu IP adresini (A Kaydı) olarak tanımlayacağız.

## 2. Sunucu (VPS) Kiralama
Kendi bilgisayarınızın 7/24 açık kalması yerine, internete doğrudan yüksek hızla bağlı bir sanal sunucu (VPS - Virtual Private Server) kiralamanız gerekir.
* **Firmalar:** DigitalOcean, Hetzner, Vultr, AWS, Linode veya yerel sağlayıcılar (Turhost, Natro vb.).
* **İşletim Sistemi:** Genellikle **Ubuntu 22.04 LTS (Linux)** tercih edilir çünkü en stabil ve kaynak zengini ortamdır.
* **Donanım İhtiyacı:** Başlangıç için 2 CPU, 4GB RAM ve 50GB SSD işinizi rahatlıkla görecektir (Aylık ortalama 5-15$).

## 3. Sunucu Kurulumları (Ubuntu Üzerinde)
Sanal sunucunuza (VPS) giriş yaptıktan sonra bilgisayarınızdaki ortamı orada da hazırlamanız gerekir:

### A. Gerekli Yazılımların Kurulması
Komut satırından (SSH ile bağlanarak) şunları kurmalısınız:
* **PostgreSQL:** Veritabanınız için. (Kurduktan sonra şifrelerinizi ayarlayıp veritabanını oluşturmalısınız, tıpkı lokal bilgisayarınızdaki gibi).
* **Python 3.10+ ve pip:** Backend uygulamanız için.
* **Node.js ve NPM:** Frontend uygulamasını derlemek için.
* **Nginx veya Caddy:** Web sunucusu (Gelen istekleri karşılamak ve SSL/HTTPS yapmak için).

### B. Projenin Sunucuya Aktarılması
Kodlarınızı sunucuya taşımanın en profesyonel yolu **Git (GitHub/GitLab)** kullanmaktır. Kodları GitHub'a (Private repo olarak) yükleyip, sunucudan `git clone` ile çekebilirsiniz.

## 4. Uygulamanın Üretime (Production) Hazırlanması

Şu ana kadar geliştirmeyi (development) kendi bilgisayarınızda yaptınız. Sunucuda ise "Production" (Üretim) modunda çalıştırmalısınız:

### Backend (FastAPI - Python)
* Sunucuda bir Python Sanal Ortamı (`venv`) oluşturulur ve gereksinimler (`pip install -r requirements.txt`) yüklenir.
* `main.py` dosyası artık standart Python ile değil; çökmelere karşı kendini yenileyen ve performanslı çalışan **Uvicorn + Gunicorn** veya **PM2** gibi araçlar kullanılarak arkaplanda 7/24 çalışacak şekilde başlatılır.
* `backend/config.py` içindeki veritabanı şifreleri sunucudaki güncel şifrelerle değiştirilir.

### Frontend (React - Vite)
* Sunucuda `frontend` klasörüne gidip paketler kurulur (`npm install`).
* Daha sonra `npm run build` komutu çalıştırılır. Bu komut, uygulamanızı optimize eder ve çalışmaya hazır statik HTML/JS/CSS dosyalarına çevirerek `dist` adlı bir klasöre koyar.
* Vite ortamında API adresi artık `.env` dosyası üzerinden gerçek Domain adresinize yönlendirilir (`VITE_API_BASE_URL=https://api.sirketiniz.com`).

## 5. Nginx ve SSL (HTTPS) Ayarları

Kullanıcıların IP adresi (`142.25.x.x:5173`) yerine doğrudan `mrp.sirketiniz.com` yazarak girebilmesi için **Nginx** (veya Caddy) kullanılır (Reverse Proxy - Ters Vekil Sunucu).

* **Nginx Ayarı:** Nginx'e şu talimat verilir: *"Eğer birisi mrp.sirketiniz.com'a gelirse, ona Frontend'in 'dist' klasöründeki dosyaları göster. Eğer api.sirketiniz.com/api'ye arka plandan bir istek gelirse, bunu içeride 8000 portunda çalışan Python uygulamasına yönlendir."*
* **Güvenlik (SSL/HTTPS):** Kullanıcı şifrelerinin çalınmaması için "Güvenli Değil" uyarısını kaldırmanız gerekir. **Certbot (Let's Encrypt)** adlı ücretsiz araç ile sunucunuzda komut çalıştırarak otomatik olarak ücretsiz SSL sertifikası alabilirsiniz.

## Özet Adım Planı
1. Domain (Alan Adı) Satın Al.
2. VPS (Sanal Sunucu) Kirala (Ubuntu).
3. Domaini, VPS'nin IP adresine yönlendir (A Kaydı).
4. VPS'e SSH ile bağlanıp PostgreSQL, Python, Node.js ve Nginx kur.
5. Proje kodlarını VPS'e indir.
6. Frontend'i derle (`npm run build`).
7. Backend'i arkaplan servisi olarak başlat.
8. Nginx ayarlarını yap ve Certbot ile SSL (HTTPS) kur.
