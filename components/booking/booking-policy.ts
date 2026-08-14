// Booking policy — the single source of truth for what a booking action costs.
//
// Every dialog in this family renders the SAME shape: a headline, a ledger of
// effects, and (when something is irreversible) one consequence line. The rules
// live here rather than in the dialogs so the cancel button in the class detail
// panel and the cancel button on the roster row can never disagree about
// whether a credit comes back.
//
// House rules, stated once:
//   · Cancel more than 12h before the start  → credit returned, spot released.
//   · Cancel inside 12h                      → credit forfeited, late cancel logged.
//   · Waitlist promotion stops 2h before the start; after that the desk fills it.

import type { ID, Member } from '@/lib/types'
import type { Tone } from '@/components/ui/status-chip'
import { memberById } from '@/lib/data/members'
import { getPlan } from '@/lib/data/plans'
import { NOW } from '@/lib/seed'
import { money, percent } from '@/lib/format'
import {
  slotClock,
  slotDate,
  slotStamp,
  type Occurrence,
} from '@/components/schedule/schedule-engine'

export const CANCEL_WINDOW_HOURS = 12
export const PROMOTION_CUTOFF_HOURS = 2
export const DROP_IN_PRICE = 600

/** One line in the "What changes" ledger. Label left, value right. */
export interface BookingEffect {
  label: string
  value: string
  tone?: Tone
}

export type BookingKind = 'book' | 'waitlist' | 'cancel' | 'reschedule'

export function hoursUntil(occ: Occurrence, now: Date = NOW): number {
  return (occ.start.getTime() - now.getTime()) / 3_600_000
}

/** The instant the free-cancellation window shuts. */
export function cancelDeadline(occ: Occurrence): Date {
  return new Date(occ.start.getTime() - CANCEL_WINDOW_HOURS * 3_600_000)
}

export function promotionCutoff(occ: Occurrence): Date {
  return new Date(occ.start.getTime() - PROMOTION_CUTOFF_HOURS * 3_600_000)
}

