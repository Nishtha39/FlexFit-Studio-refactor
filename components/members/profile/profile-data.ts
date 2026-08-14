import type { CheckIn, GymClass, Member, Payment } from '@/lib/types'
import { NOW, addDays, isoStamp, makeRng, startOfDay } from '@/lib/seed'
import { checkInsByMember } from '@/lib/data/attendance'
import { paymentsForMember } from '@/lib/data/payments'
import { classes } from '@/lib/data/classes'
import { staff, activeTrainers, getStaff } from '@/lib/data/staff'
import { getPlan } from '@/lib/data/plans'

/**
 * Per-member derived records for the profile screen. Batch 2 owns the primary
 * entities; the notes and the timeline are presentation-layer derivations built
 * deterministically from the member's own id, so a given member shows the same
 * history on every render without polluting the Batch 2 contract.
 */

function rngForMember(id: string) {
  // Hash the member id into a stable 32-bit seed.
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return makeRng(h >>> 0)
}

/* -------------------------------------------------------------------------- */
/* Notes                                                                       */
/* -------------------------------------------------------------------------- */

export type NoteKind = 'note' | 'call' | 'injury' | 'goal' | 'complaint'

export interface MemberNote {
  id: string
  kind: NoteKind
  body: string
  authorId: string
  timestamp: string
  /** Pinned notes surface at check-in — injuries and access issues. */
  pinned: boolean
}

const NOTE_TEMPLATES: Record<NoteKind, string[]> = {
  note: [
    'Prefers morning slots. Asked about the 6:30am Strength block.',
    'Travels for work most of the last week of the month.',
    'Wants to be told when a Reformer Pilates slot opens up.',
  ],
  call: [
    'Called about the failed card. Said they would update it by the weekend.',
    'Left a voicemail on the retention follow-up. No callback yet.',
    'Spoke about the plan downgrade — wants to think about it for a week.',
  ],
  injury: [
    'Right shoulder impingement. Avoid overhead pressing until cleared.',
    'Recovering from a knee strain. No plyometrics for 4 weeks.',
    'Lower back flare-up. Cleared for mobility and spin only.',
  ],
  goal: [
    'Target: first unassisted pull-up by the end of the quarter.',
    'Training for a 10k in November. Wants two conditioning sessions a week.',
    'Goal is consistency — three visits a week, not intensity.',
  ],
  complaint: [
    'Reported the Riverside showers running cold on weekday evenings.',
    'Unhappy the 18:30 HIIT slot is always full by Monday.',
    'Flagged that the app double-charged a drop-in in June.',
  ],
}

export function notesFor(member: Member): MemberNote[] {
  const rng = rngForMember(`${member.id}:notes`)
  const out: MemberNote[] = []

  // Injury notes are pinned and always come first when present.
  if (rng.bool(0.28)) {
    out.push({
      id: `${member.id}-n-injury`,
      kind: 'injury',
      body: rng.pick(NOTE_TEMPLATES.injury),
      authorId: rng.pick(activeTrainers).id,
      timestamp: isoStamp(addDays(NOW, -rng.int(5, 90))),
      pinned: true,
    })
  }

  if (member.metrics.failedPayments > 0) {
    out.push({
      id: `${member.id}-n-call`,
      kind: 'call',
      body: rng.pick(NOTE_TEMPLATES.call),
      authorId: 'staff-manager',
      timestamp: isoStamp(addDays(NOW, -rng.int(2, 20))),
      pinned: false,
    })
  }

  const extra = rng.int(1, 3)
  const kinds: NoteKind[] = ['note', 'goal', 'complaint']
  for (let i = 0; i < extra; i++) {
    const kind = rng.pick(kinds)
    out.push({
      id: `${member.id}-n-${i}`,
      kind,
      body: rng.pick(NOTE_TEMPLATES[kind]),
      authorId: rng.pick(staff).id,
      timestamp: isoStamp(addDays(NOW, -rng.int(3, 240))),
      pinned: false,
    })
  }

  return out.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return a.timestamp < b.timestamp ? 1 : -1
  })
}

export const NOTE_META: Record<NoteKind, { label: string; tone: 'danger' | 'warn' | 'info' | 'neutral' | 'good' }> = {
  injury: { label: 'Injury', tone: 'danger' },
  complaint: { label: 'Complaint', tone: 'warn' },
  call: { label: 'Call', tone: 'info' },
  goal: { label: 'Goal', tone: 'good' },
  note: { label: 'Note', tone: 'neutral' },
}

