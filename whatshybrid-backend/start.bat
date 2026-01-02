@echo off
echo 🚀 WhatsHybrid Backend v7.5.0
echo ==============================
echo 👤 Admin: sevaland10@gmail.com
echo.

if not exist "data" mkdir data
if not exist "node_modules" (
    echo 📦 Instalando dependências...
    npm install
)

echo.
echo 🟢 Iniciando servidor...
echo    http://localhost:4000
echo.
npm start
