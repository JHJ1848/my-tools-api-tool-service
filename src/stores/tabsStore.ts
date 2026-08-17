import { create } from 'zustand'
import type { Tab, ViewMode } from '@/types'
import { useConfigStore } from './configStore'

const MAX_TABS = 9

interface TabsState {
  tabs: Tab[]
  activeTabId: string | null
  getActiveTab: () => Tab | undefined
  openFile: (filePath: string, customName?: string, customContent?: string) => Promise<void>
  closeTab: (id: string, force?: boolean) => boolean
  closeOtherTabs: (id: string) => void
  closeAllTabs: () => void
  setActiveTab: (id: string) => void
  updateContent: (id: string, content: string) => void
  saveTab: (id: string) => Promise<boolean>
  saveActiveTab: () => Promise<boolean>
  togglePinTab: (id: string) => void
  updateScrollRatio: (id: string, scrollRatio: number) => void
  setViewMode: (id: string, mode: ViewMode) => void
  selectTabByIndex: (index: number) => void
  nextTab: () => void
  prevTab: () => void
}

function getFileName(filePath: string): string {
  const parts = filePath.split(/[/\\]/)
  return parts[parts.length - 1] || filePath
}

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  getActiveTab: () => {
    const { tabs, activeTabId } = get()
    return tabs.find((t) => t.id === activeTabId)
  },

  openFile: async (filePath: string, customName?: string, customContent?: string) => {
    const { tabs } = get()
    const now = Date.now()
    const existing = tabs.find((t) => t.path === filePath)

    if (existing) {
      set({
        activeTabId: existing.id,
        tabs: tabs.map((t) => (t.id === existing.id ? { ...t, lastAccessedAt: now } : t)),
      })
      return
    }

    let fileContent = customContent ?? ''
    if (customContent === undefined) {
      try {
        if (window.electronAPI?.readFile) {
          const res = await window.electronAPI.readFile(filePath)
          if (res.success && res.content !== undefined) {
            fileContent = res.content
          }
        }
      } catch (err) {
        console.error('Failed to read file:', err)
      }
    }

    const defaultMode = useConfigStore.getState().settings.defaultViewMode || 'split'
    const newTab: Tab = {
      id: crypto.randomUUID ? crypto.randomUUID() : `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      path: filePath,
      name: customName || getFileName(filePath),
      content: fileContent,
      originalContent: fileContent,
      isDirty: false,
      isPinned: false,
      scrollRatio: 0,
      viewMode: defaultMode,
      lastAccessedAt: now,
    }

    let currentTabs = [...tabs]

    // LRU eviction if reaching MAX_TABS limit (9 tabs)
    if (currentTabs.length >= MAX_TABS) {
      // Find oldest unpinned tab
      const unpinnedTabs = currentTabs.filter((t) => !t.isPinned)
      if (unpinnedTabs.length > 0) {
        unpinnedTabs.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)
        const victim = unpinnedTabs[0]
        currentTabs = currentTabs.filter((t) => t.id !== victim.id)
      } else {
        // If all are pinned, remove oldest pinned
        currentTabs.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)
        currentTabs.shift()
      }
    }

    currentTabs.push(newTab)
    set({
      tabs: currentTabs,
      activeTabId: newTab.id,
    })
  },

  closeTab: (id: string, force: boolean = false): boolean => {
    const { tabs, activeTabId } = get()
    const targetTab = tabs.find((t) => t.id === id)
    if (!targetTab) return false

    if (!force && targetTab.isDirty) {
      const confirmClose = window.confirm(`文件 "${targetTab.name}" 尚未保存，确定要关闭吗？`)
      if (!confirmClose) return false
    }

    const index = tabs.findIndex((t) => t.id === id)
    const nextTabs = tabs.filter((t) => t.id !== id)

    let nextActiveId = activeTabId
    if (activeTabId === id) {
      if (nextTabs.length > 0) {
        const nextIndex = Math.min(index, nextTabs.length - 1)
        nextActiveId = nextTabs[nextIndex].id
      } else {
        nextActiveId = null
      }
    }

    set({
      tabs: nextTabs,
      activeTabId: nextActiveId,
    })
    return true
  },

  closeOtherTabs: (id: string) => {
    const { tabs } = get()
    const remaining = tabs.filter((t) => t.id === id || t.isPinned)
    set({
      tabs: remaining,
      activeTabId: id,
    })
  },

  closeAllTabs: () => {
    const { tabs } = get()
    const pinnedOnly = tabs.filter((t) => t.isPinned)
    set({
      tabs: pinnedOnly,
      activeTabId: pinnedOnly.length > 0 ? pinnedOnly[0].id : null,
    })
  },

  setActiveTab: (id: string) => {
    const { tabs } = get()
    const now = Date.now()
    set({
      activeTabId: id,
      tabs: tabs.map((t) => (t.id === id ? { ...t, lastAccessedAt: now } : t)),
    })
  },

  updateContent: (id: string, content: string) => {
    const { tabs } = get()
    const now = Date.now()
    set({
      tabs: tabs.map((t) => {
        if (t.id !== id) return t
        return {
          ...t,
          content,
          isDirty: content !== t.originalContent,
          lastAccessedAt: now,
        }
      }),
    })
  },

  saveTab: async (id: string): Promise<boolean> => {
    const { tabs } = get()
    const tab = tabs.find((t) => t.id === id)
    if (!tab) return false

    try {
      if (window.electronAPI?.saveFile) {
        const res = await window.electronAPI.saveFile(tab.path, tab.content)
        if (res.success) {
          set({
            tabs: tabs.map((t) =>
              t.id === id
                ? {
                    ...t,
                    originalContent: tab.content,
                    isDirty: false,
                  }
                : t
            ),
          })
          return true
        }
      }
      return false
    } catch (err) {
      console.error('Failed to save tab:', err)
      return false
    }
  },

  saveActiveTab: async (): Promise<boolean> => {
    const activeTab = get().getActiveTab()
    if (!activeTab) return false
    return await get().saveTab(activeTab.id)
  },

  togglePinTab: (id: string) => {
    const { tabs } = get()
    set({
      tabs: tabs.map((t) => (t.id === id ? { ...t, isPinned: !t.isPinned } : t)),
    })
  },

  updateScrollRatio: (id: string, scrollRatio: number) => {
    const { tabs } = get()
    set({
      tabs: tabs.map((t) => (t.id === id ? { ...t, scrollRatio } : t)),
    })
  },

  setViewMode: (id: string, mode: ViewMode) => {
    const { tabs } = get()
    set({
      tabs: tabs.map((t) => (t.id === id ? { ...t, viewMode: mode } : t)),
    })
  },

  selectTabByIndex: (index: number) => {
    const { tabs } = get()
    if (index >= 0 && index < tabs.length) {
      get().setActiveTab(tabs[index].id)
    }
  },

  nextTab: () => {
    const { tabs, activeTabId } = get()
    if (tabs.length <= 1 || !activeTabId) return
    const idx = tabs.findIndex((t) => t.id === activeTabId)
    const nextIdx = (idx + 1) % tabs.length
    get().setActiveTab(tabs[nextIdx].id)
  },

  prevTab: () => {
    const { tabs, activeTabId } = get()
    if (tabs.length <= 1 || !activeTabId) return
    const idx = tabs.findIndex((t) => t.id === activeTabId)
    const prevIdx = (idx - 1 + tabs.length) % tabs.length
    get().setActiveTab(tabs[prevIdx].id)
  },
}))