/* -------------------------------------------------------------------------- */
/* Programs — the member's booked classes and assigned trainer work            */
/* -------------------------------------------------------------------------- */

export interface ProgramEntry {
  gymClass: GymClass
  /** 'booked' if on the roster, otherwise their waitlist position (1-based). */
  waitlistPosition: number | null
}

export function programsFor(member: Member): ProgramEntry[] {
  const out: ProgramEntry[] = []
  for (const c of classes) {
    if (c.roster.includes(member.id)) {
      out.push({ gymClass: c, waitlistPosition: null })
    } else {
      const idx = c.waitlist.indexOf(member.id)
      if (idx >= 0) out.push({ gymClass: c, waitlistPosition: idx + 1 })
    }
  }
  return out.sort((a, b) => {
    if (a.gymClass.dayOfWeek !== b.gymClass.dayOfWeek)
      return a.gymClass.dayOfWeek - b.gymClass.dayOfWeek
    return a.gymClass.startTime.localeCompare(b.gymClass.startTime)
  })
}

/* -------------------------------------------------------------------------- */
/* Timeline — one merged, reverse-chronological feed                           */
/* -------------------------------------------------------------------------- */

export type TimelineKind =
  | 'joined'
  | 'check-in'
  | 'payment'
  | 'payment-failed'
  | 'refund'
  | 'freeze'
  | 'unfreeze'
  | 'plan-change'
  | 'note'
  | 'injury'
  | 'call'
  | 'risk-change'
  | 'trainer-assigned'
  | 'cancelled'

export interface TimelineEvent {
  id: string
  kind: TimelineKind
  timestamp: string
  title: string
  detail?: string
  /** Money involved, for payment rows. */
  amount?: number
  actorId?: string
}

export function timelineFor(member: Member): TimelineEvent[] {
  const rng = rngForMember(`${member.id}:timeline`)
  const out: TimelineEvent[] = []
  const plan = getPlan(member.planId)

  // Membership start.
  out.push({
    id: `${member.id}-t-joined`,
    kind: 'joined',
    timestamp: `${member.joinedDate}T10:00:00.000Z`,
    title: 'Joined FlexFit Studio',
    detail: `${plan?.name ?? 'Membership'} at ${member.homeLocation.replace('-', ' ')}`,
  })

  if (member.assignedTrainerId) {
    out.push({
      id: `${member.id}-t-trainer`,
      kind: 'trainer-assigned',
      timestamp: isoStamp(addDays(NOW, -rng.int(30, 300))),
      title: `Assigned to ${getStaff(member.assignedTrainerId)?.name ?? 'a trainer'}`,
      detail: 'Personal training block',
      actorId: 'staff-manager',
    })
  }

  // Freezes.
  for (let i = 0; i < member.metrics.freezeCount; i++) {
    const start = rng.int(40, 320)
    out.push({
      id: `${member.id}-t-freeze-${i}`,
      kind: 'freeze',
      timestamp: isoStamp(addDays(NOW, -start)),
      title: 'Membership frozen',
      detail: 'Billing paused, access suspended',
      actorId: 'staff-manager',
    })
    if (member.status !== 'frozen' || i < member.metrics.freezeCount - 1) {
      out.push({
        id: `${member.id}-t-unfreeze-${i}`,
        kind: 'unfreeze',
        timestamp: isoStamp(addDays(NOW, -Math.max(1, start - rng.int(14, 40)))),
        title: 'Membership resumed',
        detail: 'Billing restarted on the next cycle',
        actorId: 'staff-manager',
      })
    }
  }

  // Payments — real rows from the Batch 2 ledger.
  for (const p of paymentsForMember(member.id)) {
    out.push(paymentEvent(member.id, p))
  }

  // Notes appear in the feed as well as in their own tab.
  for (const note of notesFor(member)) {
    out.push({
      id: `${member.id}-t-${note.id}`,
      kind: note.kind === 'injury' ? 'injury' : note.kind === 'call' ? 'call' : 'note',
      timestamp: note.timestamp,
      title:
        note.kind === 'injury'
          ? 'Injury logged'
          : note.kind === 'call'
            ? 'Outbound call'
            : 'Note added',
      detail: note.body,
      actorId: note.authorId,
    })
  }

  // A risk-band crossing, when the member is actually at risk — this is what
  // the retention screen in Batch 5 acts on.
  if (member.risk.band === 'high' && member.risk.factors.length > 0) {
    out.push({
      id: `${member.id}-t-risk`,
      kind: 'risk-change',
      timestamp: isoStamp(addDays(NOW, -rng.int(3, 25))),
      title: `Entered high risk (${member.risk.score})`,
      detail: member.risk.factors[0].detail,
    })
  }

  // Recent check-ins — capped so the feed stays readable.
  const visits = (checkInsByMember.get(member.id) ?? []).slice(0, 12)
  for (const ci of visits) out.push(checkInEvent(ci))

  // End of membership.
  if (member.endDate) {
    out.push({
      id: `${member.id}-t-end`,
      kind: 'cancelled',
      timestamp: `${member.endDate}T12:00:00.000Z`,
      title: member.status === 'cancelled' ? 'Membership cancelled' : 'Membership expired',
      detail:
        member.status === 'cancelled'
          ? 'Member-initiated cancellation'
          : 'Lapsed without renewal',
    })
  }

  return out
    .filter((e) => new Date(e.timestamp).getTime() <= NOW.getTime())
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
}

