'use client'

import * as React from 'react'
import Link from 'next/link'
import { CalendarDays, Dumbbell, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardBody, CardFooter, DataPoint, CapacityBar } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusChip } from '@/components/ui/status-chip'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog } from '@/components/ui/modal'
import { api } from '@/lib/api/client'
import { useDataVersion, useStudio } from '@/lib/store/studio-store'
import type { GymClass, Member } from '@/lib/types'
import { WEEKDAY_LABELS_FULL } from '@/lib/seed'
import { num } from '@/lib/format'
import { getStaff } from '@/lib/data/staff'
import { memberById } from '@/lib/data/members'
import { classes } from '@/lib/data/classes'
import { programsFor, type ProgramEntry } from './profile-data'
import { AssignTrainerDialog } from './assign-trainer-dialog'

/**
 * Programs tab. What this member is actually booked into, week by week, plus the
 * personal-training relationship.
 *
 * A booking belongs to the class, not to this screen, so removing one calls the
 * same `booking.cancel` the schedule and the member portal call — which is what
 * promotes the next person off the waitlist. This used to hide the row in local
 * state instead, so the seat was never released and the person waiting for it
 * never heard anything.
 */
export function ProgramsTab({ member }: { member: Member }) {
  const { mutate, connection, busy } = useStudio()
  const version = useDataVersion()
  const [dropping, setDropping] = React.useState<ProgramEntry | null>(null)
  const [assignOpen, setAssignOpen] = React.useState(false)

  const entries = React.useMemo(() => programsFor(member), [member, version])

  const booked = entries.filter((e) => e.waitlistPosition === null)
  const waitlisted = entries.filter((e) => e.waitlistPosition !== null)
  const trainer = member.assignedTrainerId ? getStaff(member.assignedTrainerId) : null

  const byDay = React.useMemo(() => {
    const map = new Map<number, ProgramEntry[]>()
    for (const entry of entries) {
      const list = map.get(entry.gymClass.dayOfWeek) ?? []
      list.push(entry)
      map.set(entry.gymClass.dayOfWeek, list)
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [entries])

  // What the trainer teaches that this member is not in — a concrete next step
  // rather than a generic "recommend a class" nudge.
  const suggestions = React.useMemo(() => {
    if (!trainer) return []
    const bookedIds = new Set(entries.map((e) => e.gymClass.id))
    return classes
      .filter(
        (c) =>
          c.trainerId === trainer.id &&
          !bookedIds.has(c.id) &&
          c.roster.length < c.capacity &&
          c.location === member.homeLocation,
      )
      .slice(0, 3)
  }, [trainer, entries, member.homeLocation, version])

  /**
   * Give up the place. The server promotes the head of the waitlist and
   * renumbers the queue, so the toast reports who actually got the seat rather
   * than claiming the class simply has room again.
   */
  const drop = (entry: ProgramEntry) => {
    if (connection !== 'live') return
    const wasWaitlisted = entry.waitlistPosition !== null
    void mutate(
      () => api.booking.cancel.mutate({ classId: entry.gymClass.id, memberId: member.id }),
      {
        success: (r) => {
          const promoted = r.promoted ? memberById.get(r.promoted)?.name : null
          return {
            title: wasWaitlisted ? 'Removed from the waitlist' : 'Removed from the roster',
            detail: r.promoted
              ? `${entry.gymClass.name} · ${promoted ?? 'the next person on the waitlist'} took the spot.`
              : `${entry.gymClass.name} · ${WEEKDAY_LABELS_FULL[entry.gymClass.dayOfWeek]} ${entry.gymClass.startTime}.`,
          }
        },
      },
    ).then(() => setDropping(null))
  }

  /** Book a suggested slot straight from here rather than sending them away. */
  const book = (c: GymClass) => {
    if (connection !== 'live') return
    void mutate(() => api.booking.book.mutate({ classId: c.id, memberId: member.id }), {
      success: (r) => ({
        title: r.kind === 'roster' ? `Booked into ${c.name}` : `Waitlisted for ${c.name}`,
        detail:
          r.kind === 'roster'
            ? `${WEEKDAY_LABELS_FULL[c.dayOfWeek]} ${c.startTime}, every week.`
            : `Position ${r.position + 1} — somebody took the last spot first.`,
      }),
    })
  }

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-4">
        {entries.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Not booked into any classes"
            description="Floor-only members churn measurably faster than members with a recurring class slot. Book one recurring class in their usual window."
            // Booking starts from the class, not the member — you pick the slot
            // that has room and then say who takes it — so this goes to the
            // schedule rather than opening a dialog that has nothing to book.
            action={{ label: 'Open the schedule', href: '/schedule' }}
          />
        ) : (
          byDay.map(([day, list]) => (
            <Card key={day}>
              <CardHeader
                title={WEEKDAY_LABELS_FULL[day]}
                description={`${num(list.length)} on the weekly plan`}
              />
              <ul className="divide-y divide-border">
                {list.map((entry) => (
                  <ProgramRow
                    key={entry.gymClass.id}
                    entry={entry}
                    disabled={connection !== 'live'}
                    onDrop={() => setDropping(entry)}
                  />
                ))}
              </ul>
            </Card>
          ))
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardHeader title="Weekly commitment" />
          <CardBody className="grid grid-cols-2 gap-4">
            <DataPoint label="Booked" value={num(booked.length)} sub="Confirmed spots" />
            <DataPoint
              label="Waitlisted"
              value={num(waitlisted.length)}
              sub={waitlisted.length > 0 ? 'Not guaranteed' : 'None pending'}
            />
            <DataPoint
              label="Allowance"
              value={
                member.metrics.planVisitsPerMonth === null
                  ? 'Unlimited'
                  : `${num(member.metrics.planVisitsPerMonth)} / mo`
              }
              sub="On their plan"
            />
            <DataPoint
              label="Avg visits"
              value={member.metrics.avgVisitsPerWeek.toFixed(1)}
              sub="Per week, actual"
            />
          </CardBody>
          {member.metrics.planVisitsPerMonth !== null ? (
            <CardFooter>
              <span>
                {booked.length * 4 > member.metrics.planVisitsPerMonth
                  ? `Booked ${num(booked.length * 4)} class visits a month against a ${num(member.metrics.planVisitsPerMonth)}-visit plan — they will hit the cap.`
                  : `Booked commitment fits inside the ${num(member.metrics.planVisitsPerMonth)}-visit allowance.`}
              </span>
            </CardFooter>
          ) : null}
        </Card>

        <Card>
          <CardHeader
            title="Personal training"
            actions={
              trainer ? (
                <StatusChip tone={trainer.active ? 'good' : 'danger'} label={trainer.active ? 'Active' : 'Departed'} />
              ) : (
                <StatusChip tone="neutral" label="Unassigned" />
              )
            }
          />
          {trainer ? (
            <>
              <CardBody className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground"
                  >
                    {trainer.initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium text-foreground">{trainer.name}</p>
                    <p className="truncate text-micro text-muted-foreground">
                      {trainer.specialties.join(' · ')}
                    </p>
                  </div>
                </div>
                {!trainer.active ? (
                  <p className="rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-sm leading-relaxed text-danger">
                    This trainer has left. Members reassigned late after a departure are the single
                    largest churn cohort in the data — reassign before the next session.
                  </p>
                ) : null}
              </CardBody>
              <CardFooter>
                <span>{trainer.email}</span>
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={connection !== 'live'}
                  onClick={() => setAssignOpen(true)}
                >
                  Reassign
                </Button>
              </CardFooter>
            </>
          ) : (
            <CardBody>
              <p className="text-sm leading-relaxed text-muted-foreground">
                No trainer owns this relationship. Nobody is accountable for noticing when they stop
                coming.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2.5"
                disabled={connection !== 'live'}
                onClick={() => setAssignOpen(true)}
              >
                <Dumbbell className="size-3.5" />
                Assign a trainer
              </Button>
            </CardBody>
          )}
        </Card>

        {suggestions.length > 0 ? (
          <Card>
            <CardHeader
              title="Open slots with their trainer"
              description="Same trainer, same location, space available."
            />
            <ul className="divide-y divide-border">
              {suggestions.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-2">
                  <span className="min-w-0 truncate text-sm">
                    <span className="font-medium text-foreground">{c.name}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      · {WEEKDAY_LABELS_FULL[c.dayOfWeek].slice(0, 3)} {c.startTime}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-micro text-muted-foreground tnum">
                      {c.capacity - c.roster.length} free
                    </span>
                    <Button
                      variant="secondary"
                      size="xs"
                      disabled={busy || connection !== 'live'}
                      onClick={() => book(c)}
                    >
                      Book
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
            <CardFooter>
              <span>Booking here takes a recurring spot — one week only is a schedule change</span>
              <Link
                href="/schedule"
                className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
              >
                Schedule
                <ArrowRight className="size-3" />
              </Link>
            </CardFooter>
          </Card>
        ) : null}
      </div>

      <ConfirmDialog
        open={dropping !== null}
        onClose={() => setDropping(null)}
        onConfirm={() => dropping && drop(dropping)}
        confirmDisabled={busy || connection !== 'live'}
        title={
          dropping?.waitlistPosition === null
            ? `Remove from ${dropping?.gymClass.name}`
            : `Leave the ${dropping?.gymClass.name} waitlist`
        }
        confirmLabel={dropping?.waitlistPosition === null ? 'Remove from roster' : 'Leave waitlist'}
        consequenceTone={dropping?.waitlistPosition === null ? 'danger' : 'warn'}
        consequence={
          dropping?.waitlistPosition === null
            ? 'The spot is released immediately and the first person on the waitlist is promoted — it cannot be taken back if the class is full.'
            : `They lose position #${dropping?.waitlistPosition} and rejoin at the back of the queue.`
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Removing a recurring booking here affects this occurrence and every future one. Single-week
          changes are made on the schedule.
        </p>
      </ConfirmDialog>

      <AssignTrainerDialog open={assignOpen} onClose={() => setAssignOpen(false)} member={member} />
    </div>
  )
}

function ProgramRow({
  entry,
  onDrop,
  disabled,
}: {
  entry: ProgramEntry
  onDrop: () => void
  disabled: boolean
}) {
  const { gymClass: c, waitlistPosition } = entry
  const trainer = getStaff(c.trainerId)
  const full = c.roster.length >= c.capacity

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
      <span className="w-14 shrink-0 text-sm font-medium text-foreground tnum">{c.startTime}</span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
          <StatusChip tone="neutral" label={c.type} />
          {waitlistPosition ? (
            <StatusChip tone="info" label={`Waitlist #${waitlistPosition}`} />
          ) : (
            <StatusChip tone="good" label="Booked" />
          )}
        </span>
        <span className="mt-0.5 block truncate text-micro text-muted-foreground">
          {trainer?.name ?? 'Unassigned'} · {c.durationMin} min ·{' '}
          {c.location.replace('-', ' ')}
        </span>
      </span>

      <span className="flex w-32 shrink-0 flex-col gap-1">
        <CapacityBar filled={c.roster.length} capacity={c.capacity} showLabel />
        <span
          className={cn(
            'text-micro tnum',
            full ? 'text-danger' : 'text-muted-foreground',
          )}
        >
          {full
            ? `Full · ${num(c.waitlist.length)} waiting`
            : `${num(c.capacity - c.roster.length)} spots left`}
        </span>
      </span>

      <Button variant="ghost" size="xs" disabled={disabled} onClick={onDrop}>
        {waitlistPosition ? 'Leave' : 'Remove'}
      </Button>
    </li>
  )
}
