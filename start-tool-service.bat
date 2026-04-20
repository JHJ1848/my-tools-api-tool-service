@echo off
chcp 65001 >nul
setlocal

set "ROOT_DIR=%~dp0"

start "tool-service" cmd /k "cd /d ""%ROOT_DIR%"" && if exist port.bat call port.bat && mvn clean spring-boot:run"
