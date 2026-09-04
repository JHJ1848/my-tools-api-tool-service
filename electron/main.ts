import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, clipboard, Notification, NativeImage } from 'electron'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import os from 'os'
import chokidar, { FSWatcher } from 'chokidar'
import { startHttpServer, stopHttpServer, isHttpServerRunning, getServerStatus, setServerOptions, getLanIpAddress, getWorkspaceConfig, saveWorkspacePath, isLanSharingEnabled, setLanSharing, clearAllCache } from './server'

const _currentFilename = fileURLToPath(import.meta.url)
const _currentDirname = dirname(_currentFilename)

// Set process env
process.env.DIST = path.join(_currentDirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public')

// 显式设置 Windows AppUserModelID 以确保任务栏图标与系统通知精准生效
if (process.platform === 'win32') {
  app.setAppUserModelId('com.toolservice.mdpreview')
}

const allWindows: Set<BrowserWindow> = new Set()
let mainWindow: BrowserWindow | null = null
let currentWatcher: FSWatcher | null = null
let tray: Tray | null = null
let isQuitting = false

// Configuration Storage
const USER_DATA_CONFIG = path.join(app.getPath('userData'), 'config.json')
const FALLBACK_CONFIG_DIR = path.join(os.homedir(), '.tool-service')
const FALLBACK_CONFIG = path.join(FALLBACK_CONFIG_DIR, 'config.json')

/**
 * 读取本地持久化配置
 */
function loadConfig(): Record<string, any> {
  try {
    if (fs.existsSync(USER_DATA_CONFIG)) {
      const data = fs.readFileSync(USER_DATA_CONFIG, 'utf-8')
      return JSON.parse(data)
    }
  } catch (e) {
    console.error('Failed to load config from user data:', e)
  }
  try {
    if (fs.existsSync(FALLBACK_CONFIG)) {
      const data = fs.readFileSync(FALLBACK_CONFIG, 'utf-8')
      return JSON.parse(data)
    }
  } catch (e) {
    console.error('Failed to load config from fallback location:', e)
  }
  return {}
}

/**
 * 写入本地持久化配置
 */
function saveConfig(cfg: Record<string, any>) {
  try {
    const dir = path.dirname(USER_DATA_CONFIG)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(USER_DATA_CONFIG, JSON.stringify(cfg, null, 2), 'utf-8')
  } catch (e) {
    console.error('Failed to save config to user data:', e)
  }
  try {
    if (!fs.existsSync(FALLBACK_CONFIG_DIR)) fs.mkdirSync(FALLBACK_CONFIG_DIR, { recursive: true })
    fs.writeFileSync(FALLBACK_CONFIG, JSON.stringify(cfg, null, 2), 'utf-8')
  } catch (e) {
    console.error('Failed to save config to fallback location:', e)
  }
}

let inMemoryConfig: Record<string, any> = loadConfig()

/**
 * 解析并获取可用的应用图标路径
 */
function getAppIconPath(ext = 'png'): string {
  const candidatePaths = [
    path.join(_currentDirname, `../resources/icon.${ext}`),
    path.join(_currentDirname, `../../resources/icon.${ext}`),
    path.join(process.resourcesPath || '', `resources/icon.${ext}`),
    path.join(process.resourcesPath || '', `icon.${ext}`),
    path.join(process.cwd(), `resources/icon.${ext}`),
  ]

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  if (ext !== 'png') {
    return getAppIconPath('png')
  }
  return ''
}

/**
 * 唤醒并激活主窗口
 */
function showMainWindow() {
  if (!mainWindow) {
    createWindow()
    return
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show()
  }
  mainWindow.focus()
}

/**
 * 复制内网分享链接并提示
 */
function copyLanShareUrl() {
  if (!isLanSharingEnabled()) {
    if (Notification.isSupported()) {
      new Notification({
        title: '内网共享已暂停',
        body: '内网 HTTP 共享服务当前已由管理员暂停，请在工作台开启服务后再分享',
        icon: getAppIconPath('png') || undefined,
      }).show()
    }
    return
  }
  const lanIp = getLanIpAddress()
  const port = 9527
  const lanUrl = `http://${lanIp}:${port}/md-view`
  clipboard.writeText(lanUrl)

  if (Notification.isSupported()) {
    new Notification({
      title: '内网分享链接已复制',
      body: lanUrl,
      icon: getAppIconPath('png') || undefined,
    }).show()
  }
}

/**
 * 彻底退出应用
 */
function quitApp() {
  isQuitting = true
  if (currentWatcher) {
    currentWatcher.close()
    currentWatcher = null
  }
  stopHttpServer()
  app.quit()
}

/**
 * 创建系统托盘 (System Tray)
 */
function createTray() {
  if (tray) return

  // 优先加载带有 16x16/24x24/32x32 优化图层的 ICO 或进行高质量平滑抗锯齿缩放
  const icoPath = getAppIconPath('ico')
  const pngPath = getAppIconPath('png')
  let trayIcon: NativeImage | null = null

  if (icoPath && fs.existsSync(icoPath)) {
    trayIcon = nativeImage.createFromPath(icoPath)
  } else if (pngPath && fs.existsSync(pngPath)) {
    const rawImage = nativeImage.createFromPath(pngPath)
    trayIcon = rawImage.resize({ width: 16, height: 16, quality: 'best' })
  }

  if (!trayIcon || trayIcon.isEmpty()) {
    trayIcon = nativeImage.createEmpty()
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('MD Preview Tool')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开工作台',
      click: () => {
        showMainWindow()
      },
    },
    {
      label: '复制内网分享链接',
      click: () => {
        copyLanShareUrl()
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        quitApp()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  // 托盘交互事件
  tray.on('double-click', () => {
    showMainWindow()
  })

  tray.on('click', () => {
    showMainWindow()
  })
}

function createWindow(pathParam?: string): BrowserWindow {
  const iconPath = getAppIconPath('ico') || getAppIconPath('png')
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'MD Preview Tool',
    icon: iconPath && fs.existsSync(iconPath) ? iconPath : undefined,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    backgroundColor: '#0d0e11',
    show: false,
    webPreferences: {
      preload: path.join(_currentDirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      spellcheck: false,
    },
  })

  allWindows.add(win)
  if (!mainWindow) {
    mainWindow = win
  }

  if (iconPath && fs.existsSync(iconPath)) {
    try {
      const img = nativeImage.createFromPath(iconPath)
      if (!img.isEmpty()) {
        win.setIcon(img)
      }
    } catch (e) {
      console.warn('Set icon error:', e)
    }
  }

  // Prevent white flash when loading
  win.once('ready-to-show', () => {
    win.show()
  })

  win.on('focus', () => {
    mainWindow = win
  })

  win.on('maximize', () => {
    win.webContents.send('window:maximize-change', true)
  })

  win.on('unmaximize', () => {
    win.webContents.send('window:maximize-change', false)
  })

  // 拦截窗口关闭事件，支持记住选择与最小化到托盘
  win.on('close', (e) => {
    if (isQuitting) {
      return
    }

    if (allWindows.size > 1) {
      // 存在多个窗口时，直接关闭当前子窗口
      return
    }

    e.preventDefault()

    const closePref = inMemoryConfig['closePreference'] // 'minimize-to-tray' | 'exit'
    if (closePref === 'minimize-to-tray') {
      win.hide()
      return
    } else if (closePref === 'exit') {
      quitApp()
      return
    }

    // 未记住偏好设置，唤起前端确认弹窗
    win.webContents.send('app:confirm-close')
  })

  win.on('closed', () => {
    allWindows.delete(win)
    if (mainWindow === win) {
      mainWindow = allWindows.size > 0 ? Array.from(allWindows)[0] : null
    }
    if (allWindows.size === 0 && currentWatcher) {
      currentWatcher.close()
      currentWatcher = null
    }
  })

  // 统一加载嵌入式 HTTP 服务工作台 (http://127.0.0.1:9527/md-view)
  // 保证开发环境 (npm run dev) 与打包 exe 保持完全同源与等效体验
  const targetUrl = pathParam
    ? `http://127.0.0.1:9527/md-view?path=${encodeURIComponent(pathParam)}`
    : 'http://127.0.0.1:9527/md-view'

  if (!isHttpServerRunning()) {
    startHttpServer()
      .then(() => {
        win.loadURL(targetUrl)
      })
      .catch((err) => {
        console.error('Failed to start embedded server before loadURL:', err)
        win.loadURL(targetUrl)
      })
  } else {
    win.loadURL(targetUrl)
  }
}

// ---------------- IPC HANDLERS ----------------

// 1. Dialogs & File System
ipcMain.handle('fs:pickDirectory', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择工作区文件夹',
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  const selected = result.filePaths[0]
  try {
    saveWorkspacePath(selected)
  } catch (err) {
    console.error('Failed to sync workspace to server config:', err)
  }
  return selected
})

const IGNORED_NAMES = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  'dist',
  'dist-electron',
  '.idea',
  '.vscode',
  'target',
  'bin',
  'obj',
  '.next',
  '.cache',
  'build',
])

