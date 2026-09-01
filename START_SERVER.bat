@echo off
title Consumer Test Lab - Database Server
cd /d "%~dp0"
echo.
echo   ============================================
echo    CONSUMER TEST LAB - Starting server
echo    Your data is stored in a real SQLite
echo    database: server\db\ctl.db
echo   ============================================
echo.
echo   Leave this window open while using the app.
echo   Then open:  http://localhost:4000
echo.
echo   To stop the server, close this window.
echo.
node server.js
pause
