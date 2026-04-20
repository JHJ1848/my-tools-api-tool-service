import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FileNode } from '@/types'
import { config } from '@/lib/config'

interface FileState {
  currentPath: string
  files: FileNode[]
  recentFiles: string[]
  expandedFolders: Record<string, boolean>
  isLoading: boolean
  error: string | null
  setCurrentPath: (path: string) => void
  setFiles: (files: FileNode[]) => void
  addRecentFile: (path: string) => void
  toggleFolder: (path: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useFileStore = create<FileState>()(
  persist(
    (set, get) => ({
      currentPath: config.basePath,
      files: [],
      recentFiles: [],
      expandedFolders: {},
      isLoading: false,
      error: null,

      setCurrentPath: (path: string) => set({ currentPath: path }),

      setFiles: (files: FileNode[]) => set({ files }),

      addRecentFile: (path: string) => {
        const state = get()
        const filtered = state.recentFiles.filter(f => f !== path)
        const updated = [path, ...filtered].slice(0, config.maxRecentFiles)
        set({ recentFiles: updated })
      },

      toggleFolder: (path: string) => {
        const state = get()
        set({
          expandedFolders: {
            ...state.expandedFolders,
            [path]: !state.expandedFolders[path],
          },
        })
      },

      setLoading: (loading: boolean) => set({ isLoading: loading }),

      setError: (error: string | null) => set({ error }),
    }),
    {
      name: 'md-preview-files',
    }
  )
)
