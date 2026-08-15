'use client'

import * as React from 'react'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { PageHeader, PageBody } from '@/components/shell/page-header'
import { RequireScreen } from '@/components/shell/app-shell'
import { Card, CardBody, CardHeader, CapacityBar } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RiskScore, StatusChip } from '@/components/ui/status-chip'
import { EmptyState } from '@/components/ui/empty-state'
import { useStudio } from '@/lib/store/studio-store'
import { MarkAttendanceDialog, RequestCoverDialog } from './class-actions'
import { classes } from '@/lib/data/classes'
import { members, memberById } from '@/lib/data/members'
import { activeTrainers } from '@/lib/data/staff'
import { locationById } from '@/lib/data'
import { isoDate, NOW } from '@/lib/seed'
import { num } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  buildOccurrence,
  slotClock,
  slotDate,
  THIS_WEEK,
  weekDates,
  PRESSURE_META,
  pressureFor,
  type Occurrence,
} from '@/components/schedule/schedule-engine'

/**
 * Trainer's own day. Built for a phone held between sessions: today first, the
 * rest of the week collapsed, and the only two things a trainer needs on the
 * floor — who is booked, and which of their clients is slipping.
 */
const ME = activeTrainers[0]

export function MySchedule() {
  const { connection } = useStudio()
  const [day, setDay] = React.useState(() => isoDate(NOW))
  const [marking, setMarking] = React.useState<Occurrence | null>(null)
  const [covering, setCovering] = React.useState<Occurrence | null>(null)

  const week = React.useMemo(() => {
    const out: Occurrence[] = []
    for (const date of weekDates(THIS_WEEK)) {
      const iso = isoDate(date)
      for (const gymClass of classes.filter((c) => c.trainerId === ME.id && c.dayOfWeek === date.getUTCDay())) {
        out.push(buildOccurrence(gymClass, iso))
      }
    }
    return out.sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [])

  const days = React.useMemo(
    () =>
      weekDates(THIS_WEEK).map((date) => {
        const iso = isoDate(date)
        return { iso, date, count: week.filter((o) => o.isoDate === iso).length }
      }),
    [week],
  )

  const selected = week.filter((o) => o.isoDate === day)
  const clients = members
    .filter((m) => m.assignedTrainerId === ME.id)
    .sort((a, b) => b.risk.score - a.risk.score)

  return (
    <RequireScreen screen="my_schedule">
      <PageHeader
        title="My schedule"
        meta={
          <>
            <span>{ME.name}</span>
            <span aria-hidden>·</span>
            <span className="tnum">{num(week.length)} classes this week</span>
            <span aria-hidden>·</span>
            <span className="tnum">{num(clients.length)} assigned members</span>
          </>
        }
        sticky={false}
      >
        <div className="flex gap-1 overflow-x-auto scrollbar-thin">
          {days.map(({ iso, date, count }) => {
            const active = iso === day
            return (
              <button
                key={iso}
                type="button"
                aria-pressed={active}
                onClick={() => setDay(iso)}
                className={cn(
                  'flex h-14 min-w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border px-2 transition-colors duration-150 ease-[var(--ease-ui)]',
                  active
                    ? 'border-primary bg-primary-soft text-accent-foreground'
                    : 'border-border bg-surface text-muted-foreground hover:border-border-strong',
                )}
              >
                <span className="text-micro uppercase">{slotDate(date).split(' ')[0]}</span>
                <span className="text-base font-semibold tnum">{slotDate(date).split(' ')[1]}</span>
                <span className="text-micro tnum">{count === 0 ? '—' : `${count} cls`}</span>
              </button>
            )
          })}
        </div>
      </PageHeader>

      <PageBody className="mx-auto w-full max-w-2xl">
        {selected.length === 0 ? (
          <EmptyState
            title="No classes on this day"
            description="Pick another day above, or check the studio timetable for cover requests."
          />
        ) : (
          selected.map((occ) => {
            const pressure = pressureFor(occ.gymClass.roster.length, occ.gymClass.capacity)
            const meta = PRESSURE_META[pressure]
            return (
              <Card key={occ.key}>
                <CardHeader
                  title={occ.gymClass.name}
                  description={`${slotClock(occ.start)} · ${occ.durationMin} min · ${locationById.get(occ.gymClass.location)?.shortName}`}
                  actions={<StatusChip tone={meta.tone} label={meta.label} />}
                />
                <CardBody className="flex flex-col gap-3">
                  <CapacityBar
                    filled={occ.gymClass.roster.length}
                    capacity={occ.gymClass.capacity}
                    showLabel
                  />
                  <ul className="flex flex-wrap gap-1.5">
                    {occ.gymClass.roster.slice(0, 12).map((id) => {
                      const member = memberById.get(id)
                      if (!member) return null
                      return (
                        <li key={id}>
                          <Link
                            href={`/members/${id}`}
                            className="flex h-6 items-center gap-1.5 rounded-sm border border-border bg-surface px-1.5 text-micro text-foreground transition-colors hover:border-border-strong"
                          >
                            {member.name}
                            {member.risk.band === 'high' ? (
                              <span aria-label="High risk" className="size-1.5 rounded-full bg-danger" />
                            ) : null}
                          </Link>
                        </li>
                      )
                    })}
                    {occ.gymClass.roster.length > 12 ? (
                      <li className="flex h-6 items-center px-1.5 text-micro text-muted-foreground tnum">
                        +{occ.gymClass.roster.length - 12} more
                      </li>
                    ) : null}
                  </ul>
                  {occ.gymClass.waitlist.length > 0 ? (
                    <p className="text-micro text-muted-foreground tnum">
                      {occ.gymClass.waitlist.length} on the waitlist — the desk promotes them automatically.
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={connection !== 'live'}
                      onClick={() => setMarking(occ)}
                    >
                      Mark attendance
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={connection !== 'live'}
                      onClick={() => setCovering(occ)}
                    >
                      Request cover
                    </Button>
                  </div>
                </CardBody>
              </Card>
            )
          })
        )}

        <Card className="overflow-hidden">
          <CardHeader
            title="My members"
            description="Sorted by risk — the ones worth a word after class."
            actions={
              <Link href="/retention" className="text-micro font-medium text-primary underline-offset-2 hover:underline">
                <span className="flex items-center gap-1">
                  <Users className="size-3.5" />
                  Retention
                </span>
              </Link>
            }
          />
          <ul className="divide-y divide-border">
            {clients.slice(0, 8).map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  <Link href={`/members/${member.id}`} className="block truncate text-sm font-medium text-foreground hover:text-primary hover:underline">
                    {member.name}
                  </Link>
                  <span className="block text-micro text-muted-foreground tnum">
                    {member.metrics.visitsLast30} visits / 30d ·{' '}
                    {member.metrics.daysSinceLastVisit === null
                      ? 'never visited'
                      : `${member.metrics.daysSinceLastVisit}d since last`}
                  </span>
                </span>
                <RiskScore score={member.risk.score} />
              </li>
            ))}
          </ul>
        </Card>
      </PageBody>

      {marking ? (
        <MarkAttendanceDialog open onClose={() => setMarking(null)} occurrence={marking} />
      ) : null}
      {covering ? (
        <RequestCoverDialog
          open
          onClose={() => setCovering(null)}
          occurrence={covering}
          trainer={ME}
        />
      ) : null}
    </RequireScreen>
  )
}
