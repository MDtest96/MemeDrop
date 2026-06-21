@echo off
echo =======================================
echo Lancement de Memedrop en Local...
echo =======================================

echo 1) Démarrage du Bot (Port 8765)...
cd bot
start cmd /k "node index.js"
cd ..

echo 2) Démarrage de l'application unifiée...
cd app
set WS_URL=ws://localhost:8765
npm run dev

echo Terminé!
pause
