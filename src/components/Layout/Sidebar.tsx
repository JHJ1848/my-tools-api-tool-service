import React from 'react'
import { Sun, Moon, Monitor, Menu, PanelLeftClose, PanelLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import { Button } from '@/components/ui/button'
import type { Theme } from '@/types'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
  width?: number
}

export function Sidebar({ isOpen, onToggle, children, width = 280 }: SidebarProps) {
  return (
    <div
      className={cn(
        "h-full border-r bg-card transition-all duration-300 flex flex-col",
        isOpen ? "w-[280px]" : "w-12"
      )}
      style={{ width: isOpen ? width : 48 }}
    >
      <div className="h-12 flex items-center justify-between px-2 border-b">
        {isOpen && <span className="text-sm font-semibold px-2">文件浏览器</span>}
        <Button variant="ghost" size="icon" onClick={onToggle}>
          {isOpen ? (
            <PanelLeftClose className="w-4 h-4" />
          ) : (
            <PanelLeft className="w-4 h-4" />
          )}
        </Button>
      </div>

      {isOpen && (
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      )}
    </div>
  )
}

export function ThemeToggle() {
  const { theme, setTheme, actualTheme } = useThemeStore()

  const cycleTheme = () => {
    const themes: Theme[] = ['light', 'dark', 'system']
    const currentIndex = themes.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor

  return (
    <Button variant="ghost" size="icon" onClick={cycleTheme} title={`主题: ${theme}`}>
      <ThemeIcon className="w-4 h-4" />
    </Button>
  )
}
