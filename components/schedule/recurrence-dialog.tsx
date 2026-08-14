'use client'

import * as React from 'react'
import { ArrowRight, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WEEKDAY_LABELS_FULL } from '@/lib/seed'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { Modal, ConsequenceNotice } from '@/components/ui/modal'
import { StatusChip } from '@/components/ui/status-chip'
import { EffectLedger } from '@/components/booking/booking-dialogs'
import { scopeOptions, type BookingEffect } from '@/components/booking/booking-policy'
import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  SLOT_MIN,
  occurrenceStart,
  slotClock,
  slotDate,
  startOfWeek,
  toStartTime,
  weekDates,
  type Conflict,
  type Occurrence,
  type RecurrenceScope,
} from './schedule-engine'

/** Every slot the picker offers — the studio's opening hours at drag resolution. */
const SLOT_TIMES: string[] = (() => {
  const out: string[] = []
  for (let m = GRID_START_HOUR * 60; m < GRID_END_HOUR * 60; m += SLOT_MIN) {
    out.push(toStartTime(m))
  }
  return out
})()

/**
 * Recurrence scope. Dragging a class is the easy part; deciding whether the
 * drag rewrites one morning or eighteen months of history is the decision, so
 * the dialog makes the staffer choose it explicitly and shows what each choice
 * costs before the confirm button is reachable.
 *
 * Same skeleton as the booking family: what is happening → ledger → consequence
 * → a confirm button labelled with the outcome.
 */
