@echo off
chcp 65001 >nul
cd /d "%~dp0"

set PY=
py -3 --version >nul 2>&1 && set PY=py -3
if not defined PY (
  python -c "import sys; sys.exit(0 if sys.version_info[0]==3 else 1)" >nul 2>&1 && set PY=python
)
if not defined PY (
  echo.
  echo   Python 3 hittades inte. Installera det från https://www.python.org/downloads/
  echo   och kryssa i "Add python.exe to PATH".
  echo.
  pause
  exit /b 1
)

echo.
echo   Startar redigeraren ... låt det här fönstret vara öppet medan du redigerar.
%PY% redigera.py
pause
