'use client'

import * as React from 'react'
import Link from 'next/link'
import { Check, AlertTriangle, X, Ticket, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { clock, money } from '@/lib/format'
import { Card, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ViewToggle } from '@/components/ui/tabs'
import type { Outcome } from '../kiosk/kiosk-engine'
import type { KioskEvent } from '../kiosk/kiosk-session'

/**
 * Live door feed. Newest first, one row per event.
 *
 * The filter defaults to "Needs attention" rather than "All": on a busy morning
 * the all-view is 200 green rows and the one person who was turned away is
 * three screens down. Staff open this to find problems, not to admire throughput.
 */

const ICON: Record<Outcome, React.ComponentType<{ className?: string }>> = {
  green: Check,
  amber: AlertTriangle,
  red: X,
}

const MARK: Record<Outcome, string> = {
  green: 'border-good-border bg-good-soft text-good',
  amber: 'border-warn-border bg-warn-soft text-warn',
  red: 'border-danger-border bg-danger-soft text-danger',
}

type Filter = 'attention' | 'all'

export function CheckinFeed({ events }: { events: KioskEvent[] }) {
  const [filter, setFilter] = React.useState<Filter>('attention')

  const needsAttention = events.filter((e) => e.outcome !== 'green')
  const shown = filter === 'attention' ? needsAttention : events

  const admitted = events.filter((e) => e.outcome !== 'red').length
  const held = events.length - admitted
  const collected = events.reduce((sum, e) => sum + (e.amount ?? 0), 0)

  return (
    <Card className="flex min-h-0 flex-col">
      <CardHeader
        title="Door activity"
        description={`${admitted} admitted · ${held} held · ${money(collected)} taken at the door`}
        actions={
          <ViewToggle
            value={filter}
            onChange={(id) => setFilter(id as Filter)}
            items={[
              { id: 'attention', label: `Needs attention ${needsAttention.length}` },
              { id: 'all', label: `All ${events.length}` },
            ]}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {shown.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Check}
              title="Nothing needs attention"
              description={`All ${events.length} check-ins today went through cleanly. Switch to All to see the full feed.`}
              action={{ label: 'Show all check-ins', onClick: () => setFilter('all') }}
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((event) => {
              const Icon = ICON[event.outcome]
              return (
                <li
                  key={event.id}
                  className="group/row flex items-center gap-3 px-4 py-2 transition-colors duration-150 hover:bg-subtle"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-sm border',
                      MARK[event.outcome],
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>

                  <span className="w-14 shrink-0 text-micro text-muted-foreground tnum">
                    {clock(event.at)}
                  </span>

                  <div className="flex min-w-0 flex-1 flex-col leading-tight">
                    {event.memberId ? (
                      <Link
                        href={`/members/${event.memberId}`}
                        className="truncate text-sm font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                      >
                        {event.name}
                      </Link>
                    ) : (
                      <span className="truncate text-sm font-medium text-foreground">
                        {event.name}
                        <span className="ml-1.5 font-normal text-muted-foreground">visitor</span>
                      </span>
                    )}
                    <span className="truncate text-micro text-muted-foreground">
                      {event.action}
                    </span>
                  </div>

                  {event.amount ? (
                    <span className="flex shrink-0 items-center gap-1 text-micro font-medium text-foreground tnum">
                      <Ticket aria-hidden className="size-3 text-muted-foreground" />
                      {money(event.amount)}
                    </span>
                  ) : null}

                  {event.resolved ? (
                    <span className="hidden shrink-0 rounded-sm border border-info-border bg-info-soft px-1.5 py-0.5 text-micro font-medium text-info sm:inline">
                      Resolved at door
                    </span>
                  ) : null}

                  {event.memberId ? (
                    <Link
                      href={`/members/${event.memberId}`}
                      aria-label={`Open ${event.name}'s profile`}
                      className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100"
                    >
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Card>
  )
}
