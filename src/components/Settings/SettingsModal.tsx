import React from 'react'
import {
  X,
  Sliders,
  Moon,
  Sun,
  Monitor,
  Type,
  Code,
  FolderClock,
  Sparkles,
  Columns,
  Save,
  Trash2,
} from 'lucide-react'
import { useConfigStore } from '@/stores/configStore'
import type { Theme, ViewMode } from '@/types'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings, clearRecentWorkspaces } = useConfigStore()

  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-foreground">偏好设置 (Settings)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-foreground">
          {/* Section 1: Appearance */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>外观与主题 (Theme)</span>
            </h3>

            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'dark' as Theme, label: '深色 (Dark)', icon: Moon },
                { key: 'light' as Theme, label: '浅色 (Light)', icon: Sun },
                { key: 'system' as Theme, label: '跟随系统', icon: Monitor },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => updateSettings({ theme: key })}
                  className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                    settings.theme === key
                      ? 'bg-sky-500/10 border-sky-500 text-sky-400 font-medium'
                      : 'bg-muted/30 border-border/60 hover:bg-muted/60 text-muted-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Editor & Typography */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-indigo-400" />
              <span>编辑器与字体 (Typography)</span>
            </h3>

            {/* Font Size */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/50">
              <div>
                <div className="font-medium text-foreground">正文字体大小</div>
                <div className="text-[11px] text-muted-foreground">调整 Markdown 预览与源码字号</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="12"
                  max="20"
                  value={settings.fontSize || 15}
                  onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
                  className="w-24 accent-sky-500"
                />
                <span className="font-mono text-xs w-8 text-right">{settings.fontSize || 15}px</span>
              </div>
            </div>

            {/* Default View Mode */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/50">
              <div>
                <div className="font-medium text-foreground">默认视图模式</div>
                <div className="text-[11px] text-muted-foreground">打开文档时的初始呈现模式</div>
              </div>
              <div className="flex items-center gap-1 bg-muted/80 p-0.5 rounded-lg border border-border/60">
                {(['preview', 'split', 'source'] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => updateSettings({ defaultViewMode: mode })}
                    className={`px-2.5 py-1 rounded text-xs capitalize transition-all ${
                      settings.defaultViewMode === mode
                        ? 'bg-card text-foreground font-medium shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {mode === 'preview' ? '预览' : mode === 'split' ? '分屏' : '源码'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Recent Workspaces */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FolderClock className="w-3.5 h-3.5 text-amber-400" />
                <span>工作区历史 (Recent Workspaces)</span>
              </h3>
              {settings.recentWorkspaces && settings.recentWorkspaces.length > 0 && (
                <button
                  onClick={clearRecentWorkspaces}
                  className="text-[11px] text-rose-400 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> 清空历史
                </button>
              )}
            </div>

            <div className="p-3 rounded-lg bg-muted/20 border border-border/50 max-h-32 overflow-y-auto space-y-1">
              {!settings.recentWorkspaces || settings.recentWorkspaces.length === 0 ? (
                <div className="text-muted-foreground text-center py-2">无历史记录</div>
              ) : (
                settings.recentWorkspaces.map((path) => (
                  <div key={path} className="text-[11px] font-mono text-muted-foreground truncate py-0.5">
                    {path}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section 4: Window & Close Behavior */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Columns className="w-3.5 h-3.5 text-emerald-400" />
              <span>窗口与关闭行为 (Window & Close)</span>
            </h3>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/50">
              <div>
                <div className="font-medium text-foreground">关闭窗口时的操作</div>
                <div className="text-[11px] text-muted-foreground">控制点击右上角关闭按钮时的默认行为</div>
              </div>
              <div className="flex items-center gap-1 bg-muted/80 p-0.5 rounded-lg border border-border/60">
                {[
                  { key: 'minimize-to-tray', label: '托盘后台' },
                  { key: 'exit', label: '彻底退出' },
                  { key: 'ask', label: '每次询问' },
                ].map(({ key, label }) => {
                  const currentPref = (settings as any).closePreference || 'ask'
                  const isActive = currentPref === key
                  return (
                    <button
                      key={key}
                      onClick={async () => {
                        const newPref = key === 'ask' ? '' : key
                        updateSettings({ closePreference: newPref } as any)
                        if (window.electronAPI?.setClosePreference) {
                          await window.electronAPI.setClosePreference(newPref)
                        }
                      }}
                      className={`px-2.5 py-1 rounded text-xs transition-all ${
                        isActive
                          ? 'bg-card text-foreground font-medium shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Section 5: About info */}
          <div className="p-3 rounded-lg bg-sky-500/5 border border-sky-500/20 text-[11px] text-muted-foreground flex items-center justify-between">
            <div>
              <span className="font-semibold text-foreground">Codex Markdown Preview Tool</span>
              <span className="ml-2 font-mono text-[10px]">v1.0.0</span>
            </div>
            <span className="text-[10px]">Electron + Vite + React 18</span>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
