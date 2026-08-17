import React, { useState, useEffect, useCallback } from 'react'
import { TitleBar } from '@/components/Layout/TitleBar'
import { TabBar } from '@/components/Layout/TabBar'
import { FileTree } from '@/components/FileTree/FileTree'
import { MarkdownView } from '@/components/Markdown/MarkdownView'
import { TocSidebar } from '@/components/Markdown/TocSidebar'
import { GlobalSearchModal } from '@/components/Search/GlobalSearchModal'
import { SettingsModal } from '@/components/Settings/SettingsModal'
import { CloseConfirmModal } from '@/components/Layout/CloseConfirmModal'
import { useConfigStore } from '@/stores/configStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabsStore } from '@/stores/tabsStore'

export default function App() {
  const { loadConfig, settings, isLoaded } = useConfigStore()
  const { currentWorkspace, setWorkspace, pickAndOpenWorkspace } = useWorkspaceStore()
  const {
    tabs,
    activeTabId,
    getActiveTab,
    openFile,
    closeTab,
    saveActiveTab,
    selectTabByIndex,
    nextTab,
    prevTab,
  } = useTabsStore()

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isTocOpen, setIsTocOpen] = useState(true)
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isCloseConfirmModalOpen, setIsCloseConfirmModalOpen] = useState(false)
  const [isDraggingFileOver, setIsDraggingFileOver] = useState(false)

  // 1. Load initial settings
  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  // 2. Listen to electron close confirmation
  useEffect(() => {
    if (window.electronAPI?.onConfirmClose) {
      const cleanup = window.electronAPI.onConfirmClose(() => {
        setIsCloseConfirmModalOpen(true)
      })
      return cleanup
    }
  }, [])

  // 3. Load last workspace if available on startup
  useEffect(() => {
    if (isLoaded && !currentWorkspace && settings.lastWorkspace) {
      setWorkspace(settings.lastWorkspace, true)
    }
  }, [isLoaded, currentWorkspace, settings.lastWorkspace, setWorkspace])


  // 3. Global Keyboard Shortcuts
  const handleGlobalKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ctrl+O: Open directory
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o' && !e.shiftKey) {
        e.preventDefault()
        pickAndOpenWorkspace()
        return
      }

      // Ctrl+S: Save file
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault()
        saveActiveTab()
        return
      }

      // Ctrl+W: Close tab
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault()
        if (activeTabId) {
          closeTab(activeTabId)
        }
        return
      }

      // Ctrl+Shift+F or Ctrl+P: Global Search
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p')
      ) {
        e.preventDefault()
        setIsSearchModalOpen(true)
        return
      }

      // Ctrl+B: Toggle Sidebar
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setIsSidebarOpen((prev) => !prev)
        return
      }

      // Ctrl+Shift+T: Toggle TOC Outline
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault()
        setIsTocOpen((prev) => !prev)
        return
      }

      // Ctrl+1 ~ Ctrl+9: Switch to Tab
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const index = parseInt(e.key, 10) - 1
        selectTabByIndex(index)
        return
      }

      // Ctrl+Tab / Ctrl+Shift+Tab: Cycle tabs
      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
        e.preventDefault()
        if (e.shiftKey) {
          prevTab()
        } else {
          nextTab()
        }
        return
      }
    },
    [
      pickAndOpenWorkspace,
      saveActiveTab,
      activeTabId,
      closeTab,
      selectTabByIndex,
      nextTab,
      prevTab,
    ]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleGlobalKeyDown])

  // 4. File Drag and Drop Support
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingFileOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingFileOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingFileOver(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        // In electron, file.path is the native file path
        const filePath = (file as any).path
        if (filePath) {
          await openFile(filePath)
        } else {
          // Web fallback
          const text = await file.text()
          await openFile(`virtual://${file.name}`, file.name, text)
        }
      }
    }
  }

  const activeTab = getActiveTab()

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden font-sans select-none relative"
    >
      {/* 1. Title Bar */}
      <TitleBar
        onOpenGlobalSearch={() => setIsSearchModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onToggleToc={() => setIsTocOpen((prev) => !prev)}
        isTocOpen={isTocOpen}
      />

      {/* 2. Tab Bar */}
      <TabBar />

      {/* 3. Main Workspace Split Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Collapsible File Tree Sidebar */}
        {isSidebarOpen && (
          <aside className="w-64 h-full flex-shrink-0">
            <FileTree />
          </aside>
        )}

        {/* Center: Dynamic Markdown View */}
        <main className="flex-1 h-full overflow-hidden bg-[var(--codex-editor)]">
          <MarkdownView tab={activeTab} />
        </main>

        {/* Right: TOC Outline Sidebar */}
        <TocSidebar
          content={activeTab?.content || ''}
          isOpen={isTocOpen && Boolean(activeTab)}
          onClose={() => setIsTocOpen(false)}
        />
      </div>

      {/* Drag & Drop Overlay */}
      {isDraggingFileOver && (
        <div className="absolute inset-0 bg-sky-500/20 backdrop-blur-sm border-2 border-dashed border-sky-400 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-card px-6 py-4 rounded-xl shadow-2xl border border-sky-400 text-center space-y-1">
            <p className="text-sm font-semibold text-sky-400">松开以打开 Markdown 文件</p>
            <p className="text-xs text-muted-foreground">支持直接拖拽单个或多个文档</p>
          </div>
        </div>
      )}

      {/* 4. Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
      />

      {/* 5. Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      {/* 6. Close Confirmation Modal */}
      <CloseConfirmModal
        isOpen={isCloseConfirmModalOpen}
        onClose={() => setIsCloseConfirmModalOpen(false)}
      />
    </div>
  )
}

