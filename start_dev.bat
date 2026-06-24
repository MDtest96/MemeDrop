@echo off
cd /d "%~dp0memedrop\app"
echo 🧹 Arret des anciennes instances Electron...
taskkill /F /IM electron.exe 2>nul
echo 🚀 Demarrage de MemeDrop...
npm run dev
pause
