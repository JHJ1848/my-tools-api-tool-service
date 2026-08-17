export type Theme = 'light' | 'dark' | 'system'
export type ViewMode = 'preview' | 'source' | 'split'

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
  extension?: string
  size?: number
  modifiedTime?: number
}

export interface Tab {
  id: string
  path: string
  name: string
  content: string
  originalContent: string
  isDirty: boolean
  isPinned: boolean
  scrollRatio?: number
  viewMode?: ViewMode
  lastAccessedAt: number
}

export interface TOCItem {
  id: string
  text: string
  level: number
  line?: number
}

export interface SearchResult {
  file: string
  relativePath: string
  line: number
  lineContent: string
  match: string
  preview?: string
}

export interface AppSettings {
  theme: Theme
  codeTheme: string
  fontSize: number
  fontFamily: string
  splitRatio: number
  defaultViewMode: ViewMode
  recentWorkspaces: string[]
  autoSave: boolean
  autoSaveDelay: number
  sidebarWidth: number
  showToc: boolean
  tocWidth: number
  lastWorkspace?: string
}
