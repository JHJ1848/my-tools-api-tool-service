import React, { useMemo, useState, useEffect } from 'react'
import { BookOpen, ChevronRight, Hash, AlignLeft, X } from 'lucide-react'
import type { TOCItem } from '@/types'

interface TocSidebarProps {
  content: string
  isOpen: boolean
  onClose: () => void
}

export function TocSidebar({ content, isOpen, onClose }: TocSidebarProps) {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null)

  // Parse markdown headings into TOC items
  const tocItems = useMemo(() => {
    if (!content) return []
    const items: TOCItem[] = []
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/)
      if (match) {
        const level = match[1].length
        const rawText = match[2].trim()
        const cleanText = rawText.replace(/<[^>]*>?/gm, '').replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        const id = cleanText
          .toLowerCase()
          .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
          .replace(/^-+|-+$/g, '')

        items.push({
          id,
          text: cleanText,
          level,
          line: index + 1,
        })
      }
    })

    return items
  }, [content])

  const handleHeadingClick = (item: TOCItem) => {
    setActiveHeadingId(item.id)

    // Try finding element in preview by id or slug
    const element = document.getElementById(item.id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    // Fallback: match heading text
    const headings = document.querySelectorAll('.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6')
    for (const h of headings) {
      if (h.textContent?.includes(item.text)) {
        h.scrollIntoView({ behavior: 'smooth', block: 'start' })
        break
      }
    }
  }

  if (!isOpen) return null

  return (
    <aside className="w-60 h-full bg-[var(--codex-sidebar)] border-l border-border/80 flex flex-col select-none flex-shrink-0 text-sm">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-sky-400" />
          <span className="font-semibold text-xs tracking-wide text-foreground uppercase">
            大纲导航 ({tocItems.length})
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="关闭大纲"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* TOC list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {tocItems.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-center text-muted-foreground p-4">
            <AlignLeft className="w-6 h-6 mb-2 opacity-40" />
            <p className="text-xs">未检测到标题</p>
            <p className="text-[10px] text-muted-foreground/80 mt-1">使用 # ~ ###### 添加标题</p>
          </div>
        ) : (
          tocItems.map((item, index) => {
            const indentLevel = Math.max(0, item.level - 1)
            const isActive = activeHeadingId === item.id

            return (
              <button
                key={`${item.id}-${index}`}
                onClick={() => handleHeadingClick(item)}
                style={{ paddingLeft: `${indentLevel * 12 + 6}px` }}
                className={`w-full text-left py-1 pr-2 rounded text-xs transition-all flex items-center gap-1.5 group ${
                  isActive
                    ? 'bg-sky-500/15 text-sky-400 font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
                title={`L${item.line}: ${item.text}`}
              >
                <span className="text-[10px] font-mono opacity-50 group-hover:opacity-100 flex-shrink-0">
                  H{item.level}
                </span>
                <span className="truncate flex-1">{item.text}</span>
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
}
