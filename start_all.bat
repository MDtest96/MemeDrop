@echo off
echo Lancement du Bot Discord...
start cmd /k "cd bot && npm start"

echo Lancement de l'application unifiée...
cd app
npm run dev