/** "in 3h 20m" / "18h from now" / "started 40m ago" — never a bare number. */
export function countdown(occ: Occurrence, now: Date = NOW): string {
  const mins = Math.round((occ.start.getTime() - now.getTime()) / 60_000)
  const abs = Math.abs(mins)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const span = h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`
  if (mins < 0) return `started ${span} ago`
  if (abs < 60) return `in ${span}`
  return `in ${span}`
}

export function occurrenceLabel(occ: Occurrence): string {
  return `${occ.gymClass.name} · ${slotDate(occ.start)}, ${slotClock(occ.start)}`
}

function creditLine(member: Member, deltaCredits: number): BookingEffect {
  const credits = member.metrics.creditsRemaining
  const plan = getPlan(member.planId)
  if (credits === null) {
    return {
      label: 'Class credits',
      value: `Unlimited on ${plan?.name ?? 'plan'} — nothing to deduct`,
      tone: 'neutral',
    }
  }
  const after = Math.max(0, credits + deltaCredits)
  if (deltaCredits === 0) {
    return { label: 'Class credits', value: `${credits} left this month — unchanged`, tone: 'neutral' }
  }
  const gained = deltaCredits > 0
  return {
    label: 'Class credits',
    value: gained
      ? `${credits} → ${after} left this month (returned)`
      : `${credits} → ${after} left this month`,
    tone: gained ? 'good' : after === 0 ? 'warn' : 'neutral',
  }
}

function nameOf(id: ID): string {
  return memberById.get(id)?.name ?? id
}

/* -------------------------------------------------------------------------- */
/* Book a confirmed spot                                                      */
/* -------------------------------------------------------------------------- */

export interface BookOutcome {
  kind: 'book' | 'waitlist' | 'blocked'
  headline: string
  detail: string
  effects: BookingEffect[]
  consequence: string | null
  consequenceTone: Tone
  confirmLabel: string
  /** Waitlist position the member would take, when the class is full. */
  position: number | null
}

export function bookOutcome(
  occ: Occurrence,
  member: Member,
  roster: ID[],
  waitlist: ID[],
): BookOutcome {
  const spotsLeft = occ.gymClass.capacity - roster.length

  if (roster.includes(member.id)) {
    return {
      kind: 'blocked',
      headline: `${member.firstName} is already booked`,
      detail: `${member.name} holds a confirmed spot in ${occurrenceLabel(occ)}.`,
      effects: [],
      consequence: null,
      consequenceTone: 'info',
      confirmLabel: 'Close',
      position: null,
    }
  }

  if (occ.state === 'past') {
    return {
      kind: 'blocked',
      headline: 'This class has finished',
      detail: `${occurrenceLabel(occ)} ended at ${slotClock(occ.end)}. Bookings close when a class ends.`,
      effects: [],
      consequence: null,
      consequenceTone: 'info',
      confirmLabel: 'Close',
      position: null,
    }
  }

  if (waitlist.includes(member.id) && spotsLeft <= 0) {
    return {
      kind: 'blocked',
      headline: `${member.firstName} is already on the waitlist`,
      detail: `Position ${waitlist.indexOf(member.id) + 1} of ${waitlist.length}. Promote from the waitlist panel instead of booking again.`,
      effects: [],
      consequence: null,
      consequenceTone: 'info',
      confirmLabel: 'Close',
      position: waitlist.indexOf(member.id) + 1,
    }
  }

  if (spotsLeft <= 0) {
    const offer = waitlistOffer(occ, member, waitlist)
    return {
      kind: 'waitlist',
      headline: 'Class is full — waitlist instead',
      detail: `${occ.gymClass.name} is at ${roster.length}/${occ.gymClass.capacity}. ${member.firstName} can hold position ${offer.position}.`,
      effects: offer.effects,
      consequence: offer.consequence,
      consequenceTone: offer.consequenceTone,
      confirmLabel: `Join waitlist · position ${offer.position}`,
      position: offer.position,
    }
  }

  const credits = member.metrics.creditsRemaining
  const effects: BookingEffect[] = [
    {
      label: 'Spot',
      value: `Confirmed · ${roster.length + 1}/${occ.gymClass.capacity} after booking`,
      tone: 'good',
    },
    creditLine(member, -1),
    {
      label: 'Member sees',
      value: `Booking confirmation with a free-cancel deadline of ${slotStamp(cancelDeadline(occ))}`,
    },
  ]

  const capWarning =
    credits !== null && credits <= 1
      ? `This uses ${member.firstName}'s ${credits === 1 ? 'last' : 'final'} credit of the month. The allowance resets on the 1st — a day pass is ${money(DROP_IN_PRICE)} until then.`
      : null

  return {
    kind: 'book',
    headline: `Book ${member.firstName} into ${occ.gymClass.name}`,
    detail: `${slotDate(occ.start)} at ${slotClock(occ.start)} with ${occ.trainerName} · ${countdown(occ)}.`,
    effects,
    consequence: capWarning,
    consequenceTone: 'warn',
    confirmLabel: 'Confirm booking',
    position: null,
  }
}

/* -------------------------------------------------------------------------- */
/* Waitlist                                                                   */
/* -------------------------------------------------------------------------- */

function hash(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0
  return h
}

export interface WaitlistOffer {
  position: number
  /** How far down the list historically cleared for this class. */
  clearedThrough: number
  weeksCleared: number
  likely: boolean
  history: string
  effects: BookingEffect[]
  consequence: string | null
  consequenceTone: Tone
}

/**
 * Waitlist position with an honest read on whether it will clear. The history
 * is derived from the class id so it is stable, and when a position has never
 * cleared the dialog says so rather than implying a queue always moves.
 */