interface FileNodeData {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNodeData[]
  extension?: string
  size?: number
  modifiedTime?: number
}

async function scanDirectory(dirPath: string, maxDepth: number = 5, currentDepth: number = 0): Promise<FileNodeData[]> {
  if (currentDepth > maxDepth) return []
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    const nodes: FileNodeData[] = []

    for (const entry of entries) {
      if (IGNORED_NAMES.has(entry.name) || entry.name.startsWith('.DS_Store')) {
        continue
      }
      const fullPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        const children = await scanDirectory(fullPath, maxDepth, currentDepth + 1)
        nodes.push({
          name: entry.name,
          path: fullPath,
          isDirectory: true,
          children,
        })
      } else {
        const ext = path.extname(entry.name).toLowerCase()
        try {
          const stat = await fs.promises.stat(fullPath)
          nodes.push({
            name: entry.name,
            path: fullPath,
            isDirectory: false,
            extension: ext,
            size: stat.size,
            modifiedTime: stat.mtimeMs,
          })
        } catch {
          nodes.push({
            name: entry.name,
            path: fullPath,
            isDirectory: false,
            extension: ext,
          })
        }
      }
    }

    // Sort: directories first, then files alphabetically
    return nodes.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) {
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      }
      return a.isDirectory ? -1 : 1
    })
  } catch (err) {
    console.error(`Error scanning directory: ${dirPath}`, err)
    return []
  }
}

ipcMain.handle('fs:listDirectory', async (_, dirPath: string) => {
  if (!dirPath || !fs.existsSync(dirPath)) return []
  return await scanDirectory(dirPath)
})

ipcMain.handle('fs:readFile', async (_, filePath: string) => {
  try {
    const stat = await fs.promises.stat(filePath)
    const content = await fs.promises.readFile(filePath, 'utf-8')
    return {
      success: true,
      content,
      size: stat.size,
      modifiedTime: stat.mtimeMs,
      path: filePath,
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || '文件读取失败',
    }
  }
})

ipcMain.handle('fs:saveFile', async (_, filePath: string, content: string) => {
  try {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true })
    }
    await fs.promises.writeFile(filePath, content, 'utf-8')
    const stat = await fs.promises.stat(filePath)
    return {
      success: true,
      size: stat.size,
      modifiedTime: stat.mtimeMs,
      path: filePath,
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || '文件保存失败',
    }
  }
})

interface SearchMatchResult {
  file: string
  relativePath: string
  line: number
  lineContent: string
  match: string
  preview: string
}

async function searchInDirectory(
  baseDir: string,
  currentDir: string,
  query: string,
  options: { caseSensitive?: boolean; regex?: boolean } = {}
): Promise<SearchMatchResult[]> {
  const results: SearchMatchResult[] = []
  if (!query) return results

  const { caseSensitive = false, regex = false } = options
  let matchRegex: RegExp

  try {
    if (regex) {
      matchRegex = new RegExp(query, caseSensitive ? 'g' : 'gi')
    } else {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      matchRegex = new RegExp(escaped, caseSensitive ? 'g' : 'gi')
    }
  } catch {
    return results
  }

  async function walk(dir: string) {
    let entries: fs.Dirent[] = []
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (IGNORED_NAMES.has(entry.name)) continue
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        await walk(fullPath)
      } else {
        const ext = path.extname(entry.name).toLowerCase()
        // Only search markdown, text, code files
        if (!['.md', '.markdown', '.txt', '.json'].includes(ext)) {
          continue
        }

        try {
          const content = await fs.promises.readFile(fullPath, 'utf-8')
          const lines = content.split('\n')
          const relativePath = path.relative(baseDir, fullPath)

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            if (matchRegex.test(line)) {
              results.push({
                file: fullPath,
                relativePath,
                line: i + 1,
                lineContent: line.trim(),
                match: query,
                preview: line.slice(0, 150),
              })
              if (results.length >= 200) return // Cap to 200 matches for high performance
            }
          }
        } catch {
          // ignore unreadable files
        }
      }
    }
  }

  await walk(currentDir)
  return results
}

