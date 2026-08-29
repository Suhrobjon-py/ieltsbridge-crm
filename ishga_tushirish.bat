@echo off
title IELTSBridge CRM server
echo ============================================
echo   IELTSBridge CRM ishga tushmoqda...
echo   Bu oynani YOPMANG - server shu yerda ishlaydi.
echo   To'xtatish: Ctrl+C yoki oynani yopish.
echo ============================================
cd /d "C:\Users\ASUS\Desktop\IELTSBridge_CRM"
start "" cmd /c "timeout /t 4 >nul & start http://localhost:5199"
npm run dev
pause
