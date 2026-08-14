'use client'

import * as React from 'react'
import { X, AlertTriangle, Info, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { Tone } from '@/components/ui/status-chip'

/**
 * Native <dialog>-free modal so it composes anywhere. Esc closes, focus is
 * trapped loosely (first focusable receives focus), scroll is locked.
 *
 * ConfirmDialog is the shared skeleton for the booking / cancellation family in
 * Batch 6: every destructive or credit-affecting action states its consequence
 * BEFORE the confirm button, never after.
 */

function useLockedBody(open: boolean) {
  React.useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])
}

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  children?: React.ReactNode
  className?: string
}) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  useLockedBody(open)

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus],button,input,select,textarea')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const width = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/25 animate-in fade-in duration-150"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn(
          'relative flex max-h-[90vh] w-full flex-col overflow-hidden border border-border-strong bg-popover',
          'rounded-t-lg sm:rounded-lg',
          'shadow-[0_16px_48px_-12px_oklch(0.2_0.01_258/0.28)]',
          'animate-in duration-150 ease-[var(--ease-ui)] slide-in-from-bottom-2',
          width,
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X className="size-3.5" />
          </Button>
        </div>

        {children ? (
          <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">{children}</div>
        ) : null}

        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-border bg-subtle px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Consequence callout. The single most important component in the booking
 * flows — a forfeit warning must be impossible to miss.
 */
export function ConsequenceNotice({
  tone = 'warn',
  headline,
  detail,
  className,
}: {
  tone?: Tone
  headline: React.ReactNode
  detail?: React.ReactNode
  className?: string
}) {
  const map: Record<Tone, string> = {
    good: 'border-good-border bg-good-soft text-good',
    warn: 'border-warn-border bg-warn-soft text-warn',
    danger: 'border-danger-border bg-danger-soft text-danger',
    info: 'border-info-border bg-info-soft text-info',
    neutral: 'border-border bg-muted text-muted-foreground',
  }
  const Icon = tone === 'danger' ? TriangleAlert : tone === 'warn' ? AlertTriangle : Info
  return (
    <div
      role={tone === 'danger' || tone === 'warn' ? 'alert' : 'status'}
      className={cn('flex gap-2.5 rounded-md border p-3', map[tone], className)}
    >
      <Icon aria-hidden className="mt-px size-4 shrink-0" />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold">{headline}</p>
        {detail ? <div className="text-sm leading-relaxed opacity-90">{detail}</div> : null}
      </div>
    </div>
  )
}

/**
 * Every destructive action confirms AND states its consequence.
 * `consequence` renders above the buttons, inside the scroll region.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  consequence,
  consequenceTone = 'danger',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  children,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: React.ReactNode
  description?: React.ReactNode
  consequence?: React.ReactNode
  consequenceTone?: Tone
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  children?: React.ReactNode
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            data-autofocus
            variant={destructive ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {consequence ? (
          <ConsequenceNotice tone={consequenceTone} headline={consequence} />
        ) : null}
        {children}
      </div>
    </Modal>
  )
}

/** Right-side sheet — used for quick-edit panels and the broadcast composer. */
export function Sheet({
  open,
  onClose,
  title,
  footer,
  children,
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  footer?: React.ReactNode
  children?: React.ReactNode
}) {
  useLockedBody(open)
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/25 animate-in fade-in duration-150"
      />
      <aside
        role="dialog"
        aria-modal="true"
        className="relative flex h-full w-full max-w-md flex-col border-l border-border-strong bg-popover animate-in duration-150 ease-[var(--ease-ui)] slide-in-from-right-4"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X className="size-3.5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-border bg-subtle px-4 py-3">
            {footer}
          </div>
        ) : null}
      </aside>
    </div>
  )
}
