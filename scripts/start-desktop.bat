@echo off
chcp 65001 >nul
title MD Preview Tool - 桌面端应用

echo ===================================================
echo 🚀 正在启动 MD Preview 桌面端应用 (类似 Codex)...
echo [提示] 局域网访问地址可在工作台中查看
echo ===================================================

cd /d "%~dp0.."

:: 检查 node_modules
if not exist "node_modules" (
    echo [提示] 首次运行，正在安装依赖...
    call npm install
)

:: 启动 Electron 桌面应用与局域网服务
npm run dev
