import { create } from 'zustand'
import type { FileNode } from '@/types'
import { useConfigStore } from './configStore'
import { useTabsStore } from './tabsStore'

interface WorkspaceState {
  currentWorkspace: string | null
  fileTree: FileNode[]
  expandedPaths: Set<string>
  searchFilter: string
  selectedPath: string | null
  isLoading: boolean
  error: string | null
  isWatching: boolean

  setWorkspace: (dirPath: string, autoOpenFirst?: boolean) => Promise<void>
  pickAndOpenWorkspace: () => Promise<string | null>
  refreshWorkspace: () => Promise<void>
  toggleFolder: (folderPath: string) => void
  expandFolder: (folderPath: string) => void
  collapseFolder: (folderPath: string) => void
  expandAll: () => void
  collapseAll: () => void
  setSearchFilter: (filter: string) => void
  setSelectedPath: (path: string | null) => void
  setupWatcher: () => void
}

let watcherCleanup: (() => void) | null = null

/**
 * 递归收集所有文件夹路径
 */
function collectAllFolderPaths(nodes: FileNode[], set: Set<string>) {
  for (const node of nodes) {
    if (node.isDirectory) {
      set.add(node.path)
      if (node.children) {
        collectAllFolderPaths(node.children, set)
      }
    }
  }
}

/**
 * 递归深度优先查找首篇 Markdown 文件
 */
function findFirstMarkdownFile(nodes: FileNode[]): string | null {
  for (const node of nodes) {
    if (!node.isDirectory) {
      const ext = (node.extension || '').toLowerCase()
      if (['.md', '.markdown', '.mdown'].includes(ext)) {
        return node.path
      }
    } else if (node.children && node.children.length > 0) {
      const found = findFirstMarkdownFile(node.children)
      if (found) return found
    }
  }
  return null
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  currentWorkspace: null,
  fileTree: [],
  expandedPaths: new Set<string>(),
  searchFilter: '',
  selectedPath: null,
  isLoading: false,
  error: null,
  isWatching: false,

  setWorkspace: async (dirPath: string, autoOpenFirst: boolean = true) => {
    if (!dirPath) return
    set({ currentWorkspace: dirPath, isLoading: true, error: null })

    try {
      let nodes: FileNode[] = []
      if (window.electronAPI?.listDirectory) {
        nodes = await window.electronAPI.listDirectory(dirPath)
      }

      // Add to recent workspaces in config
      useConfigStore.getState().addRecentWorkspace(dirPath)

      // Auto-expand root folder
      const newExpanded = new Set<string>(get().expandedPaths)
      newExpanded.add(dirPath)

      set({
        fileTree: nodes,
        expandedPaths: newExpanded,
        isLoading: false,
      })

      // 若有 Markdown 文件且需要自动打开首篇
      if (autoOpenFirst && nodes.length > 0) {
        const firstMdPath = findFirstMarkdownFile(nodes)
        if (firstMdPath) {
          await useTabsStore.getState().openFile(firstMdPath)
        }
      }

      // Setup watcher
      get().setupWatcher()
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || '加载工作区失败',
      })
    }
  },

  pickAndOpenWorkspace: async () => {
    try {
      let selectedDir: string | null = null

      if (window.electronAPI?.pickDirectory) {
        selectedDir = await window.electronAPI.pickDirectory()
      } else {
        // Web fallback via HTTP API
        try {
          const resp = await fetch('/api/md/workspace-config/pick-directory', { method: 'POST' })
          const data = await resp.json()
          if (data?.config?.effectivePath && !data.cancelled) {
            selectedDir = data.config.effectivePath
          }
        } catch {
          // ignore
        }
      }

      if (selectedDir) {
        await get().setWorkspace(selectedDir, true)
        return selectedDir
      }
      return null
    } catch (err: any) {
      set({ error: err.message || '选择工作区失败' })
      return null
    }
  },


  refreshWorkspace: async () => {
    const { currentWorkspace } = get()
    if (!currentWorkspace) return

    try {
      if (window.electronAPI?.listDirectory) {
        const nodes = await window.electronAPI.listDirectory(currentWorkspace)
        set({ fileTree: nodes })
      }
    } catch (err: any) {
      console.error('Failed to refresh workspace:', err)
    }
  },

  toggleFolder: (folderPath: string) => {
    const expanded = new Set(get().expandedPaths)
    if (expanded.has(folderPath)) {
      expanded.delete(folderPath)
    } else {
      expanded.add(folderPath)
    }
    set({ expandedPaths: expanded })
  },

  expandFolder: (folderPath: string) => {
    const expanded = new Set(get().expandedPaths)
    expanded.add(folderPath)
    set({ expandedPaths: expanded })
  },

  collapseFolder: (folderPath: string) => {
    const expanded = new Set(get().expandedPaths)
    expanded.delete(folderPath)
    set({ expandedPaths: expanded })
  },

  expandAll: () => {
    const expanded = new Set<string>()
    if (get().currentWorkspace) expanded.add(get().currentWorkspace!)
    collectAllFolderPaths(get().fileTree, expanded)
    set({ expandedPaths: expanded })
  },

  collapseAll: () => {
    set({ expandedPaths: new Set<string>() })
  },

  setSearchFilter: (filter: string) => {
    set({ searchFilter: filter })
  },

  setSelectedPath: (path: string | null) => {
    set({ selectedPath: path })
  },

  setupWatcher: () => {
    const { currentWorkspace } = get()
    if (!currentWorkspace || !window.electronAPI?.watchWorkspace) return

    if (watcherCleanup) {
      watcherCleanup()
      watcherCleanup = null
    }

    window.electronAPI.watchWorkspace(currentWorkspace)
    watcherCleanup = window.electronAPI.onWorkspaceChange(() => {
      // Auto refresh tree on change event
      get().refreshWorkspace()
    })

    set({ isWatching: true })
  },
}))
