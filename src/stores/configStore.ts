import { create } from 'zustand'
import type { AppSettings, Theme } from '@/types'

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  codeTheme: 'github-dark',
  fontSize: 15,
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  splitRatio: 50,
  defaultViewMode: 'split',
  recentWorkspaces: [],
  autoSave: false,
  autoSaveDelay: 1000,
  sidebarWidth: 260,
  showToc: true,
  tocWidth: 240,
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyThemeClass(theme: Theme): 'light' | 'dark' {
  const resolved = theme === 'system' ? getSystemTheme() : theme
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(resolved)
  }
  return resolved
}

interface ConfigState {
  settings: AppSettings
  resolvedTheme: 'light' | 'dark'
  isLoaded: boolean
  loadConfig: () => Promise<void>
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  setTheme: (theme: Theme) => Promise<void>
  addRecentWorkspace: (workspacePath: string) => Promise<void>
  removeRecentWorkspace: (workspacePath: string) => Promise<void>
  clearRecentWorkspaces: () => Promise<void>
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  resolvedTheme: getSystemTheme(),
  isLoaded: false,

  loadConfig: async () => {
    try {
      let loaded: Partial<AppSettings> = {}
      if (window.electronAPI?.getAllConfig) {
        loaded = (await window.electronAPI.getAllConfig()) || {}
      } else {
        const local = localStorage.getItem('app-settings')
        if (local) loaded = JSON.parse(local)
      }

      const merged = { ...DEFAULT_SETTINGS, ...loaded }
      const resolved = applyThemeClass(merged.theme)

      set({ settings: merged, resolvedTheme: resolved, isLoaded: true })
    } catch (err) {
      console.error('Failed to load initial config:', err)
      const resolved = applyThemeClass(DEFAULT_SETTINGS.theme)
      set({ settings: DEFAULT_SETTINGS, resolvedTheme: resolved, isLoaded: true })
    }
  },

  updateSettings: async (partial: Partial<AppSettings>) => {
    const current = get().settings
    const updated = { ...current, ...partial }

    let resolved = get().resolvedTheme
    if (partial.theme !== undefined) {
      resolved = applyThemeClass(partial.theme)
    }

    set({ settings: updated, resolvedTheme: resolved })

    try {
      if (window.electronAPI?.setAllConfig) {
        await window.electronAPI.setAllConfig(updated)
      } else {
        localStorage.setItem('app-settings', JSON.stringify(updated))
      }
    } catch (err) {
      console.error('Failed to persist settings:', err)
    }
  },

  setTheme: async (theme: Theme) => {
    await get().updateSettings({ theme })
  },

  addRecentWorkspace: async (workspacePath: string) => {
    if (!workspacePath) return
    const currentRecents = get().settings.recentWorkspaces || []
    const filtered = currentRecents.filter((p) => p !== workspacePath)
    const updated = [workspacePath, ...filtered].slice(0, 10)
    await get().updateSettings({ recentWorkspaces: updated, lastWorkspace: workspacePath })
  },

  removeRecentWorkspace: async (workspacePath: string) => {
    const currentRecents = get().settings.recentWorkspaces || []
    const updated = currentRecents.filter((p) => p !== workspacePath)
    await get().updateSettings({ recentWorkspaces: updated })
  },

  clearRecentWorkspaces: async () => {
    await get().updateSettings({ recentWorkspaces: [] })
  },
}))

// Listen to system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { settings } = useConfigStore.getState()
    if (settings.theme === 'system') {
      const resolved = applyThemeClass('system')
      useConfigStore.setState({ resolvedTheme: resolved })
    }
  })
}
