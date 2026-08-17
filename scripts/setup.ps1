# ========================================================
# MD Preview Tool - Windows Setup & Initialization Script
# ========================================================

$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "     MD Preview Tool - Environment & Setup Wizard" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# [1/4] Check Node.js & npm
Write-Host "== [1/4] Checking System Environment..." -ForegroundColor Yellow
try {
    $nodeVer = (node -v).Trim()
    Write-Host "  [OK] Node.js version: $nodeVer" -ForegroundColor Green
    $major = [int]($nodeVer -replace '^v(\d+)\..*$', '$1')
    if ($major -lt 18) {
        Write-Host "  [WARN] Node.js >= 18.0.0 is recommended (current: $nodeVer)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [ERROR] Node.js not found! Please install Node.js (>= 18.0.0): https://nodejs.org/" -ForegroundColor Red
    exit 1
}

try {
    $npmVer = (npm -v).Trim()
    Write-Host "  [OK] npm version: v$npmVer" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] npm not found! Please check PATH configuration." -ForegroundColor Red
    exit 1
}

# [2/4] Install Dependencies
Write-Host ""
Write-Host "== [2/4] Installing Dependencies (npm install)..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Dependency installation failed! Check network/npm registry." -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] Dependencies installed successfully!" -ForegroundColor Green

# [3/4] Build & Package
Write-Host ""
Write-Host "== [3/4] Building Windows Desktop Package (dist-app)..." -ForegroundColor Yellow
npm run dist:app
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Desktop package build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] Desktop executable generated: dist-app\MD Preview Tool.exe" -ForegroundColor Green

# [4/4] Create Desktop Shortcut
Write-Host ""
Write-Host "== [4/4] Creating Desktop Shortcut..." -ForegroundColor Yellow
try {
    $root = Split-Path $PSScriptRoot -Parent
    $targetExe = Join-Path $root "dist-app\MD Preview Tool.exe"
    $iconPath = Join-Path $root "resources\icon.ico"
    $desktop = [System.Environment]::GetFolderPath('Desktop')
    $shortcutPath = Join-Path $desktop "MD Preview Tool.lnk"

    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($shortcutPath)
    $Shortcut.TargetPath = $targetExe
    $Shortcut.WorkingDirectory = Join-Path $root "dist-app"
    $Shortcut.Description = "MD Preview Tool - Markdown Workspace"
    if (Test-Path $iconPath) {
        $Shortcut.IconLocation = "$iconPath,0"
    }
    $Shortcut.Save()
    Write-Host "  [OK] Desktop shortcut created: $shortcutPath" -ForegroundColor Green
} catch {
    Write-Host "  [WARN] Skipping shortcut creation: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "       Setup & Initialization Complete!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  * Desktop App: Launch via desktop shortcut or .\scripts\start-desktop.bat"
Write-Host "  * Dev Mode:    npm run dev"
Write-Host "  * LAN Service: http://<Your-IP>:9527/md-view"
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""