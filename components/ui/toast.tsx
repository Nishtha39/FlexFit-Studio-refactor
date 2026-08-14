'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusMarker, type Tone } from '@/components/ui/status-chip'

export interface Toast {
  id: string
  tone: Tone
  title: string
  detail?: string
  /** Single inline action, e.g. "Undo". */
  action?: { label: string; onClick: () => void }
  duration?: number
}

type ToastInput = Omit<Toast, 'id'>

interface ToastContextValue {
  toast: (input: ToastInput) => void
  dismiss: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

const toneClass: Record<Tone, string> = {
  good: 'border-good-border',
  warn: 'border-warn-border',
  danger: 'border-danger-border',
  info: 'border-info-border',
  neutral: 'border-border-strong',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = React.useCallback(
    (input: ToastInput) => {
      const id = Math.random().toString(36).slice(2, 9)
      setToasts((prev) => [...prev.slice(-3), { ...input, id }])
      window.setTimeout(() => dismiss(id), input.duration ?? 4500)
    },
    [dismiss],
  )

  const value = React.useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2.5 rounded-md border bg-popover px-3 py-2.5',
              'shadow-[0_8px_24px_-8px_oklch(0.2_0.01_258/0.22)]',
              'animate-in duration-150 ease-[var(--ease-ui)] slide-in-from-bottom-2',
              toneClass[t.tone],
            )}
          >
            <StatusMarker tone={t.tone} className="mt-1.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{t.title}</p>
              {t.detail ? (
                <p className="mt-0.5 text-micro leading-relaxed text-muted-foreground">{t.detail}</p>
              ) : null}
            </div>
            {t.action ? (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick()
                  dismiss(t.id)
                }}
                className="shrink-0 text-micro font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
              >
                {t.action.label}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/**
 * Screen-reader live region for kiosk check-in results.
 * The kiosk (Batch 4) announces GREEN/AMBER/RED outcomes through this.
 */
export function LiveAnnouncer({ message }: { message: string }) {
  return (
    <p role="status" aria-live="assertive" className="sr-only">
      {message}
    </p>
  )
}
