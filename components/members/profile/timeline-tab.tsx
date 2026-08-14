'use client'

import * as React from 'react'
import {
  UserPlus,
  ScanLine,
  CreditCard,
  TriangleAlert,
  RotateCcw,
  Snowflake,
  Play,
  ArrowLeftRight,
  StickyNote,
  HeartPulse,
  Phone,
  TrendingDown,
  Dumbbell,
  UserMinus,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ViewToggle } from '@/components/ui/tabs'
import type { Tone } from '@/components/ui/status-chip'
import type { Member } from '@/lib/types'
import { NOW } from '@/lib/seed'
import { clock, daysAgo, fullDate, money, monthLabel } from '@/lib/format'
import { getStaff } from '@/lib/data/staff'
import { timelineFor, type TimelineEvent, type TimelineKind } from './profile-data'

/**
 * Timeline. One merged feed, reverse-chronological, grouped by month.
 * Each event kind gets its own icon and tone so a failed payment can never be
 * mistaken for a routine check-in when the feed is scanned quickly.
 */

const KIND_META: Record<
  TimelineKind,
  { icon: React.ComponentType<{ className?: string }>; label: string; tone: Tone }
> = {
  joined: { icon: UserPlus, label: 'Joined', tone: 'good' },
  'check-in': { icon: ScanLine, label: 'Check-in', tone: 'neutral' },
  payment: { icon: CreditCard, label: 'Payment', tone: 'good' },
  'payment-failed': { icon: TriangleAlert, label: 'Payment failed', tone: 'danger' },
  refund: { icon: RotateCcw, label: 'Refund', tone: 'info' },
  freeze: { icon: Snowflake, label: 'Freeze', tone: 'info' },
  unfreeze: { icon: Play, label: 'Resumed', tone: 'good' },
  'plan-change': { icon: ArrowLeftRight, label: 'Plan change', tone: 'info' },
  note: { icon: StickyNote, label: 'Note', tone: 'neutral' },
  injury: { icon: HeartPulse, label: 'Injury', tone: 'danger' },
  call: { icon: Phone, label: 'Call', tone: 'info' },
  'risk-change': { icon: TrendingDown, label: 'Risk', tone: 'warn' },
  'trainer-assigned': { icon: Dumbbell, label: 'Trainer', tone: 'info' },
  cancelled: { icon: UserMinus, label: 'Ended', tone: 'danger' },
}

const ICON_TONE: Record<Tone, string> = {
  good: 'border-good-border bg-good-soft text-good',
  warn: 'border-warn-border bg-warn-soft text-warn',
  danger: 'border-danger-border bg-danger-soft text-danger',
  info: 'border-info-border bg-info-soft text-info',
  neutral: 'border-border bg-muted text-muted-foreground',
}

type Group = 'all' | 'money' | 'visits' | 'membership' | 'people'

const GROUPS: Record<Exclude<Group, 'all'>, TimelineKind[]> = {
  money: ['payment', 'payment-failed', 'refund', 'plan-change'],
  visits: ['check-in'],
  membership: ['joined', 'freeze', 'unfreeze', 'cancelled', 'risk-change'],
  people: ['note', 'injury', 'call', 'trainer-assigned'],
}

const PAGE = 25