ipcMain.handle('fs:searchWorkspace', async (_, dirPath: string, query: string, options?: any) => {
  if (!dirPath || !query || !fs.existsSync(dirPath)) return []
  return await searchInDirectory(dirPath, dirPath, query, options)
})

ipcMain.handle('fs:showInExplorer', async (_, targetPath: string) => {
  if (!targetPath) return
  try {
    if (fs.existsSync(targetPath)) {
      shell.showItemInFolder(targetPath)
    }
  } catch (err) {
    console.error('Failed to show item in explorer:', err)
  }
})

// Workspace Watcher
let watchDebounceTimer: NodeJS.Timeout | null = null

ipcMain.handle('fs:watchWorkspace', async (_, dirPath: string) => {
  if (currentWatcher) {
    await currentWatcher.close()
    currentWatcher = null
  }

  if (!dirPath || !fs.existsSync(dirPath)) return false

  try {
    currentWatcher = chokidar.watch(dirPath, {
      ignored: /(^|[\/\\])\..|node_modules|dist|dist-electron|target|\.git/,
      persistent: true,
      ignoreInitial: true,
      depth: 5,
    })

    const notifyChange = (event: string, filePath: string) => {
      if (watchDebounceTimer) clearTimeout(watchDebounceTimer)
      watchDebounceTimer = setTimeout(() => {
        mainWindow?.webContents.send('workspace:changed', {
          event,
          path: filePath,
        })
      }, 300)
    }

    currentWatcher
      .on('add', (p) => notifyChange('add', p))
      .on('change', (p) => notifyChange('change', p))
      .on('unlink', (p) => notifyChange('unlink', p))
      .on('addDir', (p) => notifyChange('addDir', p))
      .on('unlinkDir', (p) => notifyChange('unlinkDir', p))

    return true
  } catch (err) {
    console.error('Failed to start chokidar watcher:', err)
    return false
  }
})

ipcMain.handle('fs:unwatchWorkspace', async () => {
  if (currentWatcher) {
    await currentWatcher.close()
    currentWatcher = null
  }
  return true
})

// Configuration IPC
ipcMain.handle('config:get', (_, key: string, defaultValue?: any) => {
  return inMemoryConfig[key] !== undefined ? inMemoryConfig[key] : defaultValue
})

ipcMain.handle('config:set', (_, key: string, value: any) => {
  inMemoryConfig[key] = value
  saveConfig(inMemoryConfig)
  return true
})

ipcMain.handle('config:getAll', () => {
  return inMemoryConfig
})

ipcMain.handle('config:setAll', (_, newConfig: Record<string, any>) => {
  inMemoryConfig = { ...inMemoryConfig, ...newConfig }
  saveConfig(inMemoryConfig)
  return true
})

// Window Controls & State IPC
ipcMain.handle('window:new', (_, pathParam?: string) => {
  createWindow(pathParam)
  return true
})

ipcMain.handle('window:minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow
  win?.minimize()
})

ipcMain.handle('window:maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow
  if (!win) return
  if (win.isMaximized()) {
    win.unmaximize()
  } else {
    win.maximize()
  }
})

ipcMain.handle('window:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow
  if (!win) return
  if (allWindows.size > 1) {
    win.close()
    return
  }
  const pref = inMemoryConfig['closePreference']
  if (pref === 'minimize-to-tray') {
    win.hide()
  } else if (pref === 'exit') {
    quitApp()
  } else {
    win.webContents.send('app:confirm-close')
  }
})

ipcMain.handle('window:isMaximized', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow
  return win?.isMaximized() ?? false
})

ipcMain.handle('app:restart', () => {
  app.relaunch()
  app.exit(0)
})

ipcMain.handle('app:zoomIn', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow
  if (win) {
    win.webContents.setZoomLevel(win.webContents.getZoomLevel() + 0.5)
  }
})

ipcMain.handle('app:zoomOut', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow
  if (win) {
    win.webContents.setZoomLevel(win.webContents.getZoomLevel() - 0.5)
  }
})

ipcMain.handle('app:zoomReset', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow
  if (win) {
    win.webContents.setZoomLevel(0)
  }
})

// App Close Preference IPC
ipcMain.handle('app:getClosePreference', () => {
  return inMemoryConfig['closePreference'] || null
})

