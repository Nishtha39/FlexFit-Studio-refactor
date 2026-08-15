'use client'

import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/v2/ui/chart'
import { ACQUISITION, ACQUISITION_CALLOUT } from '@/lib/v2/data/dashboard'

const CHART_CONFIG = {
  walkIn: { label: 'Walk-in', color: 'var(--chart-1)' },
  referral: { label: 'Referral', color: 'var(--chart-2)' },
  campaign: { label: 'Campaign', color: 'var(--chart-3)' },
} satisfies ChartConfig

/**
 * Stacked new-member acquisition by source over the trailing week.
 *
 * The callout column repeats the peak day's breakdown as plain text, which is
 * what most staff actually want from this chart at a glance.
 */
export function AcquisitionChart() {
  const calloutTotal = ACQUISITION_CALLOUT.breakdown.reduce(
    (sum, item) => sum + item.value,
    0,
  )

  return (
    <section
      aria-labelledby="acquisition-heading"
      className="rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="acquisition-heading" className="font-display text-base font-semibold">
            New members by source
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Last 7 days · 58 joined
          </p>
        </div>
        <ul className="flex items-center gap-3">
          {Object.entries(CHART_CONFIG).map(([key, item]) => (
            <li key={key} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_11rem]">
        <ChartContainer config={CHART_CONFIG} className="h-[220px] w-full min-w-0">
          <AreaChart data={ACQUISITION} margin={{ left: 12, right: 12, top: 8 }}>
            <defs>
              {Object.entries(CHART_CONFIG).map(([key, item]) => (
                <linearGradient
                  key={key}
                  id={`fill-${key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={item.color} stopOpacity={0.7} />
                  <stop offset="100%" stopColor={item.color} stopOpacity={0.15} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            {/* interval={0} keeps Mon and Sun visible; recharts otherwise drops
                end ticks whose labels would spill past the plot edge. */}
            <XAxis
              dataKey="day"
              interval={0}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            />
            <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
            {(['campaign', 'referral', 'walkIn'] as const).map((key) => (
              <Area
                key={key}
                dataKey={key}
                type="monotone"
                stackId="source"
                stroke={CHART_CONFIG[key].color}
                strokeWidth={2}
                fill={`url(#fill-${key})`}
              />
            ))}
          </AreaChart>
        </ChartContainer>

        {/* Peak-day callout. */}
        <div className="flex flex-col justify-center gap-3 rounded-xl bg-secondary/60 p-4">
          <div>
            <p className="text-xs text-muted-foreground">Busiest day</p>
            <p className="mt-1 font-display text-xl font-semibold">
              {ACQUISITION_CALLOUT.day}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                {calloutTotal} joined
              </span>
            </p>
          </div>
          <ul className="flex flex-col gap-2 border-t border-border pt-3">
            {ACQUISITION_CALLOUT.breakdown.map((item) => (
              <li key={item.label} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-xs font-medium">{item.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
