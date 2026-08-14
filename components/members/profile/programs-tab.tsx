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
import { useToast } from '@/components/ui/toast'
import type { GymClass, Member } from '@/lib/types'
import { WEEKDAY_LABELS_FULL } from '@/lib/seed'
import { num } from '@/lib/format'
import { getStaff } from '@/lib/data/staff'
import { classes } from '@/lib/data/classes'
import { programsFor, type ProgramEntry } from './profile-data'

/**
 * Programs tab. What this member is actually booked into, week by week, plus the
 * personal-training relationship. Cancellation here is deliberately a stub that
 * states the policy — Batch 6 owns the booking / cancellation dialog family and
 * this screen must not fork it.
 */
export function ProgramsTab({ member }: { member: Member }) {
  const { toast } = useToast()
  const [dropping, setDropping] = React.useState<ProgramEntry | null>(null)
  const [removed, setRemoved] = React.useState<string[]>([])

  const all = React.useMemo(() => programsFor(member), [member])
  const entries = all.filter((e) => !removed.includes(e.gymClass.id))

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
  }, [trainer, entries, member.homeLocation])

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-4">
        {entries.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Not booked into any classes"
            description="Floor-only members churn measurably faster than members with a recurring class slot. Book one recurring class in their usual window."
            action={{ label: 'Open the schedule', onClick: () => {} }}
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
                <Button variant="ghost" size="xs">
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
              <Button variant="secondary" size="sm" className="mt-2.5">
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
                  <span className="shrink-0 text-micro text-muted-foreground tnum">
                    {c.capacity - c.roster.length} free
                  </span>
                </li>
              ))}
            </ul>
            <CardFooter>
              <span>Booking happens on the schedule so capacity stays authoritative</span>
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
        onConfirm={() => {
          if (!dropping) return
          const id = dropping.gymClass.id
          setRemoved((prev) => [...prev, id])
          toast({
            tone: 'warn',
            title:
              dropping.waitlistPosition === null
                ? 'Removed from the roster'
                : 'Removed from the waitlist',
            detail: `${dropping.gymClass.name} · ${WEEKDAY_LABELS_FULL[dropping.gymClass.dayOfWeek]} ${dropping.gymClass.startTime}`,
            action: {
              label: 'Undo',
              onClick: () => setRemoved((prev) => prev.filter((x) => x !== id)),
            },
          })
        }}
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
    </div>
  )
}

function ProgramRow({ entry, onDrop }: { entry: ProgramEntry; onDrop: () => void }) {
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

      <Button variant="ghost" size="xs" onClick={onDrop}>
        {waitlistPosition ? 'Leave' : 'Remove'}
      </Button>
    </li>
  )
}
