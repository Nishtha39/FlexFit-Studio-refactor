'use client'

import * as React from 'react'
import { api } from '@/lib/api/client'
import { useDataVersion, useStudio } from '@/lib/store/studio-store'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusChip } from '@/components/ui/status-chip'
import { cn } from '@/lib/utils'
import { WEEKDAY_LABELS_FULL } from '@/lib/seed'
import { num } from '@/lib/format'
import { classes as allClasses } from '@/lib/data/classes'
import { getStaff } from '@/lib/data/staff'
import type { GymClass, Staff } from '@/lib/types'

/** Half-open overlap, so a 60-minute 18:00 class collides with one at 18:30. */
function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function overlaps(a: GymClass, b: GymClass): boolean {
  if (a.dayOfWeek !== b.dayOfWeek) return false
  const aStart = minutes(a.startTime)
  const bStart = minutes(b.startTime)
  return bStart < aStart + a.durationMin && aStart < bStart + b.durationMin
}

/**
 * Put a class on a trainer's timetable.
 *
 * Every class they could take is listed, and every class they could not is
 * listed too — with the reason. Hiding the unavailable ones would leave somebody
 * scrolling for a class that is on screen everywhere else in the app, wondering
 * why this list is missing it; naming the clash answers the real question, which
 * is "who do I move first".
 */
export function AssignClassDialog({
  open,
  onClose,
  trainer,
}: {
  open: boolean
  onClose: () => void
  trainer: Staff
}) {
  const { mutate, connection, busy } = useStudio()
  const version = useDataVersion()

  const rows = React.useMemo(() => {
    const mine = allClasses.filter((c) => c.trainerId === trainer.id)
    return allClasses
      .filter((c) => c.trainerId !== trainer.id)
      .map((c) => {
        const clash = mine.find((own) => overlaps(own, c))
        const wrongSite = !trainer.locations.includes(c.location)
        return {
          gymClass: c,
          blocked: clash
            ? `Clashes with ${clash.name} at ${clash.startTime}`
            : wrongSite
              ? `${trainer.firstName} does not work at ${c.location.replace('-', ' ')}`
              : null,
        }
      })
      .sort((a, b) => {
        // Assignable first, then by slot — the useful ones are at the top.
        if ((a.blocked === null) !== (b.blocked === null)) return a.blocked === null ? -1 : 1
        return a.gymClass.dayOfWeek - b.gymClass.dayOfWeek || a.gymClass.startTime.localeCompare(b.gymClass.startTime)
      })
  }, [trainer, version])

  const assignable = rows.filter((r) => r.blocked === null)

  function assign(c: GymClass) {
    if (connection !== 'live') return
    const previous = getStaff(c.trainerId)?.name ?? 'the previous trainer'
    void mutate(
      () => api.booking.setClassTrainer.mutate({ classId: c.id, trainerId: trainer.id }),
      {
        success: () => ({
          title: `${trainer.name} now teaches ${c.name}`,
          detail: `${WEEKDAY_LABELS_FULL[c.dayOfWeek]} ${c.startTime} · taken over from ${previous}. The ${num(c.roster.length)} booked members keep their seats.`,
        }),
      },
    ).then((r) => {
      if (r) onClose()
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Assign a class to ${trainer.name}`}
      description={`${num(assignable.length)} of ${num(rows.length)} classes fit around what they already teach.`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          title="Nothing to assign"
          description={`${trainer.firstName} already teaches every class on the timetable.`}
        />
      ) : (
        <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
          {rows.map(({ gymClass: c, blocked }) => (
            <li
              key={c.id}
              className={cn(
                'flex items-center justify-between gap-3 rounded-md border px-2.5 py-2',
                blocked ? 'border-border bg-subtle' : 'border-border',
              )}
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                  <StatusChip tone="neutral" label={c.type} />
                </span>
                <span className="mt-0.5 block truncate text-micro text-muted-foreground">
                  {WEEKDAY_LABELS_FULL[c.dayOfWeek]} {c.startTime} · {c.durationMin} min ·{' '}
                  {num(c.roster.length)}/{num(c.capacity)} booked · currently{' '}
                  {getStaff(c.trainerId)?.name ?? 'unassigned'}
                </span>
                {blocked ? (
                  <span className="mt-0.5 block truncate text-micro text-warn">{blocked}</span>
                ) : null}
              </span>
              <Button
                size="xs"
                variant="secondary"
                disabled={blocked !== null || busy || connection !== 'live'}
                onClick={() => assign(c)}
              >
                Assign
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
