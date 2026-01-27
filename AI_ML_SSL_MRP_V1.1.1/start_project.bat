@echo off
echo ===================================================
echo   AI-Driven MRP System - Baslatiliyor...
echo ===================================================

echo.
echo [1/3] Python kutuphaneleri kontrol ediliyor...
pip install -r backend/requirements.txt

echo.
echo [2/3] Backend (FastAPI) baslatiliyor...
start cmd /k "cd backend && python main.py"

echo.
echo [3/3] Frontend (React) baslatiliyor...
echo [3/3] Frontend (React) baslatiliyor...
cd frontend
if not exist node_modules (
    echo node_modules bulunamadi. Bagimliliklar yukleniyor...
    call npm install
)
start cmd /k "npm run dev"

echo.
echo ===================================================
echo   Sistem Hazir! Tarayiciniz acilacak...
echo   Sistem Hazir! 
echo   Erisim Adresi (Bu Bilgisayar): http://localhost:5173
echo   Erisim Adresi (Agdaki Diger Cihazlar): http://[IP_ADRESINIZ]:5173
echo   Backend API:  http://[IP_ADRESINIZ]:8000/docs
echo ===================================================
pause
