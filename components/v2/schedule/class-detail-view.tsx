import Link from 'next/link'
import { Clock, MapPin, Users } from 'lucide-react'
import type { GymClass, Member, Staff } from '@/lib/v2/types'
import { LOCATION_LABELS } from '@/lib/v2/types'
import { WEEKDAYS, timeRange } from '@/lib/v2/format'
import { Badge } from '@/components/v2/ui/badge'
import { Button } from '@/components/v2/ui/button'
import { DetailPanel, DetailShell, type DetailStat } from '@/components/v2/shared/detail-shell'
import { cn } from '@/lib/v2/utils'

/** Roster rows only need a name and initials, so this accepts the narrow shape. */
type Attendee = Pick<Member, 'id' | 'name' | 'initials' | 'status'>

function CapacityBar({ filled, capacity }: { filled: number; capacity: number }) {
  const pct = Math.min(100, Math.round((filled / capacity) * 100))
  // Pressure, not just fill: a class at 100% behaves differently from one at 80%,
  // because that is the point where the waitlist starts absorbing demand.
  const tone = pct >= 100 ? 'bg-brand' : pct >= 75 ? 'bg-lime' : 'bg-sky'
  return (
    <div className="flex flex-col gap-2">
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-secondary"
        role="img"
        aria-label={`${filled} of ${capacity} spots booked, ${pct} percent full`}
      >
        <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">{pct}% full</span>
        <span className="tabular-nums">
          {filled}/{capacity}
        </span>
      </div>
    </div>
  )
}

function AttendeeRow({
  person,
  index,
  variant,
}: {
  person: Attendee
  index: number
  variant: 'roster' | 'waitlist'
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-full text-xs font-medium',
          variant === 'roster'
            ? 'bg-accent text-accent-foreground'
            : 'bg-secondary text-muted-foreground',
        )}
        aria-hidden="true"
      >
        {person.initials}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{person.name}</span>
      {variant === 'waitlist' ? (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          #{index + 1} in line
        </span>
      ) : person.status === 'paused' ? (
        <Badge variant="secondary" className="shrink-0 text-xs">
          Paused
        </Badge>
      ) : null}
    </li>
  )
}

export function ClassDetailView({
  gymClass,
  trainer,
  roster,
  waitlist,
}: {
  gymClass: GymClass
  trainer?: Staff
  roster: Attendee[]
  waitlist: Attendee[]
}) {
  const full = roster.length >= gymClass.capacity
  const openSpots = Math.max(0, gymClass.capacity - roster.length)

  const stats: DetailStat[] = [
    {
      label: 'Booked',
      value: `${roster.length}/${gymClass.capacity}`,
      hint: full ? 'At capacity' : `${openSpots} spot${openSpots === 1 ? '' : 's'} open`,
      tone: full ? 'warning' : 'positive',
    },
    {
      label: 'Waitlist',
      value: String(waitlist.length),
      hint: waitlist.length ? 'Promoted in order' : 'Nobody waiting',
      tone: waitlist.length ? 'warning' : 'default',
    },
    { label: 'Duration', value: `${gymClass.durationMin} min`, hint: timeRange(gymClass.startTime, gymClass.durationMin) },
    { label: 'Discipline', value: gymClass.type, hint: LOCATION_LABELS[gymClass.location] },
  ]

  return (
    <DetailShell
      backHref="/schedule"
      backLabel="Back to schedule"
      eyebrow={`${WEEKDAYS[gymClass.dayOfWeek]} · ${gymClass.startTime}`}
      title={gymClass.name}
      // Type is kept in its own case: lowercasing turns HIIT into "hiit".
      subtitle={`A recurring ${gymClass.type} session led by ${trainer?.name ?? 'an unassigned trainer'}. Roster and waitlist reflect the current week.`}
      badges={
        <>
          <Badge className="bg-accent text-accent-foreground">{gymClass.type}</Badge>
          {full ? (
            <Badge className="bg-brand text-white">Full</Badge>
          ) : (
            <Badge variant="secondary">{openSpots} open</Badge>
          )}
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden="true" />
            {LOCATION_LABELS[gymClass.location]} · {gymClass.location === 'indiranagar' ? 'Studio A' : 'Main floor'}
          </span>
        </>
      }
      actions={
        <>
          <Button variant="outline" className="rounded-full bg-card">
            Reschedule
          </Button>
          <Button className="rounded-full bg-brand text-white hover:bg-brand/90" disabled={full}>
            {full ? 'Join waitlist' : 'Book a member'}
          </Button>
        </>
      }
      stats={stats}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <DetailPanel
          title="Roster"
          description={`${roster.length} confirmed for this session.`}
          className="lg:col-span-2"
          aside={
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3.5" aria-hidden="true" />
              {roster.length} confirmed
            </span>
          }
        >
          <CapacityBar filled={roster.length} capacity={gymClass.capacity} />
          {roster.length ? (
            <ul className="divide-y divide-border pt-2">
              {roster.map((m, i) => (
                <AttendeeRow key={m.id} person={m} index={i} variant="roster" />
              ))}
            </ul>
          ) : (
            <p className="py-6 text-sm text-muted-foreground">
              Nobody has booked this session yet.
            </p>
          )}
        </DetailPanel>

        <div className="flex flex-col gap-4">
          <DetailPanel
            title="Waitlist"
            description={
              waitlist.length
                ? 'Promoted automatically when a spot frees up.'
                : 'Members join here once the roster fills.'
            }
          >
            {waitlist.length ? (
              <ul className="divide-y divide-border">
                {waitlist.map((m, i) => (
                  <AttendeeRow key={m.id} person={m} index={i} variant="waitlist" />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">The waitlist is empty.</p>
            )}
          </DetailPanel>

          <DetailPanel title="Trainer" description="Assigned for the recurring slot.">
            {trainer ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-sm font-medium text-ink-foreground"
                    aria-hidden="true"
                  >
                    {trainer.initials}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{trainer.name}</span>
                    <span className="text-xs capitalize text-muted-foreground">{trainer.role}</span>
                  </div>
                </div>
                {trainer.specialties.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {trainer.specialties.map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <Link
                  href={`/trainers/${trainer.id}`}
                  className="inline-flex items-center gap-1.5 text-sm text-brand transition-opacity hover:opacity-80"
                >
                  View trainer profile
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No trainer is assigned to this slot yet.
              </p>
            )}
          </DetailPanel>

          <DetailPanel title="Session" description="Recurring weekly.">
            <ul className="flex flex-col gap-2.5 text-sm">
              <li className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Day</span>
                <span>{WEEKDAYS[gymClass.dayOfWeek]}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="size-3.5" aria-hidden="true" />
                  Time
                </span>
                <span className="tabular-nums">
                  {timeRange(gymClass.startTime, gymClass.durationMin)}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Capacity</span>
                <span className="tabular-nums">{gymClass.capacity}</span>
              </li>
            </ul>
          </DetailPanel>
        </div>
      </div>
    </DetailShell>
  )
}
