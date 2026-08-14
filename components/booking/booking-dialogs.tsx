'use client'

import * as React from 'react'
import { Search, ArrowRight, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ID, Member } from '@/lib/types'
import { memberById } from '@/lib/data/members'
import { lookup } from '@/components/kiosk/kiosk-engine'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal, ConsequenceNotice } from '@/components/ui/modal'
import { StatusChip, MemberStatus, type Tone } from '@/components/ui/status-chip'
import { EmptyState } from '@/components/ui/empty-state'
import {
  slotClock,
  slotDate,
  type Occurrence,
} from '@/components/schedule/schedule-engine'
import {
  bookOutcome,
  cancelOutcome,
  countdown,
  occurrenceLabel,
  reschedulePlan,
  waitlistOffer,
  type BookingEffect,
} from './booking-policy'

/**
 * The booking dialog family. Four flows — book, waitlist, cancel, reschedule —
 * share one skeleton so a member of staff learns the shape once:
 *
 *   title → what is happening
 *   ledger → every effect, one row each, values on the right
 *   consequence → only when something cannot be undone, ABOVE the buttons
 *   footer → cancel, then the confirm button labelled with the outcome
 *
 * The confirm button never says "OK". It says what it does.
 */

/* -------------------------------------------------------------------------- */
/* Shared pieces                                                              */
/* -------------------------------------------------------------------------- */

const valueTone: Record<Tone, string> = {
  good: 'text-good',
  warn: 'text-warn',
  danger: 'text-danger',
  info: 'text-info',
  neutral: 'text-foreground',
}

