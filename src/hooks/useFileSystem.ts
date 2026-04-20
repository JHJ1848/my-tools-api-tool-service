import { useCallback, useState } from 'react'
import type { FileNode } from '@/types'
import { SUPPORTED_EXTENSIONS } from '@/lib/config'
import { getApiBase } from '@/lib/apiConfig'

interface UseFileSystemReturn {
  readFile: (path: string) => Promise<string>
  listDirectory: (path: string, depth?: number) => Promise<FileNode[]>
  fileExists: (path: string) => Promise<boolean>
  isLoading: boolean
  error: string | null
}

export function useFileSystem(): UseFileSystemReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const readFile = useCallback(async (path: string): Promise<string> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${getApiBase()}/read-file?path=${encodeURIComponent(path)}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '文件读取失败')
      }

      const data = await response.json()
      return data.content
    } catch (err) {
      const message = err instanceof Error ? err.message : '文件读取失败'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const listDirectory = useCallback(async (path: string, depth: number = 3): Promise<FileNode[]> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${getApiBase()}/list-directory?path=${encodeURIComponent(path)}&depth=${depth}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '目录读取失败')
      }

      const data = await response.json()
      return data.items || []
    } catch (err) {
      const message = err instanceof Error ? err.message : '目录读取失败'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fileExists = useCallback(async (path: string): Promise<boolean> => {
    try {
      const response = await fetch(`${getApiBase()}/read-file?path=${encodeURIComponent(path)}`)
      return response.ok
    } catch {
      return false
    }
  }, [])

  return { readFile, listDirectory, fileExists, isLoading, error }
}
