@echo off
setlocal EnableExtensions

title tool-service
pushd "%~dp0" || (
  echo [ERROR] Cannot enter project directory.
  pause
  exit /b 1
)

echo [1/3] Stopping old service if port 9527 is in use...
if exist "%~dp0port.bat" (
  call "%~dp0port.bat"
) else (
  echo [INFO] port.bat not found, skip stop step.
)
if errorlevel 1 (
  echo [WARN] Stop step returned a non-zero exit code. Continue.
)

echo.
echo [2/3] Pulling latest code...
call git pull
if errorlevel 1 (
  echo.
  echo [ERROR] git pull failed. Startup aborted.
  pause
  exit /b 1
)

echo.
echo [3/3] Starting project...
call mvn clean spring-boot:run
set "MVN_EXIT=%ERRORLEVEL%"

echo.
if not "%MVN_EXIT%"=="0" (
  echo [WARN] Maven process ended with exit code %MVN_EXIT%.
  pause
)

exit /b %MVN_EXIT%
