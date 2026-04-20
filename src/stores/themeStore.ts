import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Theme } from '@/types'

interface ThemeState {
  theme: Theme
  actualTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: 'light' | 'dark') {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(theme)
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      actualTheme: getSystemTheme(),

      setTheme: (theme: Theme) => {
        const actualTheme = theme === 'system' ? getSystemTheme() : theme
        applyTheme(actualTheme)
        set({ theme, actualTheme })
      },
    }),
    {
      name: 'md-preview-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const actualTheme = state.theme === 'system' ? getSystemTheme() : state.theme
          applyTheme(actualTheme)
          state.actualTheme = actualTheme
        }
      },
    }
  )
)

if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const state = useThemeStore.getState()
    if (state.theme === 'system') {
      const actualTheme = getSystemTheme()
      applyTheme(actualTheme)
      useThemeStore.setState({ actualTheme })
    }
  })
}
