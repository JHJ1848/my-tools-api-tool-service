import React, { useState, useRef, useEffect } from 'react'
import {
  Pin,
  X,
  FileText,
  FileCode,
  File,
  MoreVertical,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react'
import { useTabsStore } from '@/stores/tabsStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { Tab } from '@/types'

interface ContextMenuTabState {
  x: number
  y: number
  tab: Tab
}

export function TabBar() {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    togglePinTab,
  } = useTabsStore()

  const { currentWorkspace } = useWorkspaceStore()
  const [contextMenu, setContextMenu] = useState<ContextMenuTabState | null>(null)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const tabContainerRef = useRef<HTMLDivElement>(null)

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // Auto scroll active tab into view
  useEffect(() => {
    if (activeTabId && tabContainerRef.current) {
      const activeEl = tabContainerRef.current.querySelector(`[data-tab-id="${activeTabId}"]`)
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
      }
    }
  }, [activeTabId])

  if (tabs.length === 0) {
    return null
  }

  const handleTabContextMenu = (e: React.MouseEvent, tab: Tab) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      tab,
    })
  }

  const handleCopyPath = () => {
    if (!contextMenu) return
    navigator.clipboard.writeText(contextMenu.tab.path)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
      setContextMenu(null)
    }, 800)
  }

  const handleShowExplorer = () => {
    if (contextMenu && window.electronAPI?.showInExplorer) {
      window.electronAPI.showInExplorer(contextMenu.tab.path)
      setContextMenu(null)
    }
  }

  const renderTabIcon = (tab: Tab) => {
    const ext = tab.name.split('.').pop()?.toLowerCase() || ''
    if (['md', 'markdown'].includes(ext)) {
      return (
        <span className="w-3.5 h-3.5 rounded bg-sky-500/20 text-sky-400 font-mono text-[9px] font-bold flex items-center justify-center border border-sky-500/30 flex-shrink-0">
          M
        </span>
      )
    }
    if (['json', 'js', 'ts', 'tsx'].includes(ext)) {
      return <FileCode className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
    }
    return <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
  }

  return (
    <div className="h-9 bg-[var(--codex-titlebar)] border-b border-border/70 flex items-center justify-between px-2 select-none flex-shrink-0 relative overflow-hidden">
      {/* Tab list with horizontal scroll */}
      <div
        ref={tabContainerRef}
        className="flex items-center gap-1 overflow-x-auto no-scrollbar h-full py-0.5 flex-1 pr-4"
        style={{ scrollbarWidth: 'none' }}
      >
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTabId
          const shortcutIndex = idx < 9 ? idx + 1 : null

          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onContextMenu={(e) => handleTabContextMenu(e, tab)}
              className={`group relative flex items-center gap-2 h-7 px-2.5 rounded-md text-xs cursor-pointer border transition-all flex-shrink-0 max-w-[200px] ${
                isActive
                  ? 'bg-card text-foreground font-medium border-border/80 shadow-sm shadow-black/10'
                  : 'bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground border-transparent'
              }`}
              title={tab.path}
            >
              {/* Pin Indicator */}
              {tab.isPinned && (
                <Pin className="w-2.5 h-2.5 text-sky-400 -rotate-45 flex-shrink-0" />
              )}

              {/* Icon */}
              {renderTabIcon(tab)}

              {/* Title */}
              <span className="truncate flex-1">{tab.name}</span>

              {/* Unsaved dirty dot or shortcut number */}
              {tab.isDirty ? (
                <span
                  className="w-2 h-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50 flex-shrink-0"
                  title="未保存更改"
                />
              ) : shortcutIndex && !tab.isPinned ? (
                <span className="opacity-0 group-hover:opacity-60 text-[9px] font-mono text-muted-foreground">
                  ^{shortcutIndex}
                </span>
              ) : null}

              {/* Close Tab Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.id)
                }}
                className={`w-4 h-4 rounded flex items-center justify-center hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-opacity flex-shrink-0 ${
                  isActive ? 'opacity-80 hover:opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                title="关闭标签 (Ctrl+W)"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Tab Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 min-w-[170px] bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-2xl py-1 text-xs font-medium animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-3 py-1 text-[10px] text-muted-foreground font-mono truncate border-b border-border/50 mb-1">
            {contextMenu.tab.name}
          </div>

          <button
            onClick={() => {
              togglePinTab(contextMenu.tab.id)
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-muted text-foreground transition-colors"
          >
            <Pin className="w-3.5 h-3.5 text-sky-400" />
            <span>{contextMenu.tab.isPinned ? '取消固定' : '固定标签'}</span>
          </button>

          <button
            onClick={() => {
              closeTab(contextMenu.tab.id)
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-muted text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5 text-rose-400" />
            <span>关闭当前标签</span>
          </button>

          <button
            onClick={() => {
              closeOtherTabs(contextMenu.tab.id)
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-muted text-foreground transition-colors"
          >
            <span>关闭其他标签</span>
          </button>

          <button
            onClick={() => {
              closeAllTabs()
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-muted text-foreground transition-colors"
          >
            <span>关闭全部标签</span>
          </button>

          <div className="my-1 border-t border-border/50" />

          <button
            onClick={handleCopyPath}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-muted text-foreground transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-sky-400" />}
            <span>复制文件路径</span>
          </button>

          <button
            onClick={handleShowExplorer}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-muted text-foreground transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
            <span>在资源管理器中显示</span>
          </button>
        </div>
      )}
    </div>
  )
}
