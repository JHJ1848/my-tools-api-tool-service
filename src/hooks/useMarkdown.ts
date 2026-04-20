import { useMemo, useCallback } from 'react'
import { marked } from 'marked'
import hljs from 'highlight.js'

interface UseMarkdownOptions {
  gfm?: boolean
  breaks?: boolean
}

interface UseMarkdownReturn {
  render: (content: string) => string
  renderSync: (content: string) => string
}

export function useMarkdown(options: UseMarkdownOptions = {}): UseMarkdownReturn {
  const { gfm = true, breaks = true } = options

  const renderer = useMemo(() => {
    const customRenderer = new marked.Renderer()

    customRenderer.code = ({ text, lang }: { text: string; lang?: string }) => {
      const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
      const highlighted = hljs.highlight(text, { language }).value

      return `
        <div class="code-block-wrapper group relative">
          <div class="code-header flex justify-between items-center px-4 py-2 bg-muted rounded-t-lg border-b">
            <span class="text-xs text-muted-foreground font-mono">${language}</span>
            <button
              class="copy-btn opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-xs bg-background rounded hover:bg-accent"
              onclick="navigator.clipboard.writeText(${JSON.stringify(text)}).then(() => { this.textContent = '已复制'; setTimeout(() => this.textContent = '复制', 2000) })"
            >
              复制
            </button>
          </div>
          <pre class="!mt-0 !rounded-t-none"><code class="language-${language} hljs">${highlighted}</code></pre>
        </div>
      `
    }

    customRenderer.link = ({ href, title, text }: { href: string; title?: string | null; text: string }) => {
      const titleAttr = title ? ` title="${title}"` : ''
      const isExternal = href.startsWith('http://') || href.startsWith('https://')
      const externalAttrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
      return `<a href="${href}"${titleAttr}${externalAttrs} class="text-primary hover:underline">${text}</a>`
    }

    customRenderer.image = ({ href, title, text }: { href: string; title?: string | null; text: string }) => {
      const titleAttr = title ? ` title="${title}"` : ''
      return `<img src="${href}" alt="${text}"${titleAttr} class="max-w-full h-auto rounded-lg my-4" loading="lazy" />`
    }

    customRenderer.table = ({ header, body }: { header: string; body: string }) => {
      return `
        <div class="overflow-x-auto my-4">
          <table class="w-full border-collapse">
            <thead>${header}</thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      `
    }

    customRenderer.heading = ({ text, depth }: { text: string; depth: number }) => {
      const slug = text.toLowerCase().replace(/[^\w]+/g, '-')
      return `<h${depth} id="${slug}" class="font-semibold">${text}</h${depth}>`
    }

    return customRenderer
  }, [])

  const render = useCallback(async (content: string): Promise<string> => {
    marked.setOptions({
      renderer,
      gfm,
      breaks,
    })

    return await marked.parse(content)
  }, [renderer, gfm, breaks])

  const renderSync = useCallback((content: string): string => {
    marked.setOptions({
      renderer,
      gfm,
      breaks,
    })

    return marked.parse(content) as string
  }, [renderer, gfm, breaks])

  return { render, renderSync }
}
