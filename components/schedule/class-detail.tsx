'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRightLeft,
  CalendarClock,
  MapPin,
  Undo2,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ID, Member } from '@/lib/types'
import { memberById } from '@/lib/data/members'
import { locationById } from '@/lib/data/index'
import { Button } from '@/components/ui/button'
import { CapacityBar } from '@/components/ui/card'
import { StatusChip, MemberStatus, RiskScore } from '@/components/ui/status-chip'
import { EmptyState } from '@/components/ui/empty-state'
import { ConsequenceNotice } from '@/components/ui/modal'
import {
  CANCEL_WINDOW_HOURS,
  cancelDeadline,
  countdown,
  hoursUntil,
  promotionCutoff,
} from '@/components/booking/booking-policy'
import {
  PRESSURE_META,
  pressureFor,
  slotClock,
  slotDate,
  slotStamp,
  type Occurrence,
} from './schedule-engine'

/**
 * Class detail. One occurrence, everything the desk needs to answer a phone
 * call about it: who is in, who is waiting and in what order, when the free
 * cancellation window shuts, and the two class-level actions.
 *
 * Waitlist positions are numbered explicitly rather than implied by row order,
 * because "you're third" is the sentence the member actually hears.
 */

function RosterRow({
  member,
  index,
  position,
  disabled,
  onCancel,
  onReschedule,
  onPromote,
  onDrop,
}: {
  member: Member
  index: number
  /** Waitlist position, when this row is a waitlist entry. */
  position?: number
  disabled?: boolean
  onCancel?: () => void
  onReschedule?: () => void
  onPromote?: () => void
  onDrop?: () => void
}) {
  return (
    <li className="group/row flex items-center gap-2.5 px-3 py-2 transition-colors duration-150 hover:bg-subtle">
      <span
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-sm border text-micro font-medium tnum',
          position
            ? 'border-info-border bg-info-soft text-info'
            : 'border-border bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        {position ?? index + 1}
      </span>

      <span className="min-w-0 flex-1">
        <Link
          href={`/members/${member.id}`}
          className="block truncate text-sm text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
        >
          {member.name}
        </Link>
        <span className="flex items-center gap-1.5 truncate text-micro text-muted-foreground">
          {member.metrics.creditsRemaining === null
            ? 'Unlimited'
            : `${member.metrics.creditsRemaining} credits`}
          <span aria-hidden>·</span>
          {member.phone}
        </span>
      </span>

      <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
        {member.risk.score >= 60 ? <RiskScore score={member.risk.score} /> : null}
        <MemberStatus status={member.status} />
      </span>

      {disabled ? null : (
        <span className="flex shrink-0 items-center gap-0.5">
          {onPromote ? (
            <Button variant="ghost" size="xs" onClick={onPromote}>
              Promote
            </Button>
          ) : null}
          {onReschedule ? (
            <Button variant="ghost" size="xs" onClick={onReschedule}>
              Move
            </Button>
          ) : null}
          {onCancel ? (
            <Button variant="ghost" size="xs" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          {onDrop ? (
            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${member.name} from waitlist`} onClick={onDrop}>
              <X className="size-3" />
            </Button>
          ) : null}
        </span>
      )}
    </li>
  )
}

export function ClassDetail({
  occurrence,
  roster,
  waitlist,
  onAdd,
  onMoveClass,
  onRevertMove,
  onCancelMember,
  onRescheduleMember,
  onPromote,
  onDropWaitlist,
  onClose,
  className,
}: {
  occurrence: Occurrence
  roster: ID[]
  waitlist: ID[]
  onAdd: () => void
  onMoveClass: () => void
  onRevertMove?: () => void
  onCancelMember: (member: Member) => void
  onRescheduleMember: (member: Member) => void
  onPromote: (memberId: ID) => void
  onDropWaitlist: (memberId: ID) => void
  onClose?: () => void
  className?: string
}) {
  const occ = occurrence
  const pressure = pressureFor(roster.length, occ.gymClass.capacity)
  const meta = PRESSURE_META[pressure]
  const past = occ.state === 'past'
  const live = occ.state === 'live'
  const hrs = hoursUntil(occ)
  const insideWindow = !past && hrs <= CANCEL_WINDOW_HOURS
  const promotionShut = !past && hrs <= 2
  const location = locationById.get(occ.gymClass.location)

  const rosterMembers = roster
    .map((id) => memberById.get(id))
    .filter((m): m is Member => Boolean(m))
  const waitlistMembers = waitlist
    .map((id) => memberById.get(id))
    .filter((m): m is Member => Boolean(m))

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      {/* identity */}
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-micro font-medium tracking-wide text-muted-foreground uppercase">
              {occ.gymClass.type}
            </p>
            <h2 className="truncate text-base font-semibold text-foreground">{occ.gymClass.name}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground tnum">
              {slotDate(occ.start)} · {slotClock(occ.start)}–{slotClock(occ.end)} · {occ.durationMin} min
            </p>
          </div>
          {onClose ? (
            <Button variant="ghost" size="icon-sm" aria-label="Close class detail" onClick={onClose}>
              <X className="size-3.5" />
            </Button>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusChip tone={meta.tone} label={meta.label} />
          {live ? <StatusChip tone="info" label="In progress" /> : null}
          {past ? <StatusChip tone="neutral" label="Finished" /> : null}
          {waitlist.length > 0 ? (
            <StatusChip tone="info" label={`${waitlist.length} waiting`} />
          ) : null}
          {occ.moved ? <StatusChip tone="warn" label="Moved this session" /> : null}
        </div>

        <dl className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-micro text-muted-foreground">
          <div className="flex items-center gap-1">
            <UserRound aria-hidden className="size-3" />
            <dt className="sr-only">Trainer</dt>
            <dd className="text-foreground">{occ.trainerName}</dd>
          </div>
          <div className="flex items-center gap-1">
            <MapPin aria-hidden className="size-3" />
            <dt className="sr-only">Location</dt>
            <dd>{location?.name ?? occ.gymClass.location}</dd>
          </div>
          {!past ? (
            <div className="flex items-center gap-1">
              <CalendarClock aria-hidden className="size-3" />
              <dt className="sr-only">Starts</dt>
              <dd className="tnum">{countdown(occ)}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-3">
          <CapacityBar
            filled={roster.length}
            capacity={occ.gymClass.capacity}
            showLabel
          />
        </div>

        {!past ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" onClick={onAdd} className="gap-1.5">
              <UserPlus className="size-3.5" />
              {pressure === 'full' ? 'Add to waitlist' : 'Add someone'}
            </Button>
            <Button variant="secondary" size="sm" onClick={onMoveClass} className="gap-1.5">
              <ArrowRightLeft className="size-3.5" />
              Move class
            </Button>
            {occ.moved && onRevertMove ? (
              <Button variant="ghost" size="sm" onClick={onRevertMove} className="gap-1.5">
                <Undo2 className="size-3.5" />
                Put it back
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* policy state — the thing staff quote on the phone */}
      <div className="shrink-0 px-4 py-3">
        {past ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            This class ran at {slotClock(occ.start)} on {slotDate(occ.start)}. Attendance and no-shows are
            recorded against each member&apos;s profile — bookings can no longer be changed here.
          </p>
        ) : insideWindow ? (
          <ConsequenceNotice
            tone="warn"
            headline={`Free cancellation closed at ${slotStamp(cancelDeadline(occ))}`}
            detail={`Anyone cancelling now forfeits the credit and the cancel is logged as a late cancel. ${
              promotionShut
                ? 'Automatic waitlist promotion has also stopped — fill any open spot from this panel.'
                : `Waitlist promotion runs until ${slotClock(promotionCutoff(occ))}.`
            }`}
          />
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Free cancellation until{' '}
            <span className="font-medium text-foreground tnum">
              {slotStamp(cancelDeadline(occ))}
            </span>
            . After that the credit is forfeited. Waitlist promotion stops at{' '}
            <span className="tnum">{slotClock(promotionCutoff(occ))}</span>.
          </p>
        )}
      </div>

      {/* roster + waitlist */}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className="border-y border-border bg-subtle px-4 py-1.5">
          <p className="text-micro font-medium tracking-wide text-muted-foreground uppercase tnum">
            Booked · {roster.length} of {occ.gymClass.capacity}
          </p>
        </div>
        {rosterMembers.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Nobody booked yet"
              description={
                past
                  ? 'This class ran empty. Under-booked slots at this hour are worth reviewing before the next block.'
                  : 'Add the first member from the desk, or leave it open for drop-ins.'
              }
              action={past ? undefined : { label: 'Add someone', onClick: onAdd }}
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rosterMembers.map((member, i) => (
              <RosterRow
                key={member.id}
                member={member}
                index={i}
                disabled={past}
                onCancel={() => onCancelMember(member)}
                onReschedule={() => onRescheduleMember(member)}
              />
            ))}
          </ul>
        )}

        <div className="border-y border-border bg-subtle px-4 py-1.5">
          <p className="text-micro font-medium tracking-wide text-muted-foreground uppercase tnum">
            Waitlist · {waitlist.length} in order
          </p>
        </div>
        {waitlistMembers.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No waitlist"
              description={
                pressure === 'full'
                  ? 'The class is full and nobody is waiting — the next caller takes any cancellation directly.'
                  : `${occ.gymClass.capacity - roster.length} spots are still open, so nobody needs to wait.`
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {waitlistMembers.map((member, i) => (
              <RosterRow
                key={member.id}
                member={member}
                index={i}
                position={i + 1}
                disabled={past}
                onPromote={
                  roster.length < occ.gymClass.capacity || i === 0
                    ? () => onPromote(member.id)
                    : undefined
                }
                onDrop={() => onDropWaitlist(member.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
