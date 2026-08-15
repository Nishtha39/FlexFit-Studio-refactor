import * as React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Crumb {
  label: string
  href?: string
}

/**
 * The page header appears on every screen except the kiosk:
 * breadcrumb · title (+ meta) · one primary action.
 */
export function PageHeader({
  title,
  crumbs,
  meta,
  actions,
  children,
  sticky = true,
  className,
}: {
  title: React.ReactNode
  crumbs?: Crumb[]
  meta?: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
  sticky?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'border-b border-border bg-surface px-4 pb-3 pt-3',
        sticky && 'sticky top-0 z-20',
        className,
      )}
    >
      {crumbs && crumbs.length > 0 ? (
        <nav aria-label="Breadcrumb" className="mb-1.5">
          <ol className="flex items-center gap-1 text-micro text-muted-foreground">
            {crumbs.map((crumb, i) => (
              <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-foreground">
                    {crumb.label}
                  </span>
                )}
                {i < crumbs.length - 1 ? (
                  <ChevronRight aria-hidden className="size-3 opacity-50" />
                ) : null}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground text-balance">
            {title}
          </h1>
          {meta ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-muted-foreground">
              {meta}
            </div>
          ) : null}
        </div>
        {/* Page actions are buttons; they never belong on paper. */}
        {actions ? (
          <div data-print="hide" className="flex shrink-0 items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>

      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  )
}

/** Standard content region padding — keeps vertical rhythm consistent. */
export function PageBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-4 p-4 pb-20 lg:pb-8', className)} {...props} />
}

/** Section heading inside a page body. */
export function SectionTitle({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? (
          <p className="mt-0.5 max-w-prose text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}
