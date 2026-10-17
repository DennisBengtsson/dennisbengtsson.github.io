@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title Skapa inkorgen
echo.
echo  SKAPA INKORGEN FÖR SKRIVAPPEN
echo  =============================
echo  Innan du kör det här: skapa ett PRIVAT repo på GitHub som heter blogg-inkorg
echo  och kryssa i "Add a README file". Se guiden i README.md i samma mapp.
echo.
where git >nul 2>&1 || (echo Git hittades inte. & goto :fel)
set "TMPMAPP=%TEMP%\blogg-inkorg-%RANDOM%%RANDOM%"
echo Hämtar repot blogg-inkorg från GitHub (du kan behöva logga in) ...
git clone -q https://github.com/DennisBengtsson/blogg-inkorg.git "%TMPMAPP%" || (echo Hittade inte repot. Har du skapat det med en README? & goto :fel)
xcopy /e /i /h /y /q "%~dp0inkorg" "%TMPMAPP%" >nul || goto :fel
if not exist "%TMPMAPP%\.github\workflows" mkdir "%TMPMAPP%\.github\workflows"
copy /y "%~dp0inkorg-workflow.yml" "%TMPMAPP%\.github\workflows\inkorg.yml" >nul || goto :fel
cd /d "%TMPMAPP%"
git add -A || goto :fel
git commit -q -m "Inkorg för skrivappen" || (echo Inget att lägga till - inkorgen är redan klar. & goto :klar)
git push -q origin HEAD || (echo Kunde inte skicka till GitHub. & goto :fel)
echo.
echo  KLART. Inkorgen är skapad. Gå vidare med steget om nycklar i guiden.
:klar
cd /d "%~dp0"
rmdir /s /q "%TMPMAPP%" >nul 2>&1
echo.
pause
exit /b 0
:fel
cd /d "%~dp0"
if defined TMPMAPP rmdir /s /q "%TMPMAPP%" >nul 2>&1
echo.
echo Skriptet avbröts.
pause
exit /b 1
