import { useState, useCallback, useMemo } from 'react'
import type { SearchResult } from '@/types'
import { debounce } from '@/lib/utils'

interface UseSearchOptions {
  content: string
  caseSensitive?: boolean
}

interface UseSearchReturn {
  query: string
  setQuery: (query: string) => void
  results: SearchResult[]
  currentIndex: number
  next: () => void
  previous: () => void
  clear: () => void
  highlightMatches: (text: string) => string
}

export function useSearch({ content, caseSensitive = false }: UseSearchOptions): UseSearchReturn {
  const [query, setQueryState] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)

  const search = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setCurrentIndex(-1)
      return
    }

    const lines = content.split('\n')
    const matches: SearchResult[] = []
    const searchPattern = caseSensitive ? searchQuery : searchQuery.toLowerCase()
    const contentLines = caseSensitive ? lines : lines.map(l => l.toLowerCase())

    contentLines.forEach((line, index) => {
      let startIndex = 0
      while (true) {
        const foundIndex = line.indexOf(searchPattern, startIndex)
        if (foundIndex === -1) break

        matches.push({
          file: '',
          line: index + 1,
          content: lines[index],
          match: lines[index].substring(foundIndex, foundIndex + searchPattern.length),
        })

        startIndex = foundIndex + 1
      }
    })

    setResults(matches)
    setCurrentIndex(matches.length > 0 ? 0 : -1)
  }, [content, caseSensitive])

  const debouncedSearch = useMemo(() => debounce(search, 300), [search])

  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery)
    debouncedSearch(newQuery)
  }, [debouncedSearch])

  const next = useCallback(() => {
    if (results.length === 0) return
    setCurrentIndex((prev) => (prev + 1) % results.length)
  }, [results.length])

  const previous = useCallback(() => {
    if (results.length === 0) return
    setCurrentIndex((prev) => (prev - 1 + results.length) % results.length)
  }, [results.length])

  const clear = useCallback(() => {
    setQueryState('')
    setResults([])
    setCurrentIndex(-1)
  }, [])

  const highlightMatches = useCallback((text: string): string => {
    if (!query.trim() || !results.length) return text

    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
      caseSensitive ? 'g' : 'gi'
    )

    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">$1</mark>')
  }, [query, caseSensitive, results.length])

  return {
    query,
    setQuery,
    results,
    currentIndex,
    next,
    previous,
    clear,
    highlightMatches,
  }
}
