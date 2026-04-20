import React, { useState, useCallback, useEffect } from 'react'
import { Upload, FolderOpen, Home, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ThemeToggle } from './Sidebar'
import { cn } from '@/lib/utils'
import { config } from '@/lib/config'
import { getApiHost, getApiPort, setApiHost, setApiPort } from '@/lib/apiConfig'

interface HeaderProps {
  onOpenFile: (path: string) => void
  onDrop: (file: File) => void
}

export function Header({ onOpenFile, onDrop }: HeaderProps) {
  const [pathInput, setPathInput] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [apiHost, setApiHostInput] = useState(getApiHost())
  const [apiPort, setApiPortInput] = useState(getApiPort())

  const handleSaveApiConfig = () => {
    setApiHost(apiHost)
    setApiPort(apiPort)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pathInput.trim()) {
      onOpenFile(pathInput.trim())
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    const mdFile = files.find(f =>
      f.name.endsWith('.md') ||
      f.name.endsWith('.markdown') ||
      f.type === 'text/markdown'
    )

    if (mdFile) {
      onDrop(mdFile)
    }
  }, [onDrop])

  useEffect(() => {
    const handleGlobalDrop = (e: DragEvent) => {
      e.preventDefault()
      const files = Array.from(e.dataTransfer?.files || [])
      const mdFile = files.find(f => f.name.endsWith('.md'))
      if (mdFile) {
        onDrop(mdFile)
      }
    }

    const handleGlobalDragOver = (e: DragEvent) => {
      e.preventDefault()
    }

    window.addEventListener('drop', handleGlobalDrop)
    window.addEventListener('dragover', handleGlobalDragOver)

    return () => {
      window.removeEventListener('drop', handleGlobalDrop)
      window.removeEventListener('dragover', handleGlobalDragOver)
    }
  }, [onDrop])

  return (
    <header
      className={cn(
        "h-14 border-b bg-card px-4 flex items-center gap-4 transition-colors",
        isDragOver && "bg-primary/10 border-primary"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
        <FolderOpen className="w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={`输入文件路径，例如: ${config.basePath}\\README.md`}
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" size="sm">
          预览
        </Button>
      </form>

      <div className="flex items-center gap-1">
        <Input
          type="text"
          value={apiHost}
          onChange={(e) => setApiHostInput(e.target.value)}
          className="w-36 h-8"
          placeholder="API IP/Host"
        />
        <Input
          type="text"
          value={apiPort}
          onChange={(e) => setApiPortInput(e.target.value)}
          className="w-20 h-8"
          placeholder="Port"
        />
        <Button type="button" size="sm" variant="outline" onClick={handleSaveApiConfig}>
          API
        </Button>
        <ThemeToggle />
      </div>

      {isDragOver && (
        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center pointer-events-none">
          <div className="bg-background px-6 py-3 rounded-lg shadow-lg">
            <Upload className="w-6 h-6 mx-auto mb-2 text-primary" />
            <span className="text-sm font-medium">释放以预览 Markdown</span>
          </div>
        </div>
      )}
    </header>
  )
}
