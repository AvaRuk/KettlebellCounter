@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Гиревой спорт — табло

where node >nul 2>nul
if errorlevel 1 (
  echo [ошибка] Не найден Node.js. Установите версию LTS с https://nodejs.org и запустите скрипт снова.
  pause
  exit /b 1
)

rem Открываем пульт в браузере через пару секунд, когда сервер уже поднимется
start "" cmd /c "timeout /t 2 >nul & start http://localhost:3000/control"

node server.js %*
echo.
pause