export function RecurrenceScopeDialog({
  open,
  onClose,
  occurrence,
  toIso,
  toStartTime: toTime,
  bookedCount,
  waitlistCount,
  conflictsFor,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  occurrence: Occurrence
  toIso: string
  toStartTime: string
  bookedCount: number
  waitlistCount: number
  /** Recomputed whenever the target slot changes, including from the pickers. */
  conflictsFor: (iso: string, startTime: string) => Conflict[]
  onConfirm: (scope: RecurrenceScope, notified: number, iso: string, startTime: string) => void
}) {
  const [scope, setScope] = React.useState<RecurrenceScope>('one')
  const [iso, setIso] = React.useState(toIso)
  const [time, setTime] = React.useState(toTime)

  React.useEffect(() => {
    if (!open) return
    setScope('one')
    setIso(toIso)
    setTime(toTime)
  }, [open, toIso, toTime])

  const options = scopeOptions(occurrence, bookedCount, waitlistCount)
  const chosen = options.find((o) => o.id === scope) ?? options[0]
  const target = occurrenceStart(iso, time)
  const targetEnd = new Date(target.getTime() + occurrence.durationMin * 60_000)
  const notified = bookedCount + waitlistCount
  const dayChanged = iso !== occurrence.isoDate
  const timeChanged = time !== occurrence.startTime
  const conflicts = conflictsFor(iso, time)
  const unchanged = !dayChanged && !timeChanged
  const blocked = conflicts.length > 0 || unchanged
  const dayChoices = weekDates(startOfWeek(occurrence.start))

  const effects: BookingEffect[] = [
    {
      label: 'New slot',
      value: `${WEEKDAY_LABELS_FULL[target.getUTCDay()]} ${slotDate(target)} · ${slotClock(target)}–${slotClock(targetEnd)}`,
      tone: 'info',
    },
    {
      label: 'Change',
      value: [
        dayChanged
          ? `${WEEKDAY_LABELS_FULL[occurrence.start.getUTCDay()]} → ${WEEKDAY_LABELS_FULL[target.getUTCDay()]}`
          : null,
        timeChanged ? `${slotClock(occurrence.start)} → ${slotClock(target)}` : null,
      ]
        .filter(Boolean)
        .join(' · ') || 'Dropped back on the same slot — nothing moves',
      tone: dayChanged || timeChanged ? 'warn' : 'neutral',
    },
    {
      label: 'Trainer',
      value: `${occurrence.trainerName} keeps the class · ${occurrence.durationMin} min unchanged`,
      tone: 'neutral',
    },
    {
      label: 'Bookings',
      value:
        notified === 0
          ? 'Nobody is booked — this moves quietly'
          : `${bookedCount} booked and ${waitlistCount} waitlisted keep their spots and get the new time`,
      tone: notified === 0 ? 'neutral' : 'info',
    },
    { label: 'Scope', value: chosen.impact, tone: chosen.tone },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Move ${occurrence.gymClass.name}`}
      description={`${slotDate(occurrence.start)} ${slotClock(occurrence.start)} → ${slotDate(target)} ${slotClock(target)}. Pick how far the change reaches.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Leave it where it is
          </Button>
          <Button
            variant={scope === 'one' ? 'primary' : 'danger'}
            disabled={blocked}
            onClick={() => {
              onConfirm(scope, notified, iso, time)
              onClose()
            }}
          >
            {unchanged
              ? 'Pick a different slot'
              : scope === 'one'
                ? `Move this one · notify ${notified}`
              : scope === 'following'
                ? `Move this and later weeks · notify ${notified}`
                : 'Rewrite every occurrence'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {/* from → to */}
        <div className="flex items-stretch gap-2 rounded-md border border-border bg-subtle p-3">
          <div className="min-w-0 flex-1">
            <p className="text-micro font-medium tracking-wide text-muted-foreground uppercase">
              Currently
            </p>
            <p className="truncate text-sm font-medium text-foreground tnum">
              {WEEKDAY_LABELS_FULL[occurrence.start.getUTCDay()]} {slotClock(occurrence.start)}
            </p>
            <p className="text-micro text-muted-foreground tnum">{slotDate(occurrence.start)}</p>
          </div>
          <div className="flex shrink-0 items-center">
            <ArrowRight aria-hidden className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-micro font-medium tracking-wide text-muted-foreground uppercase">
              Moving to
            </p>
            {/* the drag sets these; the pickers exist so keyboard and touch can
                reach the same action without a pointer gesture */}
            <div className="mt-1 flex gap-1.5">
              <Select
                aria-label="New day"
                value={iso}
                onChange={(e) => setIso(e.currentTarget.value)}
                className="min-w-0 flex-1"
              >
                {dayChoices.map((choice) => {
                  const value = choice.toISOString().slice(0, 10)
                  return (
                    <option key={value} value={value}>
                      {WEEKDAY_LABELS_FULL[choice.getUTCDay()]} {choice.getUTCDate()}
                    </option>
                  )
                })}
              </Select>
              <Select
                aria-label="New start time"
                value={time}
                onChange={(e) => setTime(e.currentTarget.value)}
                className="w-24 shrink-0"
              >
                {SLOT_TIMES.map((slot) => (
                  <option key={slot} value={slot}>
                    {slotClock(occurrenceStart(iso, slot))}
                  </option>
                ))}
              </Select>
            </div>
            <p className="mt-1 text-micro text-muted-foreground tnum">
              {slotDate(target)} · ends {slotClock(targetEnd)}
            </p>
          </div>
        </div>

        {/* conflicts block the move outright */}
        {conflicts.map((conflict) => (
          <ConsequenceNotice
            key={`${conflict.kind}-${conflict.label}`}
            tone="danger"
            headline={conflict.label}
            detail={`${conflict.detail} Drop the class somewhere else, or reassign the trainer first.`}
          />
        ))}

        {/* scope choice */}
        <fieldset className="rounded-md border border-border">
          <legend className="sr-only">How far the change reaches</legend>
          <p className="border-b border-border bg-subtle px-3 py-1.5 text-micro font-medium tracking-wide text-muted-foreground uppercase">
            Apply to
          </p>
          <div className="divide-y divide-border">
            {options.map((option) => {
              const active = option.id === scope
              return (
                <label
                  key={option.id}
                  className={cn(
                    'flex cursor-pointer gap-2.5 px-3 py-2.5 transition-colors duration-150',
                    active ? 'bg-primary-soft' : 'hover:bg-subtle',
                  )}
                >
                  <input
                    type="radio"
                    name="recurrence-scope"
                    value={option.id}
                    checked={active}
                    onChange={() => setScope(option.id)}
                    className="mt-0.5 size-3.5 shrink-0 accent-[var(--color-primary)]"
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground">{option.label}</span>
                      {option.id === 'all' ? (
                        <StatusChip tone="danger" label="Rewrites history" />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">
                      {option.detail}
                    </span>
                    <span className="mt-1 flex items-start gap-1 text-micro text-muted-foreground">
                      <TriangleAlert
                        aria-hidden
                        className={cn(
                          'mt-px size-3 shrink-0',
                          option.tone === 'danger'
                            ? 'text-danger'
                            : option.tone === 'warn'
                              ? 'text-warn'
                              : 'text-info',
                        )}
                      />
                      {option.impact}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <EffectLedger effects={effects} />

        {scope !== 'one' ? (
          <ConsequenceNotice
            tone={scope === 'all' ? 'danger' : 'warn'}
            headline={
              scope === 'all'
                ? 'Reporting for past weeks will stop matching what happened'
                : 'Every future week changes, including weeks members have already booked'
            }
            detail={
              scope === 'all'
                ? `Historic attendance for ${occurrence.gymClass.name} is re-stamped to ${slotClock(target)}, so the attendance-by-hour heatmap and any trainer payroll already signed off will disagree with the original records. Use "this occurrence only" for a one-off cover, and "this and later" for a genuine timetable change.`
                : `Members who booked a later week get a schedule-change notice, and anyone who cannot make ${slotClock(target)} will cancel — usually inside the free window, so those credits come back. Expect a dip in ${occurrence.gymClass.name} for two or three weeks.`
            }
          />
        ) : null}
      </div>
    </Modal>
  )
}
