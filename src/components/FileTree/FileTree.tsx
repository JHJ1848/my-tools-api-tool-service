import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  File,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  RefreshCw,
  FoldVertical,
  UnfoldVertical,
  FolderPlus,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabsStore } from '@/stores/tabsStore'
import type { FileNode } from '@/types'

interface FileTreeProps {
  onFileSelect?: (filePath: string) => void
}

interface ContextMenuState {
  x: number
  y: number
  node: FileNode
}

export function FileTree({ onFileSelect }: FileTreeProps) {
  const {
    currentWorkspace,
    fileTree,
    expandedPaths,
    searchFilter,
    selectedPath,
    isLoading,
    toggleFolder,
    expandAll,
    collapseAll,
    refreshWorkspace,
    setSearchFilter,
    setSelectedPath,
    pickAndOpenWorkspace,
  } = useWorkspaceStore()

  const { openFile, tabs, activeTabId } = useTabsStore()
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [copiedPath, setCopiedPath] = useState(false)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const activeTab = tabs.find((t) => t.id === activeTabId)
  const currentActivePath = activeTab?.path || selectedPath

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // Filter file tree based on search
  const filteredTree = useMemo(() => {
    if (!searchFilter.trim()) return fileTree

    const query = searchFilter.toLowerCase()

    function filterNodes(nodes: FileNode[]): FileNode[] {
      const result: FileNode[] = []
      for (const node of nodes) {
        if (node.isDirectory) {
          const children = node.children ? filterNodes(node.children) : []
          if (children.length > 0 || node.name.toLowerCase().includes(query)) {
            result.push({ ...node, children })
          }
        } else {
          if (node.name.toLowerCase().includes(query) || node.path.toLowerCase().includes(query)) {
            result.push(node)
          }
        }
      }
      return result
    }

    return filterNodes(fileTree)
  }, [fileTree, searchFilter])

  const handleNodeClick = async (node: FileNode) => {
    if (node.isDirectory) {
      toggleFolder(node.path)
    } else {
      setSelectedPath(node.path)
      if (onFileSelect) {
        onFileSelect(node.path)
      } else {
        await openFile(node.path)
      }
    }
  }

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      node,
    })
  }

  const handleCopyPath = (full: boolean) => {
    if (!contextMenu) return
    const textToCopy = full
      ? contextMenu.node.path
      : currentWorkspace
      ? contextMenu.node.path.replace(currentWorkspace, '').replace(/^[/\\]/, '')
      : contextMenu.node.name

    navigator.clipboard.writeText(textToCopy)
    setCopiedPath(true)
    setTimeout(() => {
      setCopiedPath(false)
      setContextMenu(null)
    }, 800)
  }

  const handleOpenExplorer = () => {
    if (contextMenu && window.electronAPI?.showInExplorer) {
      window.electronAPI.showInExplorer(contextMenu.node.path)
      setContextMenu(null)
    }
  }

  const renderFileIcon = (node: FileNode) => {
    if (node.isDirectory) {
      const isExpanded = expandedPaths.has(node.path) || Boolean(searchFilter.trim())
      return isExpanded ? (
        <FolderOpen className="w-4 h-4 text-sky-400 flex-shrink-0" />
      ) : (
        <Folder className="w-4 h-4 text-sky-500/80 flex-shrink-0" />
      )
    }

    const ext = node.extension?.toLowerCase() || ''
    if (['.md', '.markdown', '.mdown'].includes(ext)) {
      return (
        <div className="w-4 h-4 rounded bg-sky-500/15 text-sky-400 font-mono text-[9px] font-bold flex items-center justify-center flex-shrink-0 border border-sky-500/30">
          M
        </div>
      )
    }
    if (['.json', '.js', '.ts', '.tsx', '.jsx', '.html', '.css', '.yml', '.yaml'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-indigo-400 flex-shrink-0" />
    }
    if (['.txt', '.log'].includes(ext)) {
      return <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
    }
    return <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />
  }

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedPaths.has(node.path) || Boolean(searchFilter.trim())
    const isSelected = currentActivePath === node.path
    const isMarkdown = ['.md', '.markdown'].includes(node.extension?.toLowerCase() || '')

    return (
      <div key={node.path} className="select-none">
        <div
          onClick={() => handleNodeClick(node)}
          onContextMenu={(e) => handleContextMenu(e, node)}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          className={`group flex items-center gap-1.5 py-1 pr-2 rounded-md text-xs cursor-pointer transition-all ${
            isSelected
              ? 'bg-sky-500/15 text-sky-400 font-medium'
              : 'text-foreground/80 hover:bg-muted/60 hover:text-foreground'
          }`}
          title={node.path}
        >
          {/* Chevron for folder */}
          {node.isDirectory ? (
            <span className="w-3.5 h-3.5 flex items-center justify-center text-muted-foreground group-hover:text-foreground">
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </span>
          ) : (
            <span className="w-3.5 h-3.5" />
          )}

          {/* Node Icon */}
          {renderFileIcon(node)}

          {/* Node Title */}
          <span
            className={`truncate flex-1 ${
              isMarkdown ? 'text-foreground group-hover:text-sky-300' : 'text-muted-foreground group-hover:text-foreground'
            }`}
          >
            {node.name}
          </span>

          {/* File size preview on hover */}
          {!node.isDirectory && node.size !== undefined && (
            <span className="opacity-0 group-hover:opacity-100 text-[10px] text-muted-foreground/70 font-mono transition-opacity">
              {node.size < 1024 ? `${node.size}B` : `${(node.size / 1024).toFixed(1)}K`}
            </span>
          )}
        </div>

        {/* Children for directory */}
        {node.isDirectory && isExpanded && node.children && (
          <div className="flex flex-col">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[var(--codex-sidebar)] text-sm relative border-r border-border/80">
      {/* Workspace Header Toolbar */}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between border-b border-border/50 flex-shrink-0">
        <div
          onClick={pickAndOpenWorkspace}
          className="flex items-center gap-2 overflow-hidden cursor-pointer group hover:opacity-90 transition-opacity"
          title="点击更换工作区文件夹 (Ctrl+O)"
        >
          <FolderOpen className="w-4 h-4 text-sky-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-xs tracking-wide text-foreground uppercase truncate group-hover:text-sky-300">
            {currentWorkspace
              ? currentWorkspace.split(/[/\\]/).filter(Boolean).pop() || '工作区'
              : '选择工作区'}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={pickAndOpenWorkspace}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-sky-400 transition-colors"
            title="选择工作区文件夹 (Ctrl+O)"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={expandAll}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="全部展开"
          >
            <UnfoldVertical className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={collapseAll}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="全部折叠"
          >
            <FoldVertical className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={refreshWorkspace}
            className={`p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ${
              isLoading ? 'animate-spin' : ''
            }`}
            title="刷新目录"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>


      {/* Search / Filter Input */}
      {currentWorkspace && (
        <div className="px-3 py-2 flex-shrink-0">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2 text-muted-foreground" />
            <input
              type="text"
              placeholder="过滤文件 (名称/路径)..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-muted/40 border border-border/60 rounded-md pl-7 pr-7 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-sky-500/70 transition-colors"
            />
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                className="absolute right-2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-1.5 space-y-0.5">
        {!currentWorkspace ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <FolderPlus className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">尚未打开工作区</p>
              <p className="text-[11px] text-muted-foreground">打开文件夹以浏览和管理 Markdown 文档</p>
            </div>
            <button
              onClick={pickAndOpenWorkspace}
              className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs shadow-sm transition-all flex items-center gap-2"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>选择文件夹</span>
            </button>
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {searchFilter ? '未找到匹配文件' : '工作区为空'}
          </div>
        ) : (
          filteredTree.map((node) => renderNode(node, 0))
        )}
      </div>

      {/* Right Click Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 min-w-[160px] bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-2xl py-1 text-xs font-medium animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-3 py-1 text-[10px] text-muted-foreground font-mono truncate border-b border-border/50 mb-1">
            {contextMenu.node.name}
          </div>

          <button
            onClick={() => handleCopyPath(false)}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-muted text-foreground transition-colors"
          >
            {copiedPath ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-sky-400" />}
            <span>复制相对路径</span>
          </button>

          <button
            onClick={() => handleCopyPath(true)}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-muted text-foreground transition-colors"
          >
            <Copy className="w-3.5 h-3.5 text-indigo-400" />
            <span>复制绝对路径</span>
          </button>

          <div className="my-1 border-t border-border/50" />

          <button
            onClick={handleOpenExplorer}
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
