'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/card'
import { num, percent } from '@/lib/format'
import { WEEKDAY_LABELS, WEEKDAY_LABELS_FULL } from '@/lib/seed'
import {
  HEATMAP_HOURS,
  heatmap,
  heatmapMax,
  heatmapPeak,
  heatmapTrough,
  hourLabel,
} from './dashboard-data'

/**
 * Hour × weekday check-in density over the trailing year. This is a staffing
 * document: the peak tells you when to add a trainer, the trough tells you
 * which staffed hour is being paid for an empty floor.
 */

/** 5 steps only. A continuous gradient reads as precision the data does not have. */
function intensity(count: number): { className: string; step: number } {
  if (count === 0) return { className: 'bg-surface', step: 0 }
  const ratio = heatmapMax > 0 ? count / heatmapMax : 0
  if (ratio > 0.75) return { className: 'bg-primary', step: 4 }
  if (ratio > 0.5) return { className: 'bg-chart-2', step: 3 }
  if (ratio > 0.25) return { className: 'bg-chart-3', step: 2 }
  return { className: 'bg-chart-4', step: 1 }
}

export function AttendanceHeatmap() {
  const [hovered, setHovered] = React.useState<{ weekday: number; hour: number } | null>(null)

  const total = React.useMemo(
    () => heatmap.reduce((s, row) => s + HEATMAP_HOURS.reduce((rs, h) => rs + (row[h] ?? 0), 0), 0),
    [],
  )

  const active = hovered ?? { weekday: heatmapPeak.weekday, hour: heatmapPeak.hour }
  const activeCount = heatmap[active.weekday][active.hour] ?? 0

  // min-w-0: as a grid/flex item this card defaults to min-width:auto, which makes
  // it grow to the table's min-w-[34rem] instead of letting the overflow-x-auto
  // below scroll. Without it the whole page h-scrolls on a phone.
  return (
    <Card className="min-w-0">
      <CardHeader
        title="When the gym is actually busy"
        description="Check-ins by hour and weekday, trailing 52 weeks. Open hours only — 5am to 10pm."
      />

      <CardBody>
        <div className="overflow-x-auto scrollbar-thin">
          {/* table-fixed keeps every hour column the same width — otherwise the
              columns carrying a visible label render wider than the rest. */}
          <table className="w-full min-w-[34rem] table-fixed border-separate border-spacing-0.5">
            <caption className="sr-only">
              Check-in counts by weekday and hour of day over the trailing 52 weeks
            </caption>
            <thead>
              <tr>
                <th scope="col" className="w-8">
                  <span className="sr-only">Weekday</span>
                </th>
                {HEATMAP_HOURS.map((hour) => (
                  <th
                    key={hour}
                    scope="col"
                    className="pb-1 text-center text-micro font-medium text-muted-foreground tnum"
                  >
                    {hour % 3 === 0 ? hourLabel(hour) : <span className="sr-only">{hourLabel(hour)}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKDAY_LABELS.map((label, day) => (
                <tr key={label}>
                  <th
                    scope="row"
                    className="pr-1.5 text-right text-micro font-medium text-muted-foreground"
                  >
                    {label}
                  </th>
                  {HEATMAP_HOURS.map((hour) => {
                    const count = heatmap[day][hour] ?? 0
                    const { className } = intensity(count)
                    const isPeak = heatmapPeak.weekday === day && heatmapPeak.hour === hour
                    const isTrough = heatmapTrough.weekday === day && heatmapTrough.hour === hour
                    const isActive = active.weekday === day && active.hour === hour
                    return (
                      <td key={hour} className="p-0">
                        <button
                          type="button"
                          onMouseEnter={() => setHovered({ weekday: day, hour })}
                          onMouseLeave={() => setHovered(null)}
                          onFocus={() => setHovered({ weekday: day, hour })}
                          onBlur={() => setHovered(null)}
                          aria-label={`${WEEKDAY_LABELS_FULL[day]} ${hourLabel(hour)}: ${num(count)} check-ins`}
                          className={cn(
                            'block h-5 w-full rounded-sm border border-transparent transition-[outline,border] duration-150',
                            className,
                            count === 0 && 'border-border',
                            isActive && 'outline-2 outline-offset-1 outline-foreground',
                            isPeak && !isActive && 'outline-2 outline-offset-1 outline-primary',
                            isTrough && !isActive && 'border-danger-border',
                          )}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-micro font-medium tracking-wide text-muted-foreground uppercase">
              {hovered ? 'Hovered slot' : 'Busiest slot'}
            </span>
            <span className="text-base font-medium text-foreground tnum">
              {WEEKDAY_LABELS_FULL[active.weekday]} {hourLabel(active.hour)} · {num(activeCount)} check-ins
            </span>
            <span className="text-micro text-muted-foreground tnum">
              {percent(total > 0 ? (activeCount / total) * 100 : 0, 1)} of all visits ·{' '}
              {num(Math.round(activeCount / 52))} per week
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-micro text-muted-foreground">
            <span>Fewer</span>
            {[0, 1, 2, 3, 4].map((step) => (
              <span
                key={step}
                aria-hidden
                className={cn(
                  'size-3 rounded-sm',
                  step === 0
                    ? 'border border-border bg-surface'
                    : step === 1
                      ? 'bg-chart-4'
                      : step === 2
                        ? 'bg-chart-3'
                        : step === 3
                          ? 'bg-chart-2'
                          : 'bg-primary',
                )}
              />
            ))}
            <span>More</span>
          </div>
        </div>
      </CardBody>

      <CardFooter className="flex-col items-start gap-1 sm:flex-row sm:items-center">
        <span className="tnum">
          Peak: {WEEKDAY_LABELS_FULL[heatmapPeak.weekday]} {hourLabel(heatmapPeak.hour)} —{' '}
          {num(heatmapPeak.count)} visits
        </span>
        <span className="tnum">
          Quietest staffed hour: {WEEKDAY_LABELS_FULL[heatmapTrough.weekday]}{' '}
          {hourLabel(heatmapTrough.hour)} — {num(heatmapTrough.count)} visits
        </span>
      </CardFooter>
    </Card>
  )
}
