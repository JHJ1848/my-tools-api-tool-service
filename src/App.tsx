import React, { useState, useCallback, useEffect } from 'react'
import { FileTree } from '@/components/FileTree/FileTree'
import { MarkdownPreview } from '@/components/Markdown/MarkdownPreview'
import { Header } from '@/components/Layout/Header'
import { Sidebar } from '@/components/Layout/Sidebar'
import { TabBar } from '@/components/Layout/TabBar'
import { useTabsStore } from '@/stores/tabsStore'
import { useFileStore } from '@/stores/fileStore'
import { useFileSystem } from '@/hooks/useFileSystem'
import { useThemeStore } from '@/stores/themeStore'

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentContent, setCurrentContent] = useState('')
  const { tabs, activeTabId, addTab, updateTabContent } = useTabsStore()
  const { addRecentFile } = useFileStore()
  const { readFile, isLoading, error } = useFileSystem()
  const { actualTheme } = useThemeStore()

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(actualTheme)
  }, [actualTheme])

  const openFile = useCallback(async (path: string) => {
    try {
      const content = await readFile(path)
      const fileName = path.split('\\').pop() || path.split('/').pop() || path

      addTab(path, fileName, content)
      setCurrentContent(content)
      addRecentFile(path)
    } catch (err) {
      console.error('Failed to open file:', err)
    }
  }, [readFile, addTab, addRecentFile])

  const handleTabChange = useCallback(async (path: string) => {
    const tab = tabs.find(t => t.path === path)
    if (tab?.content) {
      setCurrentContent(tab.content)
    } else {
      try {
        const content = await readFile(path)
        setCurrentContent(content)
        if (activeTabId) {
          updateTabContent(activeTabId, content)
        }
      } catch (err) {
        console.error('Failed to load tab content:', err)
      }
    }
  }, [tabs, readFile, activeTabId, updateTabContent])

  const handleFileDrop = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const fileName = file.name
      const fakePath = `D:\\Dropped\\${fileName}`

      addTab(fakePath, fileName, content)
      setCurrentContent(content)
    }
    reader.readAsText(file)
  }, [addTab])

  useEffect(() => {
    if (activeTabId) {
      const activeTab = tabs.find(t => t.id === activeTabId)
      if (activeTab?.content) {
        setCurrentContent(activeTab.content)
      }
    }
  }, [activeTabId, tabs])

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header
        onOpenFile={openFile}
        onDrop={handleFileDrop}
      />

      <TabBar onTabChange={handleTabChange} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        >
          <FileTree onFileSelect={openFile} />
        </Sidebar>

        <main className="flex-1 overflow-hidden">
          {error ? (
            <div className="h-full flex items-center justify-center text-destructive">
              <p>{error}</p>
            </div>
          ) : isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <MarkdownPreview content={currentContent} />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
