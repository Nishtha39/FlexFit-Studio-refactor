'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/card'
import { ButtonGroup, Button } from '@/components/ui/button'
import { compactMoney, money, monthLabel, percent } from '@/lib/format'
import {
  REVENUE_SOURCES,
  revenueByMonth,
  revenueMax,
  revenueMix,
  type RevenueSource,
} from './dashboard-data'

/**
 * Revenue stacked by source. Absolute mode answers "how much", share mode
 * answers "what is carrying us" — the same bars, one toggle, no second chart.
 * Selecting a month pins its breakdown so the numbers can be read exactly.
 */
export function RevenueChart() {
  const [mode, setMode] = React.useState<'absolute' | 'share'>('absolute')
  const [activeMonth, setActiveMonth] = React.useState<string>(
    revenueByMonth[revenueByMonth.length - 1].month,
  )

  const active = revenueByMonth.find((m) => m.month === activeMonth) ?? revenueByMonth[0]
  const first = revenueByMonth[0]
  const growth = first.total > 0 ? ((active.total - first.total) / first.total) * 100 : 0

  return (
    <Card>
      <CardHeader
        title="Revenue by source"
        description="Trailing 12 months. Corporate pools bill on renewal, so their months step rather than curve."
        actions={
          <ButtonGroup>
            <Button
              size="sm"
              variant={mode === 'absolute' ? 'primary' : 'secondary'}
              aria-pressed={mode === 'absolute'}
              onClick={() => setMode('absolute')}
            >
              Amount
            </Button>
            <Button
              size="sm"
              variant={mode === 'share' ? 'primary' : 'secondary'}
              aria-pressed={mode === 'share'}
              onClick={() => setMode('share')}
            >
              Share
            </Button>
          </ButtonGroup>
        }
      />

      <CardBody className="pb-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {REVENUE_SOURCES.map((source) => (
            <span key={source.id} className="inline-flex items-center gap-1.5 text-micro text-muted-foreground">
              <span aria-hidden className={cn('size-2 rounded-sm', source.className)} />
              {source.label}
            </span>
          ))}
        </div>

        <div className="mt-4 flex gap-3">
          {/* y axis */}
          <div
            aria-hidden
            className="flex w-10 shrink-0 flex-col justify-between py-0.5 text-right text-micro text-muted-foreground tnum"
          >
            <span>{mode === 'share' ? '100%' : compactMoney(revenueMax)}</span>
            <span>{mode === 'share' ? '50%' : compactMoney(revenueMax / 2)}</span>
            <span>0</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="relative h-44">
              {/* gridlines */}
              <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
                <span className="h-px w-full bg-border" />
                <span className="h-px w-full bg-border" />
                <span className="h-px w-full bg-border-strong" />
              </div>

              <ol className="relative flex h-full items-end gap-1.5">
                {revenueByMonth.map((row) => {
                  const height = mode === 'share' ? 100 : (row.total / revenueMax) * 100
                  const selected = row.month === activeMonth
                  return (
                    <li key={row.month} className="flex h-full min-w-0 flex-1 items-end">
                      <button
                        type="button"
                        onClick={() => setActiveMonth(row.month)}
                        aria-pressed={selected}
                        aria-label={`${monthLabel(row.month)}: ${money(row.total)}`}
                        className="group flex h-full w-full items-end justify-center rounded-sm px-0.5 transition-colors duration-150 hover:bg-subtle"
                      >
                        <span
                          className={cn(
                            'flex w-full flex-col-reverse overflow-hidden rounded-t-sm transition-[outline] duration-150',
                            selected && 'outline-2 outline-offset-1 outline-primary',
                          )}
                          style={{ height: `${height}%` }}
                        >
                          {REVENUE_SOURCES.map((source) => {
                            const value = row[source.id as RevenueSource]
                            const portion = row.total > 0 ? (value / row.total) * 100 : 0
                            return (
                              <span
                                key={source.id}
                                className={cn(source.className, !selected && 'opacity-85 group-hover:opacity-100')}
                                style={{ height: `${portion}%` }}
                              />
                            )
                          })}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </div>

            <ol aria-hidden className="mt-1.5 flex gap-1.5">
              {revenueByMonth.map((row) => (
                <li
                  key={row.month}
                  className={cn(
                    'min-w-0 flex-1 truncate text-center text-micro tnum',
                    row.month === activeMonth ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {monthLabel(row.month)}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* pinned month readout — the exact numbers behind the selected bar */}
        <div className="mt-4 grid gap-x-4 gap-y-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-0.5">
            <span className="text-micro font-medium tracking-wide text-muted-foreground uppercase">
              {monthLabel(active.month)} total
            </span>
            <span className="text-lg font-semibold text-foreground tnum">{money(active.total)}</span>
          </div>
          {revenueMix(active).map((entry) => {
            const meta = REVENUE_SOURCES.find((s) => s.id === entry.id)
            return (
              <div key={entry.id} className="flex flex-col gap-0.5">
                <span className="inline-flex items-center gap-1.5 text-micro font-medium tracking-wide text-muted-foreground uppercase">
                  <span aria-hidden className={cn('size-2 rounded-sm', meta?.className)} />
                  {meta?.label}
                </span>
                <span className="text-base font-medium text-foreground tnum">
                  {money(entry.value)}
                </span>
                <span className="text-micro text-muted-foreground tnum">
                  {percent(entry.share, 1)} of month
                </span>
              </div>
            )
          })}
        </div>
      </CardBody>

      <CardFooter>
        <span className="tnum">
          {monthLabel(first.month)} → {monthLabel(active.month)}: {percent(growth, 1)}
        </span>
        <span>Amounts exclude refunds, which appear as reversal rows in Payments.</span>
      </CardFooter>
    </Card>
  )
}
