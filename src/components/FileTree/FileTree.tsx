import React, { useState, useCallback, useEffect } from 'react'
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFileStore } from '@/stores/fileStore'
import { useFileSystem } from '@/hooks/useFileSystem'
import type { FileNode } from '@/types'

interface FileTreeProps {
  onFileSelect: (path: string) => void
}

export function FileTree({ onFileSelect }: FileTreeProps) {
  const { currentPath, files, setFiles, expandedFolders, toggleFolder, isLoading, setLoading, setError } = useFileStore()
  const { listDirectory } = useFileSystem()
  const [filter, setFilter] = useState('')

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true)
    try {
      const nodes = await listDirectory(path)
      setFiles(nodes)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [listDirectory, setFiles, setLoading, setError])

  useEffect(() => {
    loadDirectory(currentPath)
  }, [currentPath, loadDirectory])

  const filteredFiles = filter
    ? files.filter(f => f.name.toLowerCase().includes(filter.toLowerCase()))
    : files

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <input
          type="text"
          placeholder="过滤文件..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-muted rounded-md border-0 focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex-1 overflow-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredFiles.map((file) => (
              <FileTreeNode
                key={file.path}
                node={file}
                depth={0}
                expandedFolders={expandedFolders}
                onToggle={toggleFolder}
                onSelect={onFileSelect}
                loadDirectory={loadDirectory}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface FileTreeNodeProps {
  node: FileNode
  depth: number
  expandedFolders: Record<string, boolean>
  onToggle: (path: string) => void
  onSelect: (path: string) => void
  loadDirectory: (path: string) => Promise<void>
}

function FileTreeNode({
  node,
  depth,
  expandedFolders,
  onToggle,
  onSelect,
  loadDirectory,
}: FileTreeNodeProps) {
  const [children, setChildren] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(false)
  const isExpanded = expandedFolders[node.path] ?? false

  useEffect(() => {
    if (node.isDirectory && isExpanded && children.length === 0) {
      loadChildren()
    }
  }, [node.isDirectory, isExpanded])

  const loadChildren = async () => {
    setLoading(true)
    try {
      const nodes = await loadDirectory(node.path)
      setChildren(nodes)
    } catch {
      setChildren([])
    } finally {
      setLoading(false)
    }
  }

  const handleClick = () => {
    if (node.isDirectory) {
      onToggle(node.path)
    } else {
      onSelect(node.path)
    }
  }

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "text-sm"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        {node.isDirectory ? (
          <>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 shrink-0 text-yellow-500" />
            ) : (
              <Folder className="w-4 h-4 shrink-0 text-yellow-500" />
            )}
          </>
        ) : (
          <>
            <span className="w-4" />
            <FileText className={cn("w-4 h-4 shrink-0", getFileIconColor(node.extension))} />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </div>

      {node.isDirectory && isExpanded && (
        <div>
          {loading ? (
            <div
              className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground"
              style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
            >
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>加载中...</span>
            </div>
          ) : (
            children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                expandedFolders={expandedFolders}
                onToggle={onToggle}
                onSelect={onSelect}
                loadDirectory={loadDirectory}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function getFileIconColor(extension?: string): string {
  switch (extension?.toLowerCase()) {
    case '.md':
    case '.markdown':
      return 'text-blue-500'
    default:
      return 'text-gray-500'
  }
}
