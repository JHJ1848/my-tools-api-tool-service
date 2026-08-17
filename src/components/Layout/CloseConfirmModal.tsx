import React, { useState, useEffect } from 'react'
import { AlertCircle, Minimize2, Power, Check, Info } from 'lucide-react'

interface CloseConfirmModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CloseConfirmModal({ isOpen, onClose }: CloseConfirmModalProps) {
  const [selectedAction, setSelectedAction] = useState<'minimize-to-tray' | 'exit'>('minimize-to-tray')
  const [remember, setRemember] = useState(false)

  // 支持键盘快捷键 Enter 确认，Escape 取消
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleConfirm()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedAction, remember])

  if (!isOpen) return null

  const handleConfirm = async () => {
    if (window.electronAPI?.performCloseAction) {
      await window.electronAPI.performCloseAction(selectedAction, remember)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 text-foreground"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/80 flex items-center gap-3 bg-muted/20">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 flex-shrink-0">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">关闭窗口提示</h3>
            <p className="text-xs text-muted-foreground mt-0.5">请选择关闭窗口时的运行方式</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* LAN Notification info */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-sky-500/5 border border-sky-500/20 text-muted-foreground">
            <Info className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              后台正在运行 <span className="font-semibold text-foreground">HTTP 9527</span> 局域网分享服务。最小化到托盘可保证移动端/同事持续访问。
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            {/* Option 1: Minimize to Tray */}
            <div
              onClick={() => setSelectedAction('minimize-to-tray')}
              className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                selectedAction === 'minimize-to-tray'
                  ? 'bg-sky-500/10 border-sky-500/80 shadow-sm'
                  : 'bg-muted/30 border-border/60 hover:bg-muted/60'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 ${
                  selectedAction === 'minimize-to-tray'
                    ? 'border-sky-500 bg-sky-500 text-white'
                    : 'border-muted-foreground/40'
                }`}
              >
                {selectedAction === 'minimize-to-tray' && <Check className="w-2.5 h-2.5" />}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">最小化到系统托盘后台运行</span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold">
                    推荐
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground leading-normal">
                  应用将驻留在系统托盘，保持 9527 局域网分享与后台服务正常运转。
                </div>
              </div>
            </div>

            {/* Option 2: Exit Application */}
            <div
              onClick={() => setSelectedAction('exit')}
              className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                selectedAction === 'exit'
                  ? 'bg-rose-500/10 border-rose-500/80 shadow-sm'
                  : 'bg-muted/30 border-border/60 hover:bg-muted/60'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 ${
                  selectedAction === 'exit'
                    ? 'border-rose-500 bg-rose-500 text-white'
                    : 'border-muted-foreground/40'
                }`}
              >
                {selectedAction === 'exit' && <Check className="w-2.5 h-2.5" />}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">彻底退出程序</span>
                </div>
                <div className="text-[11px] text-muted-foreground leading-normal">
                  完全关闭桌面端应用并终止 9527 局域网 HTTP 共享服务。
                </div>
              </div>
            </div>
          </div>

          {/* Remember Choice Checkbox */}
          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer select-none text-muted-foreground hover:text-foreground">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-border text-sky-500 focus:ring-0 cursor-pointer accent-sky-500"
              />
              <span className="text-xs">记住我的选择，下次不再提示（可在偏好设置中随时更改）</span>
            </label>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-md border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground font-medium text-xs transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-1.5 rounded-md font-medium text-xs text-white shadow-sm transition-all flex items-center gap-1.5 ${
              selectedAction === 'minimize-to-tray'
                ? 'bg-sky-500 hover:bg-sky-400'
                : 'bg-rose-500 hover:bg-rose-400'
            }`}
          >
            {selectedAction === 'minimize-to-tray' ? <Minimize2 className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
            <span>确定</span>
          </button>
        </div>
      </div>
    </div>
  )
}
