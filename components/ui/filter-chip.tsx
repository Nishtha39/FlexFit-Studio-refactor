'use client'

import * as React from 'react'
import { X, ChevronDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { num } from '@/lib/format'

/**
 * The filter-chip pattern. Used on every list screen in the product, so it is
 * defined once here: field label · operator · value · remove.
 * Active filters are always visible as removable chips — never hidden in a drawer.
 */

export interface FilterValue {
  id: string
  field: string
  operator?: string
  value: string
}

export function FilterChip({
  filter,
  onRemove,
  onClick,
  className,
}: {
  filter: FilterValue
  onRemove?: (id: string) => void
  onClick?: (id: string) => void
  className?: string
}) {
  return (
    <span
      className={cn(
        'group/chip inline-flex h-6 items-center overflow-hidden rounded-sm border border-border bg-surface text-micro',
        'transition-colors duration-150 ease-[var(--ease-ui)] hover:border-border-strong',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onClick?.(filter.id)}
        className="flex h-full items-center gap-1 px-1.5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
      >
        <span className="text-muted-foreground">{filter.field}</span>
        <span className="text-muted-foreground/60">{filter.operator ?? 'is'}</span>
        <span className="font-medium text-foreground">{filter.value}</span>
      </button>
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove filter ${filter.field} ${filter.value}`}
          onClick={() => onRemove(filter.id)}
          className="flex h-full items-center border-l border-border px-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  )
}

/** Dropdown trigger that adds a filter. Batch 3 wires the menu content. */
export function FilterTrigger({
  label,
  value,
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  value?: string
  active?: boolean
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-sm border px-1.5 text-micro whitespace-nowrap',
        'transition-colors duration-150 ease-[var(--ease-ui)]',
        active
          ? 'border-primary bg-primary-soft text-accent-foreground'
          : 'border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
        className,
      )}
      {...props}
    >
      <span>{label}</span>
      {value ? <span className="font-medium text-foreground">{value}</span> : null}
      <ChevronDown className="size-3 opacity-60" />
    </button>
  )
}

export function AddFilterButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button variant="ghost" size="xs" className="gap-1 text-muted-foreground" {...props}>
      <Plus className="size-3" />
      Filter
    </Button>
  )
}

/** Sticky bar holding triggers, active chips, result count and a clear-all. */
export function FilterBar({
  filters,
  onRemove,
  onClearAll,
  resultCount,
  totalCount,
  children,
  className,
}: {
  filters?: FilterValue[]
  onRemove?: (id: string) => void
  onClearAll?: () => void
  resultCount?: number
  totalCount?: number
  children?: React.ReactNode
  className?: string
}) {
  const hasFilters = (filters?.length ?? 0) > 0
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 border-b border-border bg-surface px-4 py-2',
        className,
      )}
    >
      {children}
      {hasFilters ? (
        <>
          <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
          {filters?.map((filter) => (
            <FilterChip key={filter.id} filter={filter} onRemove={onRemove} />
          ))}
          {onClearAll ? (
            <Button variant="link" size="xs" onClick={onClearAll} className="text-micro">
              Clear all
            </Button>
          ) : null}
        </>
      ) : null}
      {typeof resultCount === 'number' ? (
        <span className="ml-auto text-micro text-muted-foreground tnum">
          {num(resultCount)}
          {typeof totalCount === 'number' && resultCount !== totalCount
            ? ` of ${num(totalCount)}`
            : ''}{' '}
          results
        </span>
      ) : null}
    </div>
  )
}

/** Small tag used on member records (not a filter, not a status). */
export function Tag({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border border-border bg-muted px-1.5 py-px text-micro text-muted-foreground',
        className,
      )}
    >
      {label}
    </span>
  )
}
