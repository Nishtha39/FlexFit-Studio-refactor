import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/v2/utils'

export interface DetailStat {
  label: string
  value: string
  /** Small qualifier under the value, e.g. "of 16 booked". */
  hint?: string
  tone?: 'default' | 'positive' | 'warning' | 'critical'
}

const toneText: Record<NonNullable<DetailStat['tone']>, string> = {
  default: 'text-foreground',
  positive: 'text-foreground',
  warning: 'text-foreground',
  critical: 'text-destructive',
}

const toneRule: Record<NonNullable<DetailStat['tone']>, string> = {
  default: 'bg-border',
  positive: 'bg-lime',
  warning: 'bg-brand',
  critical: 'bg-destructive',
}

/**
 * Chrome shared by every entity detail screen: a back link to the index, the
 * title block with badges and actions, an optional stat strip, then the body.
 *
 * Kept presentational on purpose — each screen decides what its stats mean, so
 * this never reaches into the data layer.
 */
export function DetailShell({
  backHref,
  backLabel,
  eyebrow,
  title,
  subtitle,
  badges,
  actions,
  stats,
  children,
}: {
  backHref: string
  backLabel: string
  eyebrow?: string
  title: string
  subtitle?: string
  badges?: ReactNode
  actions?: ReactNode
  stats?: DetailStat[]
  children: ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {backLabel}
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            {eyebrow ? (
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {eyebrow}
              </span>
            ) : null}
            <h1 className="font-display text-2xl font-semibold tracking-tight text-balance lg:text-3xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
                {subtitle}
              </p>
            ) : null}
            {badges ? <div className="flex flex-wrap items-center gap-2 pt-1">{badges}</div> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>

      {stats?.length ? (
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => {
            const tone = s.tone ?? 'default'
            return (
              <div
                key={s.label}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4"
              >
                <span className={cn('h-1 w-8 rounded-full', toneRule[tone])} aria-hidden="true" />
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="flex flex-col gap-0.5">
                  <span
                    className={cn(
                      'font-display text-xl font-semibold tabular-nums',
                      toneText[tone],
                    )}
                  >
                    {s.value}
                  </span>
                  {s.hint ? (
                    <span className="text-xs text-muted-foreground">{s.hint}</span>
                  ) : null}
                </dd>
              </div>
            )
          })}
        </dl>
      ) : null}

      {children}
    </div>
  )
}

/** A titled white panel — the unit every detail body is built from. */
export function DetailPanel({
  title,
  description,
  aside,
  className,
  children,
}: {
  title: string
  description?: string
  aside?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn('rounded-3xl border border-border bg-card p-5 lg:p-6', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-base font-semibold">{title}</h2>
          {description ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {aside}
      </div>
      <div className="pt-4">{children}</div>
    </section>
  )
}
