import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Tab } from '@/types'

interface TabsState {
  tabs: Tab[]
  activeTabId: string | null
  addTab: (path: string, name: string, content?: string) => void
  removeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateTabContent: (id: string, content: string) => void
  updateTabScroll: (id: string, position: number) => void
  togglePinTab: (id: string) => void
  clearTabs: () => void
}

export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,

      addTab: (path: string, name: string, content?: string) => {
        const state = get()
        const existingTab = state.tabs.find(t => t.path === path)

        if (existingTab) {
          set({ activeTabId: existingTab.id })
          return
        }

        const newTab: Tab = {
          id: crypto.randomUUID(),
          path,
          name,
          content,
          isActive: true,
        }

        const updatedTabs = state.tabs.map(t => ({ ...t, isActive: false }))
        updatedTabs.push(newTab)

        set({ tabs: updatedTabs, activeTabId: newTab.id })
      },

      removeTab: (id: string) => {
        const state = get()
        const tabIndex = state.tabs.findIndex(t => t.id === id)
        const newTabs = state.tabs.filter(t => t.id !== id)

        if (state.activeTabId === id && newTabs.length > 0) {
          const newActiveIndex = Math.min(tabIndex, newTabs.length - 1)
          newTabs[newActiveIndex].isActive = true
          set({ tabs: newTabs, activeTabId: newTabs[newActiveIndex].id })
        } else if (newTabs.length === 0) {
          set({ tabs: [], activeTabId: null })
        } else {
          set({ tabs: newTabs })
        }
      },

      setActiveTab: (id: string) => {
        const state = get()
        const updatedTabs = state.tabs.map(t => ({
          ...t,
          isActive: t.id === id,
        }))
        set({ tabs: updatedTabs, activeTabId: id })
      },

      updateTabContent: (id: string, content: string) => {
        const state = get()
        const updatedTabs = state.tabs.map(t =>
          t.id === id ? { ...t, content } : t
        )
        set({ tabs: updatedTabs })
      },

      updateTabScroll: (id: string, position: number) => {
        const state = get()
        const updatedTabs = state.tabs.map(t =>
          t.id === id ? { ...t, scrollPosition: position } : t
        )
        set({ tabs: updatedTabs })
      },

      togglePinTab: (id: string) => {
        const state = get()
        const updatedTabs = state.tabs.map(t =>
          t.id === id ? { ...t, isPinned: !t.isPinned } : t
        )
        set({ tabs: updatedTabs })
      },

      clearTabs: () => {
        set({ tabs: [], activeTabId: null })
      },
    }),
    {
      name: 'md-preview-tabs',
    }
  )
)
