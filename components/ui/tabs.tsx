'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TabItem {
  id: string
  label: string
  count?: number
}

/**
 * Underline tabs on desktop, segmented control on mobile — same component,
 * same API. Used for the member profile sub-screens.
 */
export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  className?: string
}) {
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = items.findIndex((t) => t.id === value)
    if (e.key === 'ArrowRight') onChange(items[(i + 1) % items.length].id)
    if (e.key === 'ArrowLeft') onChange(items[(i - 1 + items.length) % items.length].id)
  }

  return (
    <>
      {/* desktop: underline tabs */}
      <div
        role="tablist"
        onKeyDown={onKeyDown}
        className={cn('hidden items-center gap-1 border-b border-border px-4 sm:flex', className)}
      >
        {items.map((tab) => {
          const active = tab.id === value
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={cn(
                '-mb-px flex h-9 items-center gap-1.5 border-b-2 px-2.5 text-sm transition-colors duration-150 ease-[var(--ease-ui)]',
                'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
                active
                  ? 'border-primary font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              {typeof tab.count === 'number' ? (
                <span
                  className={cn(
                    'rounded-sm px-1 text-micro tnum',
                    active ? 'bg-primary-soft text-accent-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {tab.count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {/* mobile: segmented control */}
      <div
        role="tablist"
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-border bg-surface p-2 scrollbar-thin sm:hidden"
      >
        {items.map((tab) => {
          const active = tab.id === value
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={cn(
                'h-7 shrink-0 rounded-sm border px-2.5 text-sm transition-colors duration-150',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-surface text-muted-foreground',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </>
  )
}

export function TabPanel({
  id,
  active,
  children,
  className,
}: {
  id: string
  active: boolean
  children: React.ReactNode
  className?: string
}) {
  if (!active) return null
  return (
    <div role="tabpanel" id={`panel-${id}`} className={className}>
      {children}
    </div>
  )
}

/** Compact view switcher (Week / Day / List). Not a navigation tab. */
export function ViewToggle({
  items,
  value,
  onChange,
  className,
}: {
  items: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <div className={cn('inline-flex rounded-md border border-border bg-surface p-0.5', className)}>
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.id)}
            className={cn(
              'h-6 rounded-sm px-2 text-micro font-medium transition-colors duration-150',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