ipcMain.handle('app:setClosePreference', (_, pref: string) => {
  inMemoryConfig['closePreference'] = pref
  saveConfig(inMemoryConfig)
  return true
})

ipcMain.handle('app:performCloseAction', (_, { action, remember }: { action: 'minimize-to-tray' | 'exit'; remember?: boolean }) => {
  if (remember) {
    inMemoryConfig['closePreference'] = action
    saveConfig(inMemoryConfig)
  }
  if (action === 'minimize-to-tray') {
    mainWindow?.hide()
  } else if (action === 'exit') {
    quitApp()
  }
  return true
})

ipcMain.handle('server:getLanInfo', () => {
  const lanIp = getLanIpAddress()
  return {
    lanIp,
    port: 9527,
    lanUrl: `http://${lanIp}:9527/md-view`,
  }
})

ipcMain.handle('server:getWorkspaceConfig', () => {
  return getWorkspaceConfig()
})

ipcMain.handle('server:getStatus', () => {
  return getServerStatus()
})

ipcMain.handle('server:start', async () => {
  try {
    if (!isHttpServerRunning()) {
      await startHttpServer()
    }
    setLanSharing(true)
    inMemoryConfig['lanServerEnabled'] = true
    saveConfig(inMemoryConfig)
    return { success: true, running: true, status: getServerStatus() }
  } catch (err: any) {
    return { success: false, running: isLanSharingEnabled(), error: err.message || String(err), status: getServerStatus() }
  }
})

ipcMain.handle('server:stop', async () => {
  try {
    setLanSharing(false)
    inMemoryConfig['lanServerEnabled'] = false
    saveConfig(inMemoryConfig)
    return { success: true, running: false, status: getServerStatus() }
  } catch (err: any) {
    return { success: false, running: isLanSharingEnabled(), error: err.message || String(err), status: getServerStatus() }
  }
})

ipcMain.handle('server:toggle', async (_, targetState?: boolean) => {
  try {
    if (!isHttpServerRunning()) {
      await startHttpServer()
    }
    const isRunning = isLanSharingEnabled()
    const shouldRun = typeof targetState === 'boolean' ? targetState : !isRunning
    setLanSharing(shouldRun)
    if (shouldRun) {
      clearAllCache()
    }
    inMemoryConfig['lanServerEnabled'] = shouldRun
    saveConfig(inMemoryConfig)
    return { success: true, running: shouldRun, reloaded: shouldRun, status: getServerStatus() }
  } catch (err: any) {
    return { success: false, running: isLanSharingEnabled(), error: err.message || String(err), status: getServerStatus() }
  }
})

// App Lifecycle
app.whenReady().then(async () => {
  // Register callbacks for embedded server
  setServerOptions({
    port: 9527,
    onDirectoryPick: async () => {
      if (!mainWindow) return null
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: '选择 Markdown 工作目录',
      })
      if (result.canceled || result.filePaths.length === 0) {
        return null
      }
      return result.filePaths[0]
    },
    onMinimize: () => {
      mainWindow?.minimize()
    },
    onMaximize: () => {
      if (!mainWindow) return false
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
        return false
      } else {
        mainWindow.maximize()
        return true
      }
    },
    onClose: (action?: 'minimize-to-tray' | 'exit', remember?: boolean) => {
      if (remember && action) {
        inMemoryConfig['closePreference'] = action
        saveConfig(inMemoryConfig)
      }
      const pref = action || inMemoryConfig['closePreference']
      if (pref === 'minimize-to-tray') {
        mainWindow?.hide()
      } else if (pref === 'exit') {
        quitApp()
      } else {
        mainWindow?.webContents.send('app:confirm-close')
      }
    },
    getClosePreference: () => inMemoryConfig['closePreference'] || null,
    isMaximized: () => mainWindow?.isMaximized() ?? false,
    onNewWindow: (pathParam?: string) => {
      createWindow(pathParam)
    },
    onRestart: () => {
      app.relaunch()
      app.exit(0)
    },
  })

  // Start embedded LAN HTTP sharing server (port 9527) and apply sharing preference
  const lanServerEnabled = inMemoryConfig['lanServerEnabled'] !== false
  setLanSharing(lanServerEnabled)
  try {
    await startHttpServer()
  } catch (err) {
    console.error('Failed to start HTTP server on launch:', err)
  }

  createTray()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      showMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    stopHttpServer()
    app.quit()
  }
})

