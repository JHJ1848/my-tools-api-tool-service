import React, { useState, useEffect, useRef } from 'react'
import {
  FolderOpen,
  ChevronDown,
  Eye,
  Code2,
  Columns,
  Search,
  BookOpen,
  Sun,
  Moon,
  Monitor,
  Settings,
  Minus,
  Square,
  Copy,
  X,
  Sparkles,
  FolderGit2,
  ExternalLink,
  History,
} from 'lucide-react'
import { useConfigStore } from '@/stores/configStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabsStore } from '@/stores/tabsStore'
import type { ViewMode, Theme } from '@/types'

interface TitleBarProps {
  onOpenGlobalSearch: () => void
  onOpenSettings: () => void
  onToggleToc: () => void
  isTocOpen: boolean
}

export function TitleBar({
  onOpenGlobalSearch,
  onOpenSettings,
  onToggleToc,
  isTocOpen,
}: TitleBarProps) {
  const { settings, setTheme, updateSettings } = useConfigStore()
  const { currentWorkspace, pickAndOpenWorkspace, setWorkspace } = useWorkspaceStore()
  const { getActiveTab, setViewMode } = useTabsStore()

  const activeTab = getActiveTab()
  const [isMaximized, setIsMaximized] = useState(false)
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Listen to window maximize state
  useEffect(() => {
    if (window.electronAPI?.isMaximized) {
      window.electronAPI.isMaximized().then(setIsMaximized)
    }
    if (window.electronAPI?.onMaximizeChange) {
      const cleanup = window.electronAPI.onMaximizeChange((max) => {
        setIsMaximized(max)
      })
      return cleanup
    }
  }, [])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setWorkspaceMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const workspaceName = currentWorkspace
    ? currentWorkspace.split(/[/\\]/).filter(Boolean).pop() || currentWorkspace
    : '选择工作区'

  const currentViewMode: ViewMode = activeTab?.viewMode || settings.defaultViewMode || 'split'

  const handleViewModeChange = (mode: ViewMode) => {
    if (activeTab) {
      setViewMode(activeTab.id, mode)
    }
    updateSettings({ defaultViewMode: mode })
  }

  const handleNextTheme = () => {
    const themes: Theme[] = ['dark', 'light', 'system']
    const nextIdx = (themes.indexOf(settings.theme) + 1) % themes.length
    setTheme(themes[nextIdx])
  }

  const handleMinimize = () => window.electronAPI?.minimizeWindow?.()
  const handleMaximize = () => window.electronAPI?.maximizeWindow?.()
  const handleClose = () => window.electronAPI?.closeWindow?.()

  // Generate breadcrumb items
  const renderBreadcrumb = () => {
    if (!activeTab || !currentWorkspace) return null
    if (!activeTab.path.startsWith(currentWorkspace)) {
      return (
        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
          {activeTab.name}
        </span>
      )
    }

    const relPath = activeTab.path.slice(currentWorkspace.length).replace(/^[/\\]/, '')
    const segments = relPath.split(/[/\\]/)

    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground max-w-[340px] truncate">
        {segments.map((seg, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-muted-foreground/40">/</span>}
            <span
              className={
                i === segments.length - 1
                  ? 'text-foreground font-medium truncate'
                  : 'hover:text-foreground/80 truncate'
              }
            >
              {seg}
            </span>
          </React.Fragment>
        ))}
      </div>
    )
  }

  return (
    <header className="app-drag-region h-11 bg-[var(--codex-titlebar)] border-b border-border/80 flex items-center justify-between px-3 select-none z-50 flex-shrink-0 text-sm">
      {/* Left section: App Brand & Workspace Selector */}
      <div className="flex items-center gap-3 app-no-drag">
        {/* Brand Logo */}
        <div className="flex items-center gap-2 pr-2 border-r border-border/50">
          <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center shadow-sm shadow-sky-500/20">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
          <span className="font-semibold text-xs tracking-wider uppercase text-foreground/90 font-mono">
            Codex
          </span>
        </div>

        {/* Workspace Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
            className="flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium bg-muted/50 hover:bg-muted text-foreground/90 border border-border/50 hover:border-border transition-all"
            title="切换或打开工作区"
          >
            <FolderGit2 className="w-3.5 h-3.5 text-sky-400" />
            <span className="max-w-[140px] truncate">{workspaceName}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>

          {workspaceMenuOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl py-1 z-50 text-xs">
              <button
                onClick={async () => {
                  setWorkspaceMenuOpen(false)
                  await pickAndOpenWorkspace()
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-muted/80 text-foreground transition-colors"
              >
                <FolderOpen className="w-4 h-4 text-sky-400" />
                <span>打开文件夹...</span>
              </button>

              {currentWorkspace && (
                <button
                  onClick={() => {
                    setWorkspaceMenuOpen(false)
                    window.electronAPI?.showInExplorer?.(currentWorkspace)
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-muted/80 text-foreground transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-emerald-400" />
                  <span>在文件资源管理器中打开</span>
                </button>
              )}

              {settings.recentWorkspaces && settings.recentWorkspaces.length > 0 && (
                <>
                  <div className="my-1 border-t border-border/60" />
                  <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-3 h-3" />
                    <span>最近工作区</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {settings.recentWorkspaces.map((path) => (
                      <button
                        key={path}
                        onClick={() => {
                          setWorkspaceMenuOpen(false)
                          setWorkspace(path)
                        }}
                        className={`w-full px-3 py-1.5 text-left flex flex-col hover:bg-muted/80 transition-colors ${
                          path === currentWorkspace ? 'bg-sky-500/10 text-sky-400' : 'text-foreground/80'
                        }`}
                      >
                        <span className="font-medium truncate">
                          {path.split(/[/\\]/).filter(Boolean).pop() || path}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate">{path}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Breadcrumbs */}
        <div className="hidden md:flex items-center pl-2">{renderBreadcrumb()}</div>
      </div>

      {/* Center: View Mode Segmented Control */}
      <div className="app-no-drag flex items-center">
        <div className="flex items-center p-0.5 bg-muted/60 border border-border/50 rounded-lg">
          <button
            onClick={() => handleViewModeChange('preview')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] text-xs font-medium transition-all ${
              currentViewMode === 'preview'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="仅富文本预览 (Preview)"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">预览</span>
          </button>
          <button
            onClick={() => handleViewModeChange('split')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] text-xs font-medium transition-all ${
              currentViewMode === 'split'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="分屏对照编辑 (Split)"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">分屏</span>
          </button>
          <button
            onClick={() => handleViewModeChange('source')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] text-xs font-medium transition-all ${
              currentViewMode === 'source'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="仅源码编辑 (Source)"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">源码</span>
          </button>
        </div>
      </div>

      {/* Right section: Action buttons & Window controls */}
      <div className="flex items-center gap-1.5 app-no-drag">
        {/* Global Search Shortcut */}
        <button
          onClick={onOpenGlobalSearch}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40 transition-colors"
          title="全文检索 (Ctrl+Shift+F)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden lg:inline text-[11px]">搜索</span>
          <kbd className="hidden lg:inline-block px-1 py-0.2 bg-background/80 border border-border rounded text-[9px] font-mono text-muted-foreground">
            Ctrl+⇧+F
          </kbd>
        </button>

        {/* TOC Sidebar Toggle */}
        <button
          onClick={onToggleToc}
          className={`p-1.5 rounded-md text-xs transition-colors ${
            isTocOpen
              ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
          }`}
          title="文档大纲 (TOC)"
        >
          <BookOpen className="w-3.5 h-3.5" />
        </button>

        {/* Theme Switcher */}
        <button
          onClick={handleNextTheme}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors text-xs"
          title={`当前主题: ${settings.theme} (点击切换)`}
        >
          {settings.theme === 'dark' ? (
            <Moon className="w-3.5 h-3.5 text-sky-400" />
          ) : settings.theme === 'light' ? (
            <Sun className="w-3.5 h-3.5 text-amber-500" />
          ) : (
            <Monitor className="w-3.5 h-3.5 text-indigo-400" />
          )}
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors text-xs"
          title="偏好设置"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {/* Windows Control Buttons */}
        <div className="flex items-center ml-2 pl-2 border-l border-border/50">
          <button
            onClick={handleMinimize}
            className="w-8 h-7 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors rounded-sm"
            title="最小化"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleMaximize}
            className="w-8 h-7 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors rounded-sm"
            title={isMaximized ? '还原' : '最大化'}
          >
            {isMaximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
          </button>
          <button
            onClick={handleClose}
            className="w-8 h-7 flex items-center justify-center hover:bg-red-500 hover:text-white text-muted-foreground transition-colors rounded-sm"
            title="关闭"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  )
}
