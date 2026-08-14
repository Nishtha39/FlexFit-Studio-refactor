'use client'

import * as React from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/input'

/**
 * Dense data table. 32px rows, sticky header, tabular numerals.
 * Numeric columns right-align via `align="right"` on Th/Td.
 */

function TableWrap({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('relative w-full overflow-auto scrollbar-thin', className)}
      {...props}
    />
  )
}

function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full border-collapse text-sm', className)} {...props} />
}

function Thead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('sticky top-0 z-10 bg-subtle after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border', className)}
      {...props}
    />
  )
}

function Tbody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-border', className)} {...props} />
}

export type SortDir = 'asc' | 'desc' | null

function Th({
  className,
  align = 'left',
  sortable,
  sortDir = null,
  onSort,
  width,
  children,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & {
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  sortDir?: SortDir
  onSort?: () => void
  width?: number | string
}) {
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return (
    <th
      scope="col"
      style={width ? { width } : undefined}
      aria-sort={sortDir === 'asc' ? 'ascending' : sortDir === 'desc' ? 'descending' : undefined}
      className={cn(
        'h-8 px-3 text-micro font-medium tracking-wide text-muted-foreground uppercase whitespace-nowrap',
        alignClass,
        className,
      )}
      {...props}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            'inline-flex items-center gap-1 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
            align === 'right' && 'flex-row-reverse',
            sortDir && 'text-foreground',
          )}
        >
          {children}
          {sortDir === 'asc' ? (
            <ArrowUp className="size-3" />
          ) : sortDir === 'desc' ? (
            <ArrowDown className="size-3" />
          ) : (
            <ChevronsUpDown className="size-3 opacity-40" />
          )}
        </button>
      ) : (
        children
      )}
    </th>
  )
}

function Tr({
  className,
  selected,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { selected?: boolean; interactive?: boolean }) {
  return (
    <tr
      data-selected={selected ? '' : undefined}
      className={cn(
        'group/row bg-surface transition-colors duration-150 ease-[var(--ease-ui)]',
        interactive && 'cursor-pointer hover:bg-subtle',
        selected && 'bg-primary-soft hover:bg-primary-soft',
        'data-[focused]:ring-1 data-[focused]:ring-inset data-[focused]:ring-primary',
        className,
      )}
      {...props}
    />
  )
}

function Td({
  className,
  align = 'left',
  muted,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & {
  align?: 'left' | 'right' | 'center'
  muted?: boolean
}) {
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return (
    <td
      className={cn(
        'h-8 px-3 whitespace-nowrap',
        alignClass,
        muted && 'text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

/** Leading select cell — pairs with SelectAllCell in the header. */
function SelectCell({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <Td className="w-8 pr-0">
      <Checkbox
        checked={checked}
        aria-label={`Select ${label}`}
        onChange={(e) => onChange(e.currentTarget.checked)}
        onClick={(e) => e.stopPropagation()}
      />
    </Td>
  )
}

function SelectAllCell({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: (next: boolean) => void
}) {
  const ref = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate) && !checked
  }, [indeterminate, checked])
  return (
    <Th className="w-8 pr-0">
      <Checkbox
        ref={ref}
        checked={checked}
        aria-label="Select all rows"
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
    </Th>
  )
}

/** Bulk action bar — appears only when rows are selected. */
function BulkActionBar({
  count,
  onClear,
  children,
  className,
}: {
  count: number
  onClear: () => void
  children?: React.ReactNode
  className?: string
}) {
  if (count === 0) return null
  return (
    <div
      role="region"
      aria-label={`${count} rows selected`}
      className={cn(
        'sticky bottom-4 z-20 mx-auto flex w-fit items-center gap-2 rounded-md border border-border-strong bg-popover px-2 py-1.5 shadow-[0_4px_16px_-4px_oklch(0.2_0.01_258/0.18)]',
        className,
      )}
    >
      <span className="pl-1 text-micro font-medium text-foreground tnum">{count} selected</span>
      <span aria-hidden className="h-4 w-px bg-border" />
      {children}
      <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={onClear}>
        <X className="size-3.5" />
      </Button>
    </div>
  )
}

/** Text + secondary line stacked inside a single dense cell. */
function CellStack({
  primary,
  secondary,
  className,
}: {
  primary: React.ReactNode
  secondary?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col leading-tight', className)}>
      <span className="truncate font-medium text-foreground">{primary}</span>
      {secondary ? (
        <span className="truncate text-micro text-muted-foreground">{secondary}</span>
      ) : null}
    </div>
  )
}

export {
  TableWrap,
  Table,
  Thead,
  Tbody,
  Th,
  Tr,
  Td,
  SelectCell,
  SelectAllCell,
  BulkActionBar,
  CellStack,
}
