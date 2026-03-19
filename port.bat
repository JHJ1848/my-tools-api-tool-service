@echo off
chcp 65001 >nul
set PID=
echo 正在查找占用端口 9527 的进程...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":9527" ^| findstr "LISTENING"') do (
    set PID=%%a
)

if defined PID (
    echo 找到占用端口 9527 的进程 PID: %PID%
    echo 正在终止进程...
    taskkill /F /PID %PID% >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        echo [OK] 已成功终止进程
    ) else (
        echo [ERROR] 终止进程失败
    )
) else (
    echo [INFO] 端口 9527 未被占用，可以直接启动
)
