@echo off
title IELTSBridge CRM - LOKAL (internetsiz)
echo ============================================
echo   IELTSBridge CRM LOKAL rejimda ishga tushmoqda...
echo   Internet KERAK EMAS. Bu oynani YOPMANG.
echo ============================================
cd /d "C:\Users\ASUS\Desktop\IELTSBridge_CRM"
start "" cmd /c "timeout /t 6 >nul & start http://localhost:5200"
call npm run lokal
pause