export function waitlistOffer(occ: Occurrence, member: Member, waitlist: ID[]): WaitlistOffer {
  const h = hash(occ.gymClass.id)
  const clearedThrough = 1 + (h % 3)
  const weeksCleared = 2 + (h % 5 === 0 ? 4 : h % 4)
  const position = waitlist.includes(member.id)
    ? waitlist.indexOf(member.id) + 1
    : waitlist.length + 1
  const likely = position <= clearedThrough

  const history = likely
    ? `Positions 1–${clearedThrough} cleared on this class in ${weeksCleared} of the last 6 weeks.`
    : `Position ${position} has not cleared on this class in the last 6 weeks — only 1–${clearedThrough} did.`

  const effects: BookingEffect[] = [
    {
      label: 'Position',
      value: `${position} of ${Math.max(waitlist.length + (waitlist.includes(member.id) ? 0 : 1), 1)}`,
      tone: likely ? 'info' : 'neutral',
    },
    creditLine(member, 0),
    {
      label: 'If a spot opens',
      value: `Auto-booked and notified, up until ${slotClock(promotionCutoff(occ))} (${PROMOTION_CUTOFF_HOURS}h before start)`,
      tone: 'info',
    },
    {
      label: 'Track record',
      value: history,
      tone: likely ? 'neutral' : 'warn',
    },
  ]

  return {
    position,
    clearedThrough,
    weeksCleared,
    likely,
    history,
    effects,
    consequence: likely
      ? null
      : `Tell ${member.firstName} this probably will not clear. ${occ.gymClass.name} on ${slotDate(occ.start)} has cleared only to position ${clearedThrough} recently — offer a different slot as the real plan, not the waitlist.`,
    consequenceTone: 'warn',
  }
}

/* -------------------------------------------------------------------------- */
/* Cancel                                                                     */
/* -------------------------------------------------------------------------- */

export interface CancelOutcome {
  kind: 'refund' | 'forfeit' | 'closed'
  hoursUntil: number
  deadline: Date
  headline: string
  detail: string
  effects: BookingEffect[]
  consequence: string | null
  consequenceTone: Tone
  confirmLabel: string
  creditReturned: boolean
  statusAfter: 'cancelled' | 'late_cancel'
  promoted: { id: ID; name: string } | null
}

export function cancelOutcome(occ: Occurrence, member: Member, waitlist: ID[]): CancelOutcome {
  const hrs = hoursUntil(occ)
  const deadline = cancelDeadline(occ)
  const first = waitlist[0] ?? null
  const promoted = first ? { id: first, name: nameOf(first) } : null

  if (occ.state === 'past') {
    return {
      kind: 'closed',
      hoursUntil: hrs,
      deadline,
      headline: 'This class has already run',
      detail: `${occurrenceLabel(occ)} ended at ${slotClock(occ.end)}. Mark it as a no-show from the roster instead — cancelling a finished class would hide the attendance record.`,
      effects: [],
      consequence: null,
      consequenceTone: 'info',
      confirmLabel: 'Close',
      creditReturned: false,
      statusAfter: 'cancelled',
      promoted: null,
    }
  }

  const promotionEffect: BookingEffect = promoted
    ? {
        label: 'Waitlist',
        value: `${promoted.name} is promoted from position 1 and notified`,
        tone: 'good',
      }
    : {
        label: 'Waitlist',
        value: 'Nobody waiting — the spot goes back to open booking',
        tone: 'neutral',
      }

  if (hrs > CANCEL_WINDOW_HOURS) {
    return {
      kind: 'refund',
      hoursUntil: hrs,
      deadline,
      headline: `Cancel ${member.firstName}'s spot`,
      detail: `${occurrenceLabel(occ)} starts ${countdown(occ)} — that is inside the free-cancellation window, which shuts at ${slotStamp(deadline)}.`,
      effects: [
        { label: 'Charge', value: 'None — cancelled in time', tone: 'good' },
        creditLine(member, 1),
        promotionEffect,
        { label: 'Record', value: 'Logged as a normal cancellation, not a late cancel' },
      ],
      consequence: null,
      consequenceTone: 'info',
      confirmLabel: 'Cancel booking · credit returned',
      creditReturned: true,
      statusAfter: 'cancelled',
      promoted,
    }
  }

  const credits = member.metrics.creditsRemaining
  return {
    kind: 'forfeit',
    hoursUntil: hrs,
    deadline,
    headline: `Late cancel — ${member.firstName} loses the credit`,
    detail: `${occurrenceLabel(occ)} starts ${countdown(occ)}. The free-cancellation window shut at ${slotStamp(deadline)}.`,
    effects: [
      {
        label: 'Class credit',
        value:
          credits === null
            ? 'Unlimited plan — no credit to lose, but the late cancel is still recorded'
            : `Forfeited · ${credits} → ${Math.max(0, credits - 1)} left this month`,
        tone: 'danger',
      },
      {
        label: 'Record',
        value: `Late cancel on ${member.firstName}'s record · cancels ${percent(member.metrics.cancelRate * 100)} of bookings`,
        tone: 'warn',
      },
      promotionEffect,
      {
        label: 'Member sees',
        value: 'A late-cancel notice quoting the deadline that passed',
      },
    ],
    consequence: `The credit is gone — this cannot be undone from the schedule. Only a manager can reverse a late cancel, and it shows on the audit trail. If ${member.firstName} is ill or the studio is at fault, use the manager override on the member profile instead.`,
    consequenceTone: 'danger',
    confirmLabel: 'Late cancel · forfeit credit',
    creditReturned: false,
    statusAfter: 'late_cancel',
    promoted,
  }
}

