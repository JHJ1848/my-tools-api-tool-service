import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  // File System
  pickDirectory: () => ipcRenderer.invoke('fs:pickDirectory'),
  listDirectory: (dirPath: string) => ipcRenderer.invoke('fs:listDirectory', dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  saveFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:saveFile', filePath, content),
  searchWorkspace: (dirPath: string, query: string, options?: { caseSensitive?: boolean; regex?: boolean }) =>
    ipcRenderer.invoke('fs:searchWorkspace', dirPath, query, options),
  showInExplorer: (targetPath: string) => ipcRenderer.invoke('fs:showInExplorer', targetPath),
  watchWorkspace: (dirPath: string) => ipcRenderer.invoke('fs:watchWorkspace', dirPath),
  unwatchWorkspace: () => ipcRenderer.invoke('fs:unwatchWorkspace'),
  onWorkspaceChange: (callback: (data: { event: string; path: string }) => void) => {
    const handler = (_: any, data: { event: string; path: string }) => callback(data)
    ipcRenderer.on('workspace:changed', handler)
    return () => {
      ipcRenderer.removeListener('workspace:changed', handler)
    }
  },

  // Configuration
  getConfig: (key: string, defaultValue?: any) => ipcRenderer.invoke('config:get', key, defaultValue),
  setConfig: (key: string, value: any) => ipcRenderer.invoke('config:set', key, value),
  getAllConfig: () => ipcRenderer.invoke('config:getAll'),
  setAllConfig: (config: Record<string, any>) => ipcRenderer.invoke('config:setAll', config),

  // Window Controls & Lifecycle
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  getClosePreference: () => ipcRenderer.invoke('app:getClosePreference'),
  setClosePreference: (pref: string) => ipcRenderer.invoke('app:setClosePreference', pref),
  performCloseAction: (action: 'minimize-to-tray' | 'exit', remember?: boolean) =>
    ipcRenderer.invoke('app:performCloseAction', { action, remember }),
  onConfirmClose: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('app:confirm-close', handler)
    return () => {
      ipcRenderer.removeListener('app:confirm-close', handler)
    }
  },
  onMaximizeChange: (callback: (isMax: boolean) => void) => {
    const handler = (_: any, isMax: boolean) => callback(isMax)
    ipcRenderer.on('window:maximize-change', handler)
    return () => {
      ipcRenderer.removeListener('window:maximize-change', handler)
    }
  },

  // Server & LAN
  getLanInfo: () => ipcRenderer.invoke('server:getLanInfo'),
  getServerWorkspaceConfig: () => ipcRenderer.invoke('server:getWorkspaceConfig'),

  // Platform
  platform: process.platform,
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