export function TimelineTab({ member }: { member: Member }) {
  const all = React.useMemo(() => timelineFor(member), [member])
  const [group, setGroup] = React.useState<Group>('all')
  const [limit, setLimit] = React.useState(PAGE)

  React.useEffect(() => setLimit(PAGE), [group, member.id])

  const filtered = React.useMemo(
    () => (group === 'all' ? all : all.filter((e) => GROUPS[group].includes(e.kind))),
    [all, group],
  )
  const shown = filtered.slice(0, limit)

  // Month buckets, preserving the reverse-chronological order.
  const months = React.useMemo(() => {
    const out: { key: string; label: string; events: TimelineEvent[] }[] = []
    for (const event of shown) {
      const key = event.timestamp.slice(0, 7)
      const last = out[out.length - 1]
      if (last && last.key === key) last.events.push(event)
      else out.push({ key, label: monthLabel(event.timestamp), events: [event] })
    }
    return out
  }, [shown])

  const counts = React.useMemo(() => {
    const map = new Map<Group, number>([['all', all.length]])
    for (const g of Object.keys(GROUPS) as Exclude<Group, 'all'>[]) {
      map.set(g, all.filter((e) => GROUPS[g].includes(e.kind)).length)
    }
    return map
  }, [all])

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <ViewToggle
          value={group}
          onChange={(id) => setGroup(id as Group)}
          items={[
            { id: 'all', label: `Everything ${counts.get('all')}` },
            { id: 'money', label: `Money ${counts.get('money')}` },
            { id: 'visits', label: `Visits ${counts.get('visits')}` },
            { id: 'membership', label: `Membership ${counts.get('membership')}` },
            { id: 'people', label: `Notes ${counts.get('people')}` },
          ]}
        />
        <p className="text-micro text-muted-foreground tnum">
          {filtered.length === 0
            ? 'No events'
            : `Showing ${Math.min(limit, filtered.length)} of ${filtered.length}`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nothing in this slice of the history"
          description="Switch back to everything — the full feed merges payments, visits, membership changes and notes into one record."
          action={{ label: 'Show everything', onClick: () => setGroup('all') }}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {months.map((month) => (
            <section key={month.key}>
              <h3 className="sticky top-0 z-10 -mx-4 mb-2 border-b border-border bg-background px-4 pb-1.5 text-micro font-medium tracking-wide text-muted-foreground uppercase">
                {month.label}
              </h3>
              <ol className="relative flex flex-col">
                {/* the spine */}
                <span
                  aria-hidden
                  className="absolute bottom-3 left-[11px] top-3 w-px bg-border"
                />
                {month.events.map((event) => (
                  <TimelineRow key={event.id} event={event} />
                ))}
              </ol>
            </section>
          ))}

          {limit < filtered.length ? (
            <Button
              variant="secondary"
              size="sm"
              className="self-center"
              onClick={() => setLimit((n) => n + PAGE)}
            >
              Load {Math.min(PAGE, filtered.length - limit)} older events
            </Button>
          ) : (
            <p className="self-center text-micro text-muted-foreground">
              Start of the record · joined {fullDate(member.joinedDate)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function TimelineRow({ event }: { event: TimelineEvent }) {
  const meta = KIND_META[event.kind]
  const Icon = meta.icon
  const actor = event.actorId ? getStaff(event.actorId) : null
  const emphasis = event.kind === 'payment-failed' || event.kind === 'injury' || event.kind === 'cancelled'

  return (
    <li className="relative flex gap-2.5 py-2">
      <span
        aria-hidden
        className={cn(
          'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border',
          ICON_TONE[meta.tone],
        )}
      >
        <Icon className="size-3" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p
            className={cn(
              'min-w-0 text-sm',
              emphasis ? 'font-semibold text-foreground' : 'font-medium text-foreground',
            )}
          >
            {event.title}
          </p>
          <div className="flex shrink-0 items-baseline gap-2">
            {typeof event.amount === 'number' ? (
              <span
                className={cn(
                  'text-sm font-medium tnum',
                  event.amount < 0 ? 'text-info' : 'text-foreground',
                )}
              >
                {money(event.amount)}
              </span>
            ) : null}
            <span className="text-micro text-muted-foreground tnum" title={fullDate(event.timestamp)}>
              {clock(event.timestamp)} · {daysAgo(event.timestamp, NOW)}
            </span>
          </div>
        </div>
        {event.detail ? (
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{event.detail}</p>
        ) : null}
        {actor ? (
          <p className="mt-0.5 text-micro text-muted-foreground">
            {meta.label} by {actor.name}
          </p>
        ) : null}
      </div>
    </li>
  )
}
