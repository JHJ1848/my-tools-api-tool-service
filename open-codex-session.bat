@echo off
chcp 65001 >nul
setlocal

set "ROOT_DIR=%~dp0"

start "codex-resume" cmd /k "cd /d ""%ROOT_DIR%"" && codex resume --last -C ""%ROOT_DIR%"""
