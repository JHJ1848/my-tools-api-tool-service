@echo off
chcp 65001 >nul
setlocal EnableExtensions

title MDPreviewTool - 打包构建管理
pushd "%~dp0.." || (
    echo [ERROR] 无法进入项目目录。
    pause
    exit /b 1
)

:menu
cls
echo ===================================================
echo   MDPreviewTool 打包构建管理
echo ===================================================
echo.
echo   [1] 本地绿色版 (npm run dist:app - 生成 dist-app 目录并注入 PE 图标)
echo   [2] Windows 安装向导 (npm run dist:nsis - Setup.exe 安装包)
echo   [3] Windows MSI 安装包 (npm run dist:msi - 企业级静默安装包)
echo   [4] 绿色便携单文件 (npm run dist:portable - 单文件免安装版)
echo   [5] 绿色免安装压缩包 (npm run dist:zip - Zip 归档)
echo   [6] 全量构建发布包 (npm run dist:all - 生成上述全部格式)
echo   [7] 发布流程演练 (npm run release:dry - dry-run 预检模式)
echo   [8] 退出菜单
echo.
echo ===================================================

set /p "choice=请输入选项编号 [1-8]: "

if "%choice%"=="1" goto build_app
if "%choice%"=="2" goto build_nsis
if "%choice%"=="3" goto build_msi
if "%choice%"=="4" goto build_portable
if "%choice%"=="5" goto build_zip
if "%choice%"=="6" goto build_all
if "%choice%"=="7" goto release_dry
if "%choice%"=="8" goto exit_script

echo [WARN] 无效选项，请重新输入。
ping 127.0.0.1 -n 2 >nul
goto menu

:build_app
echo.
echo [INFO] 开始构建本地绿色版 (dist:app)...
call npm run dist:app
goto build_done

:build_nsis
echo.
echo [INFO] 开始构建 Windows NSIS 安装包 (dist:nsis)...
call npm run dist:nsis
goto build_done

:build_msi
echo.
echo [INFO] 开始构建 Windows MSI 安装包 (dist:msi)...
call npm run dist:msi
goto build_done

:build_portable
echo.
echo [INFO] 开始构建绿色便携单文件 (dist:portable)...
call npm run dist:portable
goto build_done

:build_zip
echo.
echo [INFO] 开始构建绿色免安装压缩包 (dist:zip)...
call npm run dist:zip
goto build_done

:build_all
echo.
echo [INFO] 开始全量构建所有发布包 (dist:all)...
call npm run dist:all
goto build_done

:release_dry
echo.
echo [INFO] 正在预检下一个补丁版本...
call npm run release:dry
goto build_done

:build_done
echo.
if errorlevel 1 (
    echo [ERROR] 构建过程中出现错误，请检查日志。
) else (
    echo [OK] 构建流程执行完成！
)
echo.
pause
goto menu

:exit_script
popd
exit /b 0