export function EffectLedger({ effects, className }: { effects: BookingEffect[]; className?: string }) {
  if (effects.length === 0) return null
  return (
    <div className={cn('rounded-md border border-border', className)}>
      <p className="border-b border-border bg-subtle px-3 py-1.5 text-micro font-medium tracking-wide text-muted-foreground uppercase">
        What changes
      </p>
      <dl className="divide-y divide-border">
        {effects.map((effect) => (
          <div key={effect.label} className="flex gap-3 px-3 py-2">
            <dt className="w-28 shrink-0 text-micro text-muted-foreground">{effect.label}</dt>
            <dd
              className={cn(
                'min-w-0 flex-1 text-sm leading-relaxed',
                valueTone[effect.tone ?? 'neutral'],
              )}
            >
              {effect.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Occurrence identity line reused at the top of every dialog body. */
function OccurrenceLine({ occ, label }: { occ: Occurrence; label?: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-border bg-subtle px-3 py-2">
      <Clock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        {label ? (
          <p className="text-micro font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
        ) : null}
        <p className="truncate text-sm font-medium text-foreground">{occ.gymClass.name}</p>
        <p className="text-micro text-muted-foreground tnum">
          {slotDate(occ.start)} · {slotClock(occ.start)}–{slotClock(occ.end)} · {occ.trainerName} ·{' '}
          {countdown(occ)}
        </p>
      </div>
    </div>
  )
}

export function BookingDialogShell({
  open,
  onClose,
  title,
  description,
  effects,
  consequence,
  consequenceTone = 'warn',
  confirmLabel,
  confirmTone = 'primary',
  onConfirm,
  disabled,
  children,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  description?: React.ReactNode
  effects?: BookingEffect[]
  consequence?: string | null
  consequenceTone?: Tone
  confirmLabel: string
  confirmTone?: 'primary' | 'danger'
  onConfirm?: () => void
  disabled?: boolean
  children?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {onConfirm ? 'Keep as is' : 'Close'}
          </Button>
          {onConfirm ? (
            <Button
              variant={confirmTone === 'danger' ? 'danger' : 'primary'}
              disabled={disabled}
              onClick={() => {
                onConfirm()
                onClose()
              }}
            >
              {confirmLabel}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {children}
        {effects && effects.length > 0 ? <EffectLedger effects={effects} /> : null}
        {consequence ? (
          <ConsequenceNotice
            tone={consequenceTone}
            headline={consequenceTone === 'danger' ? 'This cannot be undone here' : 'Worth saying out loud'}
            detail={consequence}
          />
        ) : null}
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* Book a spot                                                                */
/* -------------------------------------------------------------------------- */

export function BookClassDialog({
  open,
  onClose,
  occurrence,
  roster,
  waitlist,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  occurrence: Occurrence
  roster: ID[]
  waitlist: ID[]
  onConfirm: (memberId: ID, asWaitlist: boolean) => void
}) {
  const [query, setQuery] = React.useState('')
  const [selected, setSelected] = React.useState<ID | null>(null)

  React.useEffect(() => {
    if (!open) {
      setQuery('')
      setSelected(null)
    }
  }, [open])

  const results = React.useMemo(() => (query.trim().length > 0 ? lookup(query, 6) : []), [query])
  const member = selected ? memberById.get(selected) : undefined
  const outcome = member ? bookOutcome(occurrence, member, roster, waitlist) : null

  return (
    <BookingDialogShell
      open={open}
      onClose={onClose}
      title={outcome ? outcome.headline : `Add someone to ${occurrence.gymClass.name}`}
      description={
        outcome
          ? outcome.detail
          : `${roster.length}/${occurrence.gymClass.capacity} booked${waitlist.length > 0 ? ` · ${waitlist.length} waiting` : ''}. Search by name, phone or member PIN.`
      }
      effects={outcome?.effects}
      consequence={outcome?.consequence}
      consequenceTone={outcome?.consequenceTone}
      confirmLabel={outcome?.confirmLabel ?? 'Confirm booking'}
      onConfirm={
        outcome && outcome.kind !== 'blocked' && member
          ? () => onConfirm(member.id, outcome.kind === 'waitlist')
          : undefined
      }
      disabled={!member}
    >
      <OccurrenceLine occ={occurrence} label="Class" />

      {member ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
            <p className="truncate text-micro text-muted-foreground">
              {member.metrics.creditsRemaining === null
                ? 'Unlimited plan'
                : `${member.metrics.creditsRemaining} credits left`}{' '}
              · {member.email}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <MemberStatus status={member.status} />
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Change
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              data-autofocus
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              placeholder="Name, phone or PIN"
              aria-label="Search members"
              className="pl-8"
            />
          </div>
          {query.trim().length > 0 && results.length === 0 ? (
            <p className="px-1 text-micro text-muted-foreground">
              {`No member matches "${query.trim()}". Guests are sold a day pass at the kiosk instead.`}
            </p>
          ) : null}
          <ul className="flex flex-col gap-px">
            {results.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setSelected(m.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left transition-colors duration-150 hover:bg-subtle"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-foreground">{m.name}</span>
                    <span className="block truncate text-micro text-muted-foreground">
                      {m.metrics.creditsRemaining === null
                        ? 'Unlimited'
                        : `${m.metrics.creditsRemaining} credits`}{' '}
                      · {m.phone}
                    </span>
                  </span>
                  <MemberStatus status={m.status} className="shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </BookingDialogShell>
  )
}

/* -------------------------------------------------------------------------- */
/* Join waitlist                                                              */
/* -------------------------------------------------------------------------- */

export function WaitlistJoinDialog({
  open,
  onClose,
  occurrence,
  member,
  waitlist,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  occurrence: Occurrence
  member: Member
  waitlist: ID[]
  onConfirm: (memberId: ID) => void
}) {
  const offer = waitlistOffer(occurrence, member, waitlist)
  return (
    <BookingDialogShell
      open={open}
      onClose={onClose}
      title={`Waitlist ${member.firstName} for ${occurrence.gymClass.name}`}
      description={`Full at ${occurrence.gymClass.capacity}/${occurrence.gymClass.capacity}. Position ${offer.position} of ${waitlist.length + 1}.`}
      effects={offer.effects}
      consequence={offer.consequence}
      consequenceTone={offer.consequenceTone}
      confirmLabel={`Join waitlist · position ${offer.position}`}
      onConfirm={() => onConfirm(member.id)}
    >
      <OccurrenceLine occ={occurrence} label="Class" />
    </BookingDialogShell>
  )
}

/* -------------------------------------------------------------------------- */
/* Cancel                                                                     */
/* -------------------------------------------------------------------------- */

export function CancelBookingDialog({
  open,
  onClose,
  occurrence,
  member,
  waitlist,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  occurrence: Occurrence
  member: Member
  waitlist: ID[]
  onConfirm: (memberId: ID, forfeited: boolean) => void
}) {
  const outcome = cancelOutcome(occurrence, member, waitlist)
  const closed = outcome.kind === 'closed'

  return (
    <BookingDialogShell
      open={open}
      onClose={onClose}
      title={outcome.headline}
      description={outcome.detail}
      effects={outcome.effects}
      consequence={outcome.consequence}
      consequenceTone={outcome.consequenceTone}
      confirmLabel={outcome.confirmLabel}
      confirmTone={outcome.kind === 'forfeit' ? 'danger' : 'primary'}
      onConfirm={closed ? undefined : () => onConfirm(member.id, outcome.kind === 'forfeit')}
    >
      <OccurrenceLine occ={occurrence} label="Booking" />
      <div className="flex items-center gap-2">
        <StatusChip
          tone={outcome.kind === 'refund' ? 'good' : outcome.kind === 'forfeit' ? 'danger' : 'neutral'}
          label={
            outcome.kind === 'refund'
              ? 'Inside free-cancel window'
              : outcome.kind === 'forfeit'
                ? 'Past free-cancel window'
                : 'Class finished'
          }
        />
        <span className="text-micro text-muted-foreground">{member.name}</span>
      </div>
    </BookingDialogShell>
  )
}

/* -------------------------------------------------------------------------- */
/* Reschedule                                                                 */
/* -------------------------------------------------------------------------- */

export function RescheduleBookingDialog({
  open,
  onClose,
  from,
  member,
  options,
  rosterFor,
  waitlistFor,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  from: Occurrence
  member: Member
  /** Candidate occurrences the booking can move into. */
  options: Occurrence[]
  rosterFor: (occ: Occurrence) => ID[]
  waitlistFor: (occ: Occurrence) => ID[]
  onConfirm: (target: Occurrence, asWaitlist: boolean, forfeited: boolean) => void
}) {
  const [targetKey, setTargetKey] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) setTargetKey(null)
  }, [open])

  const target = options.find((o) => o.key === targetKey) ?? null
  const plan = reschedulePlan(from, target, member, {
    fromWaitlist: waitlistFor(from),
    toRoster: target ? rosterFor(target) : [],
    toWaitlist: target ? waitlistFor(target) : [],
  })

  return (
    <BookingDialogShell
      open={open}
      onClose={onClose}
      title={plan.headline}
      description={plan.detail}
      effects={plan.effects}
      consequence={plan.consequence}
      consequenceTone={plan.consequenceTone}
      confirmLabel={plan.confirmLabel}
      confirmTone={plan.source.kind === 'forfeit' ? 'danger' : 'primary'}
      onConfirm={
        plan.ok && target
          ? () => onConfirm(target, plan.seat === 'waitlisted', plan.source.kind === 'forfeit')
          : undefined
      }
      disabled={!plan.ok}
      size="lg"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <div className="min-w-0 flex-1">
          <OccurrenceLine occ={from} label="Moving out of" />
        </div>
        <div className="flex items-center justify-center px-1">
          <ArrowRight aria-hidden className="size-4 rotate-90 text-muted-foreground sm:rotate-0" />
        </div>
        <div className="min-w-0 flex-1">
          {target ? (
            <OccurrenceLine occ={target} label="Moving into" />
          ) : (
            <div className="flex h-full items-center rounded-md border border-dashed border-border px-3 py-2 text-micro text-muted-foreground">
              Pick a target class below
            </div>
          )}
        </div>
      </div>

      <div className="rounded-md border border-border">
        <p className="border-b border-border bg-subtle px-3 py-1.5 text-micro font-medium tracking-wide text-muted-foreground uppercase">
          {`Same class type · next 14 days`}
        </p>
        {options.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No comparable class in range"
              description={`Nothing else runs ${from.gymClass.type} in the next fortnight. Cancel instead, or move the member to a different discipline from the schedule.`}
            />
          </div>
        ) : (
          <ul className="max-h-56 divide-y divide-border overflow-y-auto scrollbar-thin">
            {options.map((option) => {
              const roster = rosterFor(option)
              const full = roster.length >= option.gymClass.capacity
              const active = option.key === targetKey
              return (
                <li key={option.key}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTargetKey(option.key)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-150',
                      active ? 'bg-primary-soft' : 'hover:bg-subtle',
                    )}
                  >
                    <span className="w-24 shrink-0 text-sm text-foreground tnum">
                      {slotDate(option.start)}
                    </span>
                    <span className="w-16 shrink-0 text-sm text-foreground tnum">
                      {slotClock(option.start)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">
                        {option.gymClass.name}
                      </span>
                      <span className="block truncate text-micro text-muted-foreground">
                        {option.trainerName}
                      </span>
                    </span>
                    <StatusChip
                      tone={full ? 'danger' : 'neutral'}
                      label={full ? `Full · ${waitlistFor(option).length} waiting` : `${roster.length}/${option.gymClass.capacity}`}
                      className="shrink-0"
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </BookingDialogShell>
  )
}

export { occurrenceLabel }
