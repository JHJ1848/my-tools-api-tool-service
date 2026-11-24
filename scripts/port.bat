@echo off
chcp 65001 >nul
setlocal EnableExtensions

netstat -ano -p TCP | findstr /R /C:"^[ ]*TCP[ ][ ]*[^ ]*:9527[ ][ ]*[^ ][^ ]*[ ][ ]*LISTENING[ ]"
if errorlevel 1 echo [INFO] 未发现监听 9527 的 TCP 进程。
exit /b 0
