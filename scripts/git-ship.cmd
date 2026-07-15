@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0\.."

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo Este directorio no es un repositorio git.
  exit /b 1
)

set "MSG=%*"
if "%~1"=="" (
  set /p MSG=Mensaje del commit: 
)

if "%MSG%"=="" (
  echo Debes ingresar un mensaje de commit.
  exit /b 1
)

git add -A
if errorlevel 1 (
  echo Fallo git add.
  exit /b 1
)

git diff --cached --quiet
if not errorlevel 1 (
  echo No hay cambios para commit.
  exit /b 0
)

git commit -m "%MSG%"
if errorlevel 1 (
  echo Fallo git commit.
  exit /b 1
)

git push origin main
if errorlevel 1 (
  echo Fallo git push.
  exit /b 1
)

echo Commit y push completados.
exit /b 0