function paymentEvent(memberId: string, p: Payment): TimelineEvent {
  if (p.reversalOf) {
    return {
      id: `${memberId}-t-pay-${p.id}`,
      kind: 'refund',
      timestamp: p.date,
      title: 'Refund issued',
      detail: `${p.invoiceId} · ${p.method.toUpperCase()}`,
      amount: p.amount,
    }
  }
  if (p.status === 'failed') {
    return {
      id: `${memberId}-t-pay-${p.id}`,
      kind: 'payment-failed',
      timestamp: p.date,
      title: 'Payment failed',
      detail: `${p.invoiceId} · ${p.method.toUpperCase()} declined`,
      amount: p.amount,
    }
  }
  return {
    id: `${memberId}-t-pay-${p.id}`,
    kind: 'payment',
    timestamp: p.date,
    title: p.status === 'pending' ? 'Payment pending' : 'Payment received',
    detail: `${p.invoiceId} · ${p.method.toUpperCase()}`,
    amount: p.amount,
  }
}

function checkInEvent(ci: CheckIn): TimelineEvent {
  return {
    id: `t-ci-${ci.id}`,
    kind: 'check-in',
    timestamp: ci.timestamp,
    title: 'Checked in',
    detail: ci.location.replace('-', ' '),
  }
}

/* -------------------------------------------------------------------------- */
/* Attendance shaping for the 52-week heatmap                                  */
/* -------------------------------------------------------------------------- */

export interface HeatmapDay {
  date: string
  count: number
  /** Weeks back from the current week: 0 = this week. */
  weekIndex: number
  weekday: number
}

/**
 * 52 weeks × 7 days of the member's own check-ins, oldest week first, so the
 * grid reads left-to-right like a calendar.
 */
export function attendanceHeatmap(memberId: string, weeks = 52): HeatmapDay[] {
  const byDate = new Map<string, number>()
  for (const ci of checkInsByMember.get(memberId) ?? []) {
    byDate.set(ci.date, (byDate.get(ci.date) ?? 0) + 1)
  }

  const out: HeatmapDay[] = []
  const today = startOfDay(NOW)
  // Align the last column to the current week so the final cell is today.
  const endOfGrid = addDays(today, 6 - today.getUTCDay())
  const totalDays = weeks * 7

  for (let i = totalDays - 1; i >= 0; i--) {
    const d = addDays(endOfGrid, -i)
    const iso = d.toISOString().slice(0, 10)
    const dayIndex = totalDays - 1 - i
    out.push({
      date: iso,
      count: d.getTime() > today.getTime() ? -1 : (byDate.get(iso) ?? 0),
      weekIndex: Math.floor(dayIndex / 7),
      weekday: d.getUTCDay(),
    })
  }

  return out
}

/** Longest run of consecutive weeks with at least one visit. */
export function streakWeeks(weekly: number[]): number {
  let best = 0
  let run = 0
  for (const w of weekly) {
    if (w > 0) {
      run++
      best = Math.max(best, run)
    } else {
      run = 0
    }
  }
  return best
}
