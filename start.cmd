@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   啟動公司官網...
echo   官網：http://127.0.0.1:4321
echo   後台：http://127.0.0.1:4321/admin
echo.
node server.js
pause
