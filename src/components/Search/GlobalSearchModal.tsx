import React, { useState, useEffect, useRef } from 'react'
import {
  Search,
  X,
  FileText,
  ChevronRight,
  CaseSensitive,
  Regex,
  Loader2,
  CornerDownLeft,
} from 'lucide-react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabsStore } from '@/stores/tabsStore'
import type { SearchResult } from '@/types'

interface GlobalSearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const { currentWorkspace } = useWorkspaceStore()
  const { openFile } = useTabsStore()

  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      setResults([])
    }
  }, [isOpen])

  // Perform search with debounce
  useEffect(() => {
    if (!isOpen || !currentWorkspace || !query.trim()) {
      setResults([])
      setIsSearching(false)
      return
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    setIsSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        if (window.electronAPI?.searchWorkspace) {
          const res = await window.electronAPI.searchWorkspace(currentWorkspace, query, {
            caseSensitive,
            regex: useRegex,
          })
          setResults(res || [])
          setSelectedIndex(0)
        }
      } catch (err) {
        console.error('Global search error:', err)
      } finally {
        setIsSearching(false)
      }
    }, 180)

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [query, caseSensitive, useRegex, currentWorkspace, isOpen])

  const handleSelectResult = async (result: SearchResult) => {
    await openFile(result.file)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) =>
        results.length > 0 ? (prev - 1 + results.length) % results.length : 0
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIndex]) {
        handleSelectResult(results[selectedIndex])
      }
    }
  }

  if (!isOpen) return null

  // Highlight query in text
  const renderHighlightedContent = (lineContent: string, matchQuery: string) => {
    if (!matchQuery || useRegex) return lineContent

    const parts = lineContent.split(new RegExp(`(${matchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, caseSensitive ? 'g' : 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === matchQuery.toLowerCase() ? (
        <mark key={i} className="search-highlight">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-20 px-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] animate-in zoom-in-95 duration-150"
      >
        {/* Search Header Input */}
        <div className="p-3 border-b border-border flex items-center gap-3 bg-muted/30">
          <Search className="w-5 h-5 text-sky-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="搜索工作区文档内容 (例如: API, 架构, TODO)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />

          {/* Options toggle */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCaseSensitive(!caseSensitive)}
              className={`p-1.5 rounded text-xs transition-colors ${
                caseSensitive
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
              title="区分大小写 (Aa)"
            >
              <CaseSensitive className="w-4 h-4" />
            </button>
            <button
              onClick={() => setUseRegex(!useRegex)}
              className={`p-1.5 rounded text-xs transition-colors ${
                useRegex
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
              title="正则表达式 (.*)"
            >
              <Regex className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isSearching ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
              <span className="text-xs">检索中...</span>
            </div>
          ) : !query.trim() ? (
            <div className="h-32 flex flex-col items-center justify-center text-muted-foreground text-xs">
              <p>输入关键词以在工作区的所有 Markdown 文档中全文检索</p>
            </div>
          ) : results.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center text-muted-foreground text-xs">
              <p>未找到与 "{query}" 匹配的内容</p>
            </div>
          ) : (
            results.map((result, idx) => {
              const isSelected = idx === selectedIndex
              return (
                <div
                  key={`${result.file}-${result.line}-${idx}`}
                  onClick={() => handleSelectResult(result)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-2.5 rounded-lg cursor-pointer transition-all border text-xs flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-sky-500/10 border-sky-500/30 text-foreground'
                      : 'bg-muted/20 hover:bg-muted/40 border-transparent text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <FileText className="w-3.5 h-3.5 text-sky-400" />
                      <span className="truncate max-w-[400px]">{result.relativePath || result.file}</span>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60">
                      第 {result.line} 行
                    </span>
                  </div>

                  <div className="font-mono text-xs text-foreground/80 bg-background/50 px-2 py-1 rounded border border-border/40 truncate">
                    {renderHighlightedContent(result.lineContent, query)}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-3 py-2 bg-muted/40 border-t border-border flex items-center justify-between text-[11px] font-mono text-muted-foreground">
          <span>找到 {results.length} 处匹配</span>
          <div className="flex items-center gap-3">
            <span>↑↓ 切换</span>
            <span className="flex items-center gap-0.5">
              <CornerDownLeft className="w-3 h-3" /> 回车跳转
            </span>
            <span>ESC 关闭</span>
          </div>
        </div>
      </div>
    </div>
  )
}
