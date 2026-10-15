@echo off
chcp 65001 >nul
title Табло — полный экран

echo Этот файл запускается на КОМПЬЮТЕРЕ У ПАНЕЛИ.
echo.
set /p IP=IP-адрес ноутбука с пультом (например 192.168.1.10): 
set PORT=3000
set /p PORT=Порт [3000]: 

echo Открываю табло на весь экран. Закрыть: Alt+F4.
start "" msedge --kiosk "http://%IP%:%PORT%/display" --edge-kiosk-type=fullscreen --no-first-run
