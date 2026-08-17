import type { FileNode, SearchResult } from './index'

export interface ElectronAPI {
  pickDirectory: () => Promise<string | null>
  listDirectory: (dirPath: string) => Promise<FileNode[]>
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; size?: number; modifiedTime?: number; error?: string }>
  saveFile: (filePath: string, content: string) => Promise<{ success: boolean; size?: number; modifiedTime?: number; error?: string }>
  searchWorkspace: (
    dirPath: string,
    query: string,
    options?: { caseSensitive?: boolean; regex?: boolean }
  ) => Promise<SearchResult[]>
  showInExplorer: (targetPath: string) => Promise<void>
  watchWorkspace: (dirPath: string) => Promise<boolean>
  unwatchWorkspace: () => Promise<boolean>
  onWorkspaceChange: (callback: (data: { event: string; path: string }) => void) => () => void
  getConfig: (key: string, defaultValue?: any) => Promise<any>
  setConfig: (key: string, value: any) => Promise<boolean>
  getAllConfig: () => Promise<Record<string, any>>
  setAllConfig: (config: Record<string, any>) => Promise<boolean>
  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  isMaximized: () => Promise<boolean>
  getClosePreference: () => Promise<string | null>
  setClosePreference: (pref: string) => Promise<boolean>
  performCloseAction: (action: 'minimize-to-tray' | 'exit', remember?: boolean) => Promise<boolean>
  onConfirmClose: (callback: () => void) => () => void
  onMaximizeChange: (callback: (isMax: boolean) => void) => () => void
  getLanInfo?: () => Promise<{ lanIp: string; port: number; lanUrl: string }>
  getServerWorkspaceConfig?: () => Promise<any>
  platform: string
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

