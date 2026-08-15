import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { Metric } from '@/lib/v2/domain/types'
import { cn } from '@/lib/v2/utils'

/**
 * Headline metric tile.
 *
 * `emphasis` switches to the inverted ink treatment used for the single most
 * important number on the page.
 */
export function MetricCard({
  metric,
  emphasis = false,
}: {
  metric: Metric
  emphasis?: boolean
}) {
  const negative = metric.trend === 'down'
  const TrendIcon = negative ? ArrowDownRight : ArrowUpRight

  return (
    <div
      className={cn(
        'flex flex-col justify-between rounded-2xl border p-4',
        emphasis
          ? 'border-transparent bg-ink text-white'
          : 'border-border bg-card',
      )}
    >
      <p
        className={cn(
          'text-xs',
          emphasis ? 'text-white/60' : 'text-muted-foreground',
        )}
      >
        {metric.label}
      </p>
      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="font-display text-2xl leading-none font-semibold tracking-[-0.02em]">
          {metric.value}
        </span>
        {metric.delta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium',
              emphasis
                ? 'bg-white/10 text-lime'
                : negative
                  ? 'bg-secondary text-muted-foreground'
                  : 'bg-lime/35 text-foreground',
            )}
          >
            <TrendIcon className="size-3" aria-hidden="true" />
            {metric.delta}
          </span>
        )}
      </div>
    </div>
  )
}

/** Compact variant for the strip under the page header. */
export function MetricStat({ metric }: { metric: Metric }) {
  const negative = metric.trend === 'down'

  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{metric.label}</p>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-xl font-semibold tracking-[-0.02em]">
          {metric.value}
        </span>
        {metric.delta && (
          <span
            className={cn(
              'text-[11px] font-medium',
              negative ? 'text-muted-foreground' : 'text-brand',
            )}
          >
            {metric.delta}
          </span>
        )}
      </div>
    </div>
  )
}
