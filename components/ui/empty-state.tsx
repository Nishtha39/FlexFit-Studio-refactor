import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/**
 * Empty states are quiet: a rule, a line of type, one action.
 * No illustrations, no mascots.
 */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
  className,
}: {
  title: string
  description?: string
  action?: { label: string; onClick?: () => void }
  icon?: React.ComponentType<{ className?: string }>
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 border border-dashed border-border bg-subtle px-6 py-12 text-center',
        'rounded-md',
        className,
      )}
    >
      {Icon ? <Icon className="size-5 text-muted-foreground/70" /> : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? (
        <Button size="sm" variant="secondary" className="mt-1" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}

/** "No measurable lift" style result — an honest null finding, not an error. */
export function NullResultState({
  title,
  description,
  className,
}: {
  title: string
  description: string
  className?: string
}) {
  return (
    <div className={cn('rounded-md border border-border bg-muted px-4 py-6', className)}>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  className,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-2 rounded-md border border-danger-border bg-danger-soft px-4 py-4',
        className,
      )}
    >
      <p className="text-sm font-semibold text-danger">{title}</p>
      {description ? (
        <p className="text-sm leading-relaxed text-danger/85">{description}</p>
      ) : null}
      {onRetry ? (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}

/* ------------------------------- skeletons ------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-sm bg-muted', className)} />
}

export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div aria-hidden className="divide-y divide-border border-t border-border">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex h-8 items-center gap-3 px-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn('h-3', c === 0 ? 'w-40' : c === cols - 1 ? 'ml-auto w-16' : 'w-20')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3 rounded-md border border-border bg-card p-4', className)}>
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-6 w-20" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}
