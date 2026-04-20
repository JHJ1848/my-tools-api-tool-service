import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useSearch } from '@/hooks/useSearch'
import { useMarkdown } from '@/hooks/useMarkdown'
import { cn } from '@/lib/utils'
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface MarkdownPreviewProps {
  content: string
  className?: string
}

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [html, setHtml] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const { renderSync } = useMarkdown()
  const {
    query,
    setQuery,
    results,
    currentIndex,
    next,
    previous,
    clear,
    highlightMatches,
  } = useSearch({ content })

  useEffect(() => {
    const rendered = renderSync(content)
    setHtml(rendered)
  }, [content, renderSync])

  useEffect(() => {
    if (currentIndex >= 0 && results[currentIndex]) {
      const lineNumber = results[currentIndex].line
      const lineElement = contentRef.current?.querySelector(`[data-line="${lineNumber}"]`)
      lineElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentIndex, results])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault()
      setShowSearch(true)
    }
    if (e.key === 'Escape') {
      setShowSearch(false)
      clear()
    }
  }, [clear])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const scrollToResult = (index: number) => {
    const result = results[index]
    if (result && contentRef.current) {
      const lines = content.split('\n')
      let charCount = 0
      for (let i = 0; i < result.line - 1; i++) {
        charCount += lines[i].length + 1
      }
      charCount += result.content.indexOf(query)
      const selection = window.getSelection()
      const range = document.createRange()
      if (contentRef.current.firstChild) {
        try {
          range.setStart(contentRef.current.firstChild, Math.min(charCount, contentRef.current.firstChild.textContent?.length || 0))
          range.collapse(true)
          selection?.removeAllRanges()
          selection?.addRange(range)
        } catch {
          contentRef.current.scrollTop = (result.line - 1) * 24
        }
      }
    }
  }

  return (
    <div className={cn("relative h-full flex flex-col", className)}>
      <div className={cn("flex-1 overflow-auto", !content && "flex items-center justify-center")}>
        {content ? (
          <article
            ref={contentRef}
            className="markdown-body max-w-4xl mx-auto px-6 py-8"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="text-center text-muted-foreground">
            <p className="text-lg">暂无内容</p>
            <p className="text-sm mt-2">请选择左侧文件或拖拽Markdown文件到此处</p>
          </div>
        )}
      </div>

      <div className="absolute top-4 right-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowSearch(!showSearch)}
          title="搜索 (Ctrl+F)"
        >
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {showSearch && (
        <div className="absolute top-4 right-16 bg-background border rounded-lg shadow-lg p-2 flex items-center gap-2">
          <div className="relative">
            <Input
              type="text"
              placeholder="搜索..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (results.length > 0) scrollToResult(0)
              }}
              className="w-48 h-8"
              autoFocus
            />
          </div>

          {results.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground">
                {currentIndex + 1} / {results.length}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={previous}>
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={next}>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </>
          )}

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShowSearch(false); clear() }}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
