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

set "GIT_REMOTE=origin"
set "GIT_BRANCH="
set "SKIP_GIT_PULL="

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
  set "SKIP_GIT_PULL=1"
  echo.
  echo [WARN] Current directory is not a git repository. Skip git pull.
  goto start_project
)

for /f "delims=" %%i in ('git remote 2^>nul') do (
  set "GIT_REMOTE=%%i"
  goto git_remote_found
)
:git_remote_found

for /f "delims=" %%i in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "GIT_BRANCH=%%i"
if not defined GIT_BRANCH (
  echo.
  echo [WARN] Cannot determine current git branch. Skip git pull.
  set "SKIP_GIT_PULL=1"
  goto start_project
)
if /i "%GIT_BRANCH%"=="HEAD" (
  echo.
  echo [WARN] Detached HEAD detected. Skip git pull.
  set "SKIP_GIT_PULL=1"
  goto start_project
)

echo.
echo [2/3] Pulling latest code from %GIT_REMOTE%/%GIT_BRANCH%...
call git pull %GIT_REMOTE% %GIT_BRANCH%
if errorlevel 1 (
  echo.
  echo [WARN] git pull failed. Continue starting with local code.
)

:start_project
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
