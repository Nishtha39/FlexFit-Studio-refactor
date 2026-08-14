import * as React from 'react'
import { cn } from '@/lib/utils'

/** Flat, bordered surface. No shadows, no gradients, no accent stripes. */
function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card"
      className={cn('rounded-md border border-border bg-card text-card-foreground', className)}
      {...props}
    />
  )
}

function CardHeader({
  title,
  description,
  actions,
  className,
  children,
  ...props
  // `title` is omitted from the DOM attributes before the intersection: HTMLAttributes
  // already declares `title?: string` (the HTML tooltip attribute), and intersecting
  // that with ReactNode yields the impossible type `string & ReactElement`, so passing
  // a JSX title (as corporate-list does) failed to type-check.
}: Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> & {
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b border-border px-4 py-3',
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        {title ? <h3 className="text-sm font-semibold text-foreground">{title}</h3> : null}
        {description ? (
          <p className="mt-0.5 text-micro text-muted-foreground">{description}</p>
        ) : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  )
}

function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-t border-border bg-subtle px-4 py-2.5 text-micro text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

/** Horizontal rule inside a card body that keeps the 4px rhythm. */
function CardDivider({ className }: { className?: string }) {
  return <hr className={cn('-mx-4 my-4 border-t border-border', className)} />
}

/** Label/value pair used across detail pages. */
function DataPoint({
  label,
  value,
  sub,
  className,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-micro font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="text-base font-medium text-foreground tnum">{value}</span>
      {sub ? <span className="text-micro text-muted-foreground">{sub}</span> : null}
    </div>
  )
}

/** KPI tile. `href` makes it click-through — no dead-end metrics. */
function KpiTile({
  label,
  value,
  delta,
  footnote,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  label: string
  value: React.ReactNode
  delta?: React.ReactNode
  footnote?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1 border-r border-border px-4 py-3 last:border-r-0',
        props.onClick && 'cursor-pointer transition-colors duration-150 hover:bg-subtle',
        className,
      )}
      {...props}
    >
      <span className="truncate text-micro font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {/* flex-wrap + min-w-0: on a 6-up grid the value and the delta cannot
          always share one line. Wrapping keeps the delta inside its own tile
          instead of bleeding into the neighbouring KPI. */}
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 truncate text-xl font-semibold text-foreground tnum">{value}</span>
        {delta}
      </div>
      {footnote ? (
        <span className="truncate text-micro text-muted-foreground">{footnote}</span>
      ) : null}
    </div>
  )
}

/** Capacity / progress bar. Tone shifts as pressure rises. */
function CapacityBar({
  filled,
  capacity,
  className,
  showLabel = false,
}: {
  filled: number
  capacity: number
  className?: string
  showLabel?: boolean
}) {
  const ratio = capacity > 0 ? Math.min(filled / capacity, 1) : 0
  const tone =
    ratio >= 1 ? 'bg-danger' : ratio >= 0.8 ? 'bg-warn' : ratio <= 0.25 ? 'bg-border-strong' : 'bg-primary'
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="h-1.5 min-w-10 flex-1 overflow-hidden rounded-sm bg-muted"
        role="progressbar"
        aria-valuenow={filled}
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-label={`${filled} of ${capacity} spots filled`}
      >
        <div className={cn('h-full transition-[width] duration-150', tone)} style={{ width: `${ratio * 100}%` }} />
      </div>
      {showLabel ? (
        <span className="shrink-0 text-micro text-muted-foreground tnum">
          {filled}/{capacity}
        </span>
      ) : null}
    </div>
  )
}

export { Card, CardHeader, CardBody, CardFooter, CardDivider, DataPoint, KpiTile, CapacityBar }
