'use client'

import * as React from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { num } from '@/lib/format'
import { SAVED_VIEW_DEFS, type SavedViewDef } from './member-query'

/**
 * Saved views as a horizontal rail above the table. The sidebar links here too;
 * this rail exists so the active view and its live count are visible while you
 * work, and so switching views costs one click rather than a navigation.
 */
export function MembersSavedViews({
  activeId,
  counts,
  onSelect,
  onClear,
}: {
  activeId: string | null
  /** Live result count per view, computed against the full dataset. */
  counts: Record<string, number>
  onSelect: (view: SavedViewDef) => void
  onClear: () => void
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-subtle px-4 py-1.5 scrollbar-thin">
      <span className="shrink-0 pr-1 text-micro font-medium tracking-wide text-muted-foreground uppercase">
        Views
      </span>

      <button
        type="button"
        aria-pressed={activeId === null}
        onClick={onClear}
        className={cn(
          'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-sm border px-1.5 text-micro transition-colors duration-150',
          activeId === null
            ? 'border-primary bg-primary-soft font-medium text-accent-foreground'
            : 'border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground',
        )}
      >
        All members
      </button>

      {SAVED_VIEW_DEFS.map((view) => {
        const active = view.id === activeId
        const Icon = active ? BookmarkCheck : Bookmark
        return (
          <button
            key={view.id}
            type="button"
            aria-pressed={active}
            title={view.description}
            onClick={() => onSelect(view)}
            className={cn(
              'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-sm border px-1.5 text-micro transition-colors duration-150',
              active
                ? 'border-primary bg-primary-soft font-medium text-accent-foreground'
                : 'border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground',
            )}
          >
            <Icon aria-hidden className={cn('size-3', active ? 'text-primary' : 'opacity-60')} />
            {view.label}
            <span className={cn('tnum', active ? 'text-accent-foreground' : 'opacity-70')}>
              {num(counts[view.id] ?? 0)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
