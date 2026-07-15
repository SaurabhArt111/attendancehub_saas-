@echo off
echo Starting DriftX services on network...
echo.
echo This will open 3 terminal windows:
echo   1. backend
echo   2. admin
echo   3. user
echo.
timeout /t 2

REM Get the directory where this script is located
cd /d "%~dp0"

REM Start backend in new window
echo Starting backend...
start "backend - Overlay Lounge" cmd /k "cd backend && npm run dev"
timeout /t 2

REM Start admin in new window
echo Starting admin...
start "admin" cmd /k "cd admin && npm run dev"
timeout /t 2

REM Start Manager user in new window
echo Starting Manager...
start "user" cmd /k "cd user && npm run dev"
timeout /t 2
