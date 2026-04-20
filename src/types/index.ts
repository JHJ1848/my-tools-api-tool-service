export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
  extension?: string
  size?: number
  modifiedTime?: Date
}

export interface Tab {
  id: string
  path: string
  name: string
  content?: string
  isActive: boolean
  isPinned?: boolean
  scrollPosition?: number
}

export interface SearchResult {
  file: string
  line: number
  content: string
  match: string
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  sidebarWidth: number
  showSidebar: boolean
  fontSize: number
}

export type Theme = 'light' | 'dark' | 'system'