/* -------------------------------------------------------------------------- */
/* Reschedule                                                                 */
/* -------------------------------------------------------------------------- */

export interface ReschedulePlan {
  ok: boolean
  /** What the member ends up with at the target. */
  seat: 'booked' | 'waitlisted' | 'none'
  position: number | null
  headline: string
  detail: string
  effects: BookingEffect[]
  consequence: string | null
  consequenceTone: Tone
  confirmLabel: string
  source: CancelOutcome
}

export function reschedulePlan(
  from: Occurrence,
  to: Occurrence | null,
  member: Member,
  rosters: { fromWaitlist: ID[]; toRoster: ID[]; toWaitlist: ID[] },
): ReschedulePlan {
  const source = cancelOutcome(from, member, rosters.fromWaitlist)

  if (!to) {
    return {
      ok: false,
      seat: 'none',
      position: null,
      headline: 'Pick a class to move into',
      detail: `${member.firstName} keeps the spot in ${occurrenceLabel(from)} until a target is chosen.`,
      effects: [],
      consequence: null,
      consequenceTone: 'info',
      confirmLabel: 'Move booking',
      source,
    }
  }

  if (to.key === from.key) {
    return {
      ok: false,
      seat: 'none',
      position: null,
      headline: 'Same class',
      detail: 'Pick a different date or time to move this booking.',
      effects: [],
      consequence: null,
      consequenceTone: 'info',
      confirmLabel: 'Move booking',
      source,
    }
  }

  if (to.state === 'past') {
    return {
      ok: false,
      seat: 'none',
      position: null,
      headline: 'That class has already run',
      detail: `${occurrenceLabel(to)} finished at ${slotClock(to.end)}. Bookings can only move forward.`,
      effects: [],
      consequence: null,
      consequenceTone: 'warn',
      confirmLabel: 'Move booking',
      source,
    }
  }

  if (rosters.toRoster.includes(member.id)) {
    return {
      ok: false,
      seat: 'none',
      position: null,
      headline: `${member.firstName} is already in that class`,
      detail: `${occurrenceLabel(to)} already has a confirmed spot for ${member.name}. Cancel one of the two bookings instead of moving.`,
      effects: [],
      consequence: null,
      consequenceTone: 'warn',
      confirmLabel: 'Move booking',
      source,
    }
  }

  const full = rosters.toRoster.length >= to.gymClass.capacity
  const offer = full ? waitlistOffer(to, member, rosters.toWaitlist) : null

  const effects: BookingEffect[] = [
    {
      label: 'Leaving',
      value: `${occurrenceLabel(from)} · ${source.kind === 'forfeit' ? 'late cancel' : 'cancelled in time'}`,
      tone: source.kind === 'forfeit' ? 'danger' : 'neutral',
    },
    {
      label: 'Joining',
      value: full
        ? `${occurrenceLabel(to)} · waitlist position ${offer?.position}`
        : `${occurrenceLabel(to)} · confirmed ${rosters.toRoster.length + 1}/${to.gymClass.capacity}`,
      tone: full ? 'info' : 'good',
    },
    {
      label: 'Class credits',
      value:
        member.metrics.creditsRemaining === null
          ? 'Unlimited plan — no credit movement'
          : source.kind === 'forfeit'
            ? `Two credits for one session: the forfeited one plus the new booking (${member.metrics.creditsRemaining} → ${Math.max(0, member.metrics.creditsRemaining - 2)})`
            : `Net zero — returned then respent (${member.metrics.creditsRemaining} unchanged)`,
      tone: source.kind === 'forfeit' ? 'danger' : 'good',
    },
    source.promoted
      ? {
          label: 'Waitlist knock-on',
          value: `${source.promoted.name} takes the released spot in ${from.gymClass.name}`,
          tone: 'good',
        }
      : {
          label: 'Waitlist knock-on',
          value: `No waitlist on ${from.gymClass.name} — the spot reopens for booking`,
          tone: 'neutral',
        },
  ]

  if (to.gymClass.trainerId !== from.gymClass.trainerId) {
    effects.push({
      label: 'Trainer changes',
      value: `${from.trainerName} → ${to.trainerName}`,
      tone: 'info',
    })
  }
  if (to.gymClass.type !== from.gymClass.type) {
    effects.push({
      label: 'Class type changes',
      value: `${from.gymClass.type} → ${to.gymClass.type}`,
      tone: 'info',
    })
  }

  return {
    ok: true,
    seat: full ? 'waitlisted' : 'booked',
    position: offer?.position ?? null,
    headline: `Move ${member.firstName} to ${to.gymClass.name}`,
    detail: `${slotDate(to.start)} at ${slotClock(to.start)} with ${to.trainerName} · ${countdown(to)}.`,
    effects,
    consequence:
      source.kind === 'forfeit'
        ? `Moving inside the ${CANCEL_WINDOW_HOURS}-hour window still forfeits the original credit — the member pays twice for one session. Waiving it needs a manager, so say that out loud before confirming.`
        : full
          ? `${member.firstName} is not guaranteed a spot: ${to.gymClass.name} is full and this only holds waitlist position ${offer?.position}. ${offer?.history}`
          : null,
    consequenceTone: source.kind === 'forfeit' ? 'danger' : full ? 'warn' : 'info',
    confirmLabel: full ? `Move to waitlist · position ${offer?.position}` : 'Move booking',
    source,
  }
}

