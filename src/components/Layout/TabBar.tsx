import React from 'react'
import { X, Pin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTabsStore } from '@/stores/tabsStore'
import { ScrollArea } from '@/components/ui/scroll-area'

interface TabBarProps {
  onTabChange: (path: string) => void
}

export function TabBar({ onTabChange }: TabBarProps) {
  const { tabs, activeTabId, setActiveTab, removeTab, togglePinTab } = useTabsStore()

  if (tabs.length === 0) {
    return null
  }

  const pinnedTabs = tabs.filter(t => t.isPinned)
  const unpinnedTabs = tabs.filter(t => !t.isPinned)

  return (
    <div className="h-10 bg-muted/50 border-b flex items-center">
      <ScrollArea orientation="horizontal" className="flex-1 h-full">
        <div className="flex items-center">
          {pinnedTabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onClick={() => {
                setActiveTab(tab.id)
                onTabChange(tab.path)
              }}
              onClose={() => removeTab(tab.id)}
              onPin={() => togglePinTab(tab.id)}
            />
          ))}

          {pinnedTabs.length > 0 && unpinnedTabs.length > 0 && (
            <div className="w-px h-5 bg-border mx-1" />
          )}

          {unpinnedTabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onClick={() => {
                setActiveTab(tab.id)
                onTabChange(tab.path)
              }}
              onClose={() => removeTab(tab.id)}
              onPin={() => togglePinTab(tab.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

interface TabItemProps {
  tab: {
    id: string
    name: string
    path: string
    isActive?: boolean
    isPinned?: boolean
  }
  isActive: boolean
  onClick: () => void
  onClose: () => void
  onPin: () => void
}

function TabItem({ tab, isActive, onClick, onClose, onPin }: TabItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1 px-3 h-full cursor-pointer border-r transition-colors",
        "hover:bg-accent/50",
        isActive && "bg-background border-b-2 border-b-background"
      )}
      onClick={onClick}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onPin(); }}
        className={cn(
          "p-0.5 rounded hover:bg-accent",
          tab.isPinned && "text-primary"
        )}
        title={tab.isPinned ? "取消固定" : "固定标签"}
      >
        <Pin className={cn("w-3 h-3", !tab.isPinned && "opacity-30 group-hover:opacity-100")} />
      </button>

      <span className={cn(
        "text-sm max-w-[120px] truncate",
        isActive && "font-medium"
      )}>
        {tab.name}
      </span>

      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className={cn(
          "p-0.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
        )}
        title="关闭"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}
