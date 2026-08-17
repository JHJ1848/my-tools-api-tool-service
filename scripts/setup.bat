@echo off
chcp 65001 >nul
title MD Preview Tool - 一键环境初始化向导
echo ========================================================
echo       MD Preview Tool - 环境检测与一键初始化
echo ========================================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
echo.
pause
