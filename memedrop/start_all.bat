@echo off
echo Lancement du Bot Discord...
start cmd /k "cd bot && npm start"

echo Lancement du QuickLauncher...
cd quicklauncher
npm run dev