/* -------------------------------------------------------------------------- */
/* Recurrence scope (class-level reschedule)                                  */
/* -------------------------------------------------------------------------- */

export interface ScopeOption {
  id: 'one' | 'following' | 'all'
  label: string
  detail: string
  impact: string
  tone: Tone
}

/**
 * The three scopes a staffer can pick when a class itself moves. Each one
 * states how many members it disturbs — "all occurrences" is the cheap click
 * and the expensive outcome.
 */
export function scopeOptions(occ: Occurrence, bookedCount: number, waitlistCount: number): ScopeOption[] {
  const notified = bookedCount + waitlistCount
  return [
    {
      id: 'one',
      label: 'This occurrence only',
      detail: `${slotDate(occ.start)} moves. Every other ${occ.gymClass.name} stays where it is.`,
      impact: `${notified} member${notified === 1 ? '' : 's'} notified · ${bookedCount} booked, ${waitlistCount} waitlisted`,
      tone: 'info',
    },
    {
      id: 'following',
      label: 'This and all later occurrences',
      detail: `The timetable changes from ${slotDate(occ.start)} onward. Past weeks keep their original times in reporting.`,
      impact: `${notified} notified now, plus everyone who books a later week`,
      tone: 'warn',
    },
    {
      id: 'all',
      label: 'Every occurrence, past included',
      detail: 'Rewrites the template, so historical attendance is re-stamped to the new time.',
      impact: 'Attendance-by-hour reports for earlier weeks will no longer match what happened',
      tone: 'danger',
    },
  ]
}
