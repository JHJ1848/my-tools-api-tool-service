import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { marked } from 'marked'
import hljs from 'highlight.js'
import katex from 'katex'
import mermaid from 'mermaid'
import {
  Copy,
  Check,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  Save,
  FileCode,
  Eye,
  Columns,
} from 'lucide-react'
import { useConfigStore } from '@/stores/configStore'
import { useTabsStore } from '@/stores/tabsStore'
import type { Tab, ViewMode } from '@/types'

interface MarkdownViewProps {
  tab?: Tab
}

export function MarkdownView({ tab }: MarkdownViewProps) {
  const { settings, resolvedTheme } = useConfigStore()
  const { updateContent, saveTab } = useTabsStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [showInDocSearch, setShowInDocSearch] = useState(false)
  const [searchResults, setSearchResults] = useState<{ line: number; index: number }[]>([])
  const [currentSearchIdx, setCurrentSearchIdx] = useState(0)
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)
  const [splitRatio, setSplitRatio] = useState<number>(settings.splitRatio || 50)
  const [isDraggingSplit, setIsDraggingSplit] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const previewRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isSyncingScroll = useRef<'editor' | 'preview' | null>(null)

  const content = tab?.content ?? ''
  const viewMode: ViewMode = tab?.viewMode || settings.defaultViewMode || 'split'

  // Initialize Mermaid with current theme
  useEffect(() => {
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: resolvedTheme === 'dark' ? 'dark' : 'neutral',
        securityLevel: 'loose',
      })
    } catch (err) {
      console.warn('Mermaid initialization warning:', err)
    }
  }, [resolvedTheme])

  // Custom Marked parser with KaTeX, Highlight.js, and Mermaid support
  const htmlContent = useMemo(() => {
    if (!content) return ''

    // 1. Process Math (KaTeX)
    let processed = content

    // Block math: $$ ... $$
    processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
      try {
        return `<div class="katex-display">${katex.renderToString(math.trim(), {
          displayMode: true,
          throwOnError: false,
        })}</div>`
      } catch {
        return `<pre class="katex-error">${math}</pre>`
      }
    })

    // Inline math: $ ... $ (excluding escaped \$)
    processed = processed.replace(/(^|[^\\])\$([^\$\n]+?)\$/g, (_, prefix, math) => {
      try {
        const rendered = katex.renderToString(math.trim(), {
          displayMode: false,
          throwOnError: false,
        })
        return `${prefix}<span class="katex-inline">${rendered}</span>`
      } catch {
        return `${prefix}$${math}$`
      }
    })

    // 2. Configure marked renderer
    const renderer = new marked.Renderer()

    renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
      const language = (lang || '').trim().toLowerCase()

      if (language === 'mermaid') {
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`
        return `<div class="mermaid-wrapper"><div class="mermaid-diagram" id="${id}" data-mermaid="${encodeURIComponent(
          text
        )}">${text}</div></div>`
      }

      const validLang = language && hljs.getLanguage(language) ? language : 'plaintext'
      let highlighted = text
      try {
        highlighted = hljs.highlight(text, { language: validLang }).value
      } catch {
        highlighted = text
      }

      const codeId = `code-${Math.random().toString(36).slice(2, 9)}`

      return `
        <div class="code-block-wrapper group relative" data-code-id="${codeId}">
          <div class="code-header">
            <span class="text-[11px] font-mono text-gray-400">${validLang}</span>
            <button
              class="copy-code-btn px-2 py-0.5 rounded text-[11px] bg-white/5 hover:bg-white/15 text-gray-300 transition-all flex items-center gap-1 opacity-80 group-hover:opacity-100"
              data-raw="${encodeURIComponent(text)}"
            >
              <span>复制</span>
            </button>
          </div>
          <pre><code class="language-${validLang} hljs">${highlighted}</code></pre>
        </div>
      `
    }

    renderer.heading = ({ text, depth }: { text: string; depth: number }) => {
      const cleanText = text.replace(/<[^>]*>?/gm, '')
      const slug = cleanText
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
        .replace(/^-+|-+$/g, '')
      return `<h${depth} id="${slug}">${text}</h${depth}>`
    }

    renderer.link = ({ href, title, text }: { href: string; title?: string | null; text: string }) => {
      const titleAttr = title ? ` title="${title}"` : ''
      const isExternal = href.startsWith('http://') || href.startsWith('https://')
      const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
      return `<a href="${href}"${titleAttr}${target}>${text}</a>`
    }

    renderer.table = ({ header, body }: { header: string; body: string }) => {
      return `
        <div class="overflow-x-auto my-4 rounded-lg border border-border/70">
          <table>
            <thead>${header}</thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      `
    }

    marked.setOptions({
      renderer,
      gfm: true,
      breaks: true,
    })

    return marked.parse(processed) as string
  }, [content])

  // Post-render effect: Render Mermaid diagrams & attach copy event listeners
  useEffect(() => {
    if (!previewRef.current) return

    // 1. Render Mermaid
    const mermaidElements = previewRef.current.querySelectorAll<HTMLDivElement>('.mermaid-diagram')
    mermaidElements.forEach(async (el) => {
      const rawCode = decodeURIComponent(el.getAttribute('data-mermaid') || '')
      if (rawCode) {
        try {
          const uniqueId = `mmd-${Math.random().toString(36).slice(2, 9)}`
          const { svg } = await mermaid.render(uniqueId, rawCode)
          el.innerHTML = svg
        } catch (err) {
          el.innerHTML = `<div class="text-rose-400 text-xs font-mono p-2">Mermaid Render Error</div>`
        }
      }
    })

    // 2. Attach copy button handlers
    const copyButtons = previewRef.current.querySelectorAll<HTMLButtonElement>('.copy-code-btn')
    const cleanupFns: (() => void)[] = []

    copyButtons.forEach((btn) => {
      const clickHandler = () => {
        const raw = decodeURIComponent(btn.getAttribute('data-raw') || '')
        navigator.clipboard.writeText(raw)
        const span = btn.querySelector('span')
        if (span) {
          span.textContent = '已复制!'
          setTimeout(() => {
            span.textContent = '复制'
          }, 1500)
        }
      }
      btn.addEventListener('click', clickHandler)
      cleanupFns.push(() => btn.removeEventListener('click', clickHandler))
    })

    return () => {
      cleanupFns.forEach((fn) => fn())
    }
  }, [htmlContent])

  // Bidirectional Scroll Sync
  const handleEditorScroll = () => {
    if (isSyncingScroll.current === 'preview') return
    isSyncingScroll.current = 'editor'

    if (editorRef.current && previewRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = editorRef.current
      const ratio = scrollTop / (scrollHeight - clientHeight || 1)
      previewRef.current.scrollTop = ratio * (previewRef.current.scrollHeight - previewRef.current.clientHeight)
    }

    if (editorRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = editorRef.current.scrollTop
    }

    setTimeout(() => {
      if (isSyncingScroll.current === 'editor') isSyncingScroll.current = null
    }, 50)
  }

  const handlePreviewScroll = () => {
    if (isSyncingScroll.current === 'editor') return
    isSyncingScroll.current = 'preview'

    if (previewRef.current && editorRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = previewRef.current
      const ratio = scrollTop / (scrollHeight - clientHeight || 1)
      editorRef.current.scrollTop = ratio * (editorRef.current.scrollHeight - editorRef.current.clientHeight)
      if (lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = editorRef.current.scrollTop
      }
    }

    setTimeout(() => {
      if (isSyncingScroll.current === 'preview') isSyncingScroll.current = null
    }, 50)
  }

  // Handle Editor Keydown (Tab indent, Ctrl+S save, Ctrl+F search)
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      if (tab) {
        saveTab(tab.id).then((success) => {
          if (success) {
            setSaveSuccess(true)
            setTimeout(() => setSaveSuccess(false), 1500)
          }
        })
      }
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault()
      setShowInDocSearch(true)
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = e.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const tabSpaces = '  '

      if (e.shiftKey) {
        // Dedent
        const lines = textarea.value.slice(0, start).split('\n')
        const currentLine = lines[lines.length - 1]
        if (currentLine.startsWith(tabSpaces)) {
          const newContent =
            textarea.value.substring(0, start - 2) + textarea.value.substring(start)
          if (tab) updateContent(tab.id, newContent)
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start - 2
          }, 0)
        }
      } else {
        // Indent
        const newContent =
          textarea.value.substring(0, start) + tabSpaces + textarea.value.substring(end)
        if (tab) updateContent(tab.id, newContent)
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2
        }, 0)
      }
    }
  }

  // Split Divider Dragging
  const handleSplitMouseDown = () => {
    setIsDraggingSplit(true)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSplit || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newRatio = ((e.clientX - rect.left) / rect.width) * 100
      if (newRatio >= 20 && newRatio <= 80) {
        setSplitRatio(newRatio)
      }
    }

    const handleMouseUp = () => {
      setIsDraggingSplit(false)
    }

    if (isDraggingSplit) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingSplit])

  // In-Doc Search logic
  useEffect(() => {
    if (!searchQuery.trim() || !content) {
      setSearchResults([])
      return
    }

    const lines = content.split('\n')
    const matches: { line: number; index: number }[] = []
    const q = searchQuery.toLowerCase()

    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes(q)) {
        matches.push({ line: idx + 1, index: matches.length })
      }
    })

    setSearchResults(matches)
    setCurrentSearchIdx(0)
  }, [searchQuery, content])

  const scrollToSearchMatch = (idx: number) => {
    if (searchResults.length === 0) return
    const match = searchResults[idx]
    if (!match) return

    if (editorRef.current) {
      const lineHeight = 24
      editorRef.current.scrollTop = (match.line - 3) * lineHeight
    }

    if (previewRef.current) {
      const headings = previewRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li')
      if (headings[match.line]) {
        headings[match.line].scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  const handleNextSearch = () => {
    if (searchResults.length === 0) return
    const next = (currentSearchIdx + 1) % searchResults.length
    setCurrentSearchIdx(next)
    scrollToSearchMatch(next)
  }

  const handlePrevSearch = () => {
    if (searchResults.length === 0) return
    const prev = (currentSearchIdx - 1 + searchResults.length) % searchResults.length
    setCurrentSearchIdx(prev)
    scrollToSearchMatch(prev)
  }

  // Calculate stats
  const lineCount = content ? content.split('\n').length : 0
  const charCount = content.length
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

  if (!tab) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
          <FileCode className="w-7 h-7" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-foreground">无打开的文档</p>
          <p className="text-xs text-muted-foreground">从左侧文件树选择文件或使用全局搜索打开</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative h-full flex flex-col bg-[var(--codex-editor)] overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* SOURCE VIEW / LEFT HALF */}
        {(viewMode === 'source' || viewMode === 'split') && (
          <div
            style={{ width: viewMode === 'split' ? `${splitRatio}%` : '100%' }}
            className="h-full flex relative overflow-hidden bg-[var(--codex-editor)] border-r border-border/50"
          >
            {/* Line numbers gutter */}
            <div
              ref={lineNumbersRef}
              className="w-12 py-6 select-none text-right pr-3 font-mono text-xs text-muted-foreground/40 bg-muted/20 border-r border-border/40 overflow-hidden leading-6 flex-shrink-0"
            >
              {Array.from({ length: lineCount || 1 }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            {/* Code Textarea */}
            <textarea
              ref={editorRef}
              value={content}
              onChange={(e) => updateContent(tab.id, e.target.value)}
              onScroll={handleEditorScroll}
              onKeyDown={handleEditorKeyDown}
              placeholder="在此处输入 Markdown 源码..."
              spellCheck={false}
              style={{ fontSize: `${settings.fontSize || 15}px`, fontFamily: settings.fontFamily }}
              className="flex-1 h-full py-6 px-4 bg-transparent text-foreground resize-none focus:outline-none font-mono leading-6 overflow-y-auto whitespace-pre tab-4"
            />
          </div>
        )}

        {/* DRAGGABLE SPLIT DIVIDER */}
        {viewMode === 'split' && (
          <div
            onMouseDown={handleSplitMouseDown}
            className={`w-1 hover:w-1.5 bg-border hover:bg-sky-500/80 cursor-col-resize transition-all z-20 flex-shrink-0 ${
              isDraggingSplit ? 'bg-sky-500 w-1.5' : ''
            }`}
            title="拖动调整分屏比例"
          />
        )}

        {/* PREVIEW VIEW / RIGHT HALF */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div
            ref={previewRef}
            onScroll={handlePreviewScroll}
            style={{ width: viewMode === 'split' ? `${100 - splitRatio}%` : '100%' }}
            className="h-full overflow-y-auto px-8 py-8 bg-card/40"
          >
            <article
              className="markdown-body max-w-4xl mx-auto min-h-full pb-16"
              style={{ fontSize: `${settings.fontSize || 15}px` }}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>
        )}
      </div>

      {/* Floating In-Doc Search Toolbar (Ctrl+F) */}
      {showInDocSearch && (
        <div className="absolute top-4 right-8 bg-card/95 backdrop-blur-md border border-border/80 rounded-lg shadow-2xl p-1.5 flex items-center gap-2 z-30 animate-in fade-in zoom-in-95 duration-100">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2 text-muted-foreground" />
            <input
              type="text"
              placeholder="文档内搜索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNextSearch()
                if (e.key === 'Escape') setShowInDocSearch(false)
              }}
              autoFocus
              className="w-44 bg-muted/60 border border-border/60 rounded pl-7 pr-2 py-1 text-xs text-foreground focus:outline-none focus:border-sky-500"
            />
          </div>

          {searchResults.length > 0 && (
            <span className="text-[11px] font-mono text-muted-foreground">
              {currentSearchIdx + 1}/{searchResults.length}
            </span>
          )}

          <button
            onClick={handlePrevSearch}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="上一个 (Shift+Enter)"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleNextSearch}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="下一个 (Enter)"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowInDocSearch(false)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Editor Status Footer */}
      <footer className="h-6 bg-[var(--codex-titlebar)] border-t border-border/60 px-3 flex items-center justify-between text-[11px] font-mono text-muted-foreground select-none z-10 flex-shrink-0">
        <div className="flex items-center gap-4">
          <span>行: {lineCount}</span>
          <span>字数: {wordCount}</span>
          <span>字符: {charCount}</span>
          {saveSuccess && (
            <span className="text-emerald-400 flex items-center gap-1 animate-pulse">
              <Check className="w-3 h-3" /> 已保存
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          <span>Markdown (GFM)</span>
          <span className="capitalize">{viewMode} 视图</span>
        </div>
      </footer>
    </div>
  )
}
