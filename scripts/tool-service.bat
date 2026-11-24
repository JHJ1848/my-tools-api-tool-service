@echo off
chcp 65001 >nul
setlocal EnableExtensions

title MD Preview Tool - 桌面端应用启动器
pushd "%~dp0.." || (
    echo [ERROR] 无法进入项目目录。
    pause
    exit /b 1
)

echo ===================================================
echo   MD Preview Tool - 桌面应用启动器
echo ===================================================

echo.
echo [1/3] 检查 Node.js 运行环境...
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 未检测到 Node.js 环境，请先安装 Node.js (推荐 v18 或 v20 及以上版本)。
    pause
    popd
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v 2^>nul') do set "NODE_VERSION=%%v"
echo [OK] 检测到 Node.js 版本: %NODE_VERSION%

echo.
echo [2/3] 检查项目依赖 (node_modules)...
if not exist "node_modules" (
    echo [INFO] 首次运行或未检测到依赖，正在执行 npm install...
    call npm install
    if errorlevel 1 (
        echo [ERROR] 依赖安装失败，请检查网络或配置。
        pause
        popd
        exit /b 1
    )
) else (
    echo [OK] 项目依赖已就绪。
)

echo.
echo [3/3] 正在启动 MD Preview Tool 桌面端应用...
echo ---------------------------------------------------
echo [提示] 局域网访问地址可在工作台中查看
echo ---------------------------------------------------
call npm run dev
set "APP_EXIT=%ERRORLEVEL%"

if not "%APP_EXIT%"=="0" (
    echo.
    echo [WARN] 应用进程已退出，退出代码: %APP_EXIT%
    pause
)

popd
exit /b %APP_EXIT%
