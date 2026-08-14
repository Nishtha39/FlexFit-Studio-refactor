'use client'

import * as React from 'react'

/**
 * J / K list traversal, the keyboard contract used by every long list in the
 * product. J moves down, K moves up, Enter opens, Esc drops focus — the same
 * keys as the check-in feed, so staff learn them once.
 *
 * The active row gets `data-focused`, which the table Tr primitive styles.
 */
export function useListTraversal<T>({
  items,
  onOpen,
  enabled = true,
}: {
  items: T[]
  onOpen?: (item: T, index: number) => void
  enabled?: boolean
}) {
  const [index, setIndex] = React.useState(-1)

  React.useEffect(() => {
    if (index >= items.length) setIndex(items.length - 1)
  }, [items.length, index])

  React.useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toLowerCase()
      if (key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        setIndex((i) => Math.min(items.length - 1, i + 1))
      } else if (key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        setIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'Enter' && index >= 0 && items[index]) {
        e.preventDefault()
        onOpen?.(items[index], index)
      } else if (e.key === 'Escape') {
        setIndex(-1)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [items, index, onOpen, enabled])

  /** Spread onto the row element. */
  const rowProps = (i: number) => ({
    'data-focused': i === index ? '' : undefined,
    onMouseEnter: () => setIndex(i),
  })

  return { index, setIndex, rowProps }
}

/** Small legend so the shortcut is discoverable rather than folklore. */
export function TraversalHint({ label = 'open' }: { label?: string }) {
  return (
    <span className="hidden items-center gap-1.5 text-micro text-muted-foreground lg:inline-flex">
      <kbd className="rounded-sm border border-border bg-muted px-1 font-mono">J</kbd>
      <kbd className="rounded-sm border border-border bg-muted px-1 font-mono">K</kbd>
      to move
      <kbd className="rounded-sm border border-border bg-muted px-1 font-mono">↵</kbd>
      to {label}
    </span>
  )
}
