// Kiosk decision engine.
// Pure functions: given a member (or a guest), decide whether the door opens.
//
// The kiosk has exactly three outcomes and they are ranked, never merged:
//   GREEN — open the door, no human needed.
//   AMBER — open the door, but a human should say something (soft block).
//   RED   — do NOT open the door until something is resolved (hard block).
//
// Every non-green outcome carries a `script`: the literal sentence the front-desk
// staffer should say. A kiosk that says "membership problem" and leaves a
// 19-year-old to improvise is how members get humiliated at 6am.

import type { ID, Member, MembershipStatus, Plan } from '@/lib/types'
import { members, memberById } from '@/lib/data/members'
import { getPlan } from '@/lib/data/plans'
import { getCompany } from '@/lib/data/companies'
import { getStaff } from '@/lib/data/staff'
import { classes } from '@/lib/data/classes'
import { NOW, WEEKDAY_LABELS } from '@/lib/seed'
import { money } from '@/lib/format'

export type Outcome = 'green' | 'amber' | 'red'

/** Machine-readable cause. Drives which resolve action the kiosk offers. */
export type ReasonCode =
  | 'ok'
  | 'ok-unlimited'
  | 'waiver-missing'
  | 'credits-low'
  | 'credits-exhausted'
  | 'payment-failed'
  | 'membership-frozen'
  | 'membership-expired'
  | 'membership-cancelled'
  | 'off-peak-violation'
  | 'pool-exhausted'
  | 'guest'
  | 'drop-in'

/** What the kiosk can DO about a non-green outcome, in place, without a manager. */
export type ResolveKind =
  | 'sign-waiver'
  | 'take-payment'
  | 'sell-drop-in'
  | 'unfreeze'
  | 'renew'
  | 'override'
  | 'none'

export interface Decision {
  outcome: Outcome
  code: ReasonCode
  /** Shown large on the kiosk. Member-facing, never accusatory. */
  headline: string
  /** One line of member-facing detail. */
  detail: string
  /** Verbatim sentence for the staffer. Empty for GREEN. */
  script: string
  /** Offered in-place resolution. */
  resolve: ResolveKind
  /** Label for the resolve button. */
  resolveLabel: string
  /** Amount owed, if the resolution involves money. */
  amountDue: number | null
  /** Credits left AFTER this check-in, null when unlimited / not applicable. */
  creditsAfter: number | null
  /** Whether the door actually opens on this outcome. */
  admitted: boolean
}

/* -------------------------------------------------------------------------- */
/* Waiver ledger                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Which members have an unsigned waiver. Derived deterministically from the id
 * hash so it is stable across renders and server/client — the sidebar's
 * "Unsigned waivers · 9" count comes from the same rule.
 */
function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h
}

/** First-visit members with no waiver on file. */
export function needsWaiver(m: Member): boolean {
  // Trials and brand-new members are the realistic population here.
  const isNew = m.metrics.tenureMonths <= 1 || m.status === 'trial'
  return isNew && hashId(m.id) % 5 === 0
}

/** Off-peak plans are barred after 16:00 on weekdays. */
function violatesOffPeak(plan: Plan | undefined, at: Date): boolean {
  if (!plan || plan.id !== 'plan-offpeak') return false
  const hour = at.getUTCHours()
  const wd = at.getUTCDay()
  const weekdayNow = wd >= 1 && wd <= 5
  return weekdayNow && hour >= 16
}

const STATUS_BLOCK: Partial<Record<MembershipStatus, ReasonCode>> = {
  frozen: 'membership-frozen',
  expired: 'membership-expired',
  cancelled: 'membership-cancelled',
}

/* -------------------------------------------------------------------------- */
/* The decision                                                               */
/* -------------------------------------------------------------------------- */

export function decide(m: Member, at: Date = NOW): Decision {
  const plan = getPlan(m.planId)
  const planName = plan?.name ?? 'Membership'
  const first = m.firstName

  // --- RED: hard blocks, checked in severity order. ---

  const statusCode = STATUS_BLOCK[m.status]
  if (statusCode === 'membership-frozen') {
    return {
      outcome: 'red',
      code: 'membership-frozen',
      headline: 'Membership is paused',
      detail: `${first}, your ${planName} is on hold. The front desk can restart it right now.`,
      script: `"Your membership is paused — you froze it, nothing has gone wrong. I can unfreeze it now and you're straight in. Want me to?"`,
      resolve: 'unfreeze',
      resolveLabel: 'Unfreeze and admit',
      amountDue: null,
      creditsAfter: null,
      admitted: false,
    }
  }

  if (statusCode === 'membership-expired' || statusCode === 'membership-cancelled') {
    const cancelled = statusCode === 'membership-cancelled'
    return {
      outcome: 'red',
      code: statusCode,
      headline: cancelled ? 'Membership has ended' : 'Membership has expired',
      detail: `${first}, see the front desk — a day pass or a restart takes about a minute.`,
      script: cancelled
        ? `"Your membership ended on record, so the scanner won't let you through. I can either sell you a ${money(600)} day pass for today, or restart you on ${planName} — no join fee, you've been with us before."`
        : `"Your ${planName} ran out. I can renew it now or sell you a ${money(600)} day pass for today — whichever you'd rather."`,
      resolve: 'renew',
      resolveLabel: 'Restart membership',
      amountDue: plan?.price ?? null,
      creditsAfter: null,
      admitted: false,
    }
  }

  if (m.metrics.failedPayments > 0) {
    const due = plan?.price ?? 0
    return {
      outcome: 'red',
      code: 'payment-failed',
      headline: 'Payment needs attention',
      detail: `${first}, a card payment didn't go through. The front desk can take it now.`,
      script: `"Your last payment bounced — ${money(due)} on ${planName}. Card issue, usually an expiry. I can take it here on the terminal and you're in. Or I'll wave you through today and text you a link, your call."`,
      resolve: 'take-payment',
      resolveLabel: `Take ${money(due)} payment`,
      amountDue: due,
      creditsAfter: null,
      admitted: false,
    }
  }

  // Corporate pool exhausted — the employee did nothing wrong.
  if (m.companyId) {
    const co = getCompany(m.companyId)
    if (co && co.creditsUsed >= co.poolCredits) {
      return {
        outcome: 'red',
        code: 'pool-exhausted',
        headline: 'Company credits used up',
        detail: `${first}, ${co.name}'s pool is empty. This is on the account, not on you.`,
        script: `"${co.name}'s credit pool is empty for this period — that's their account, nothing to do with you. I'll let you train today and flag it to ${co.contactName} to top up."`,
        resolve: 'override',
        resolveLabel: 'Admit and flag account',
        amountDue: null,
        creditsAfter: 0,
        admitted: false,
      }
    }
  }

  const credits = m.metrics.creditsRemaining
  if (credits !== null && credits <= 0) {
    return {
      outcome: 'red',
      code: 'credits-exhausted',
      headline: 'No visits left this month',
      detail: `${first}, your ${planName} is fully used. A day pass covers today.`,
      script: `"You've used all ${m.metrics.planVisitsPerMonth} visits on ${planName} this month — that's a good problem. ${money(600)} day pass for today, or I can move you up to Unlimited and it pays for itself at your rate."`,
      resolve: 'sell-drop-in',
      resolveLabel: `Sell day pass · ${money(600)}`,
      amountDue: 600,
      creditsAfter: 0,
      admitted: false,
    }
  }

  // --- AMBER: admitted, but a human should say something. ---

  if (needsWaiver(m)) {
    return {
      outcome: 'amber',
      code: 'waiver-missing',
      headline: 'Waiver needed',
      detail: `Welcome, ${first}. One signature and you're set — it takes a moment.`,
      script: `"Welcome in. Before your first session I need your waiver signed — it's the health and liability form, takes thirty seconds on the tablet. Then you're all set."`,
      resolve: 'sign-waiver',
      resolveLabel: 'Capture waiver',
      amountDue: null,
      creditsAfter: credits,
      admitted: true,
    }
  }

  if (violatesOffPeak(plan, at)) {
    return {
      outcome: 'amber',
      code: 'off-peak-violation',
      headline: 'Outside off-peak hours',
      detail: `${first}, Off-Peak 8 covers weekdays before 4pm. You're in today.`,
      script: `"Heads up — Off-Peak 8 runs weekdays before 4pm, and it's after that now. I'm letting you in, but if evenings suit you better, Standard is ${money(3400)} and has no time limit."`,
      resolve: 'override',
      resolveLabel: 'Admit anyway',
      amountDue: null,
      creditsAfter: credits === null ? null : credits - 1,
      admitted: true,
    }
  }

  if (credits !== null && credits <= 2) {
    const after = credits - 1
    return {
      outcome: 'amber',
      code: 'credits-low',
      headline: after === 0 ? 'Last visit used' : `${after} visit${after === 1 ? '' : 's'} left`,
      detail:
        after === 0
          ? `${first}, that was your final visit this month. Have a good session.`
          : `${first}, ${after} visit${after === 1 ? '' : 's'} left on ${planName} this month.`,
      script:
        after === 0
          ? `"That's your last visit of the month used. Your allowance resets on the 1st. If you're hitting the cap most months, Unlimited works out cheaper — no pressure today."`
          : `"You're down to ${after} visit${after === 1 ? '' : 's'} this month, just so it's not a surprise next time. Enjoy your session."`,
      resolve: 'none',
      resolveLabel: '',
      amountDue: null,
      creditsAfter: after,
      admitted: true,
    }
  }

  // --- GREEN. ---

  const unlimited = m.metrics.planVisitsPerMonth === null
  return {
    outcome: 'green',
    code: unlimited ? 'ok-unlimited' : 'ok',
    headline: `Welcome back, ${first}`,
    detail: unlimited
      ? `${planName} · unlimited access`
      : `${planName} · ${(credits ?? 0) - 1} of ${m.metrics.planVisitsPerMonth} visits left after today`,
    script: '',
    resolve: 'none',
    resolveLabel: '',
    amountDue: null,
    creditsAfter: credits === null ? null : credits - 1,
    admitted: true,
  }
}

/** A walk-in guest with no membership at all. Always a paid drop-in. */
export function guestDecision(): Decision {
  return {
    outcome: 'amber',
    code: 'drop-in',
    headline: 'Guest — day pass required',
    detail: 'No membership on file. A day pass covers full floor access and one class.',
    script: `"You're not on the system, so it's a ${money(600)} day pass — full floor plus one class. I'll take that now and get your waiver signed at the same time."`,
    resolve: 'sell-drop-in',
    resolveLabel: `Sell day pass · ${money(600)}`,
    amountDue: 600,
    creditsAfter: null,
    admitted: false,
  }
}

/* -------------------------------------------------------------------------- */
/* Lookup                                                                     */
/* -------------------------------------------------------------------------- */

/** A member's kiosk PIN — last 4 of a stable derived number. Shown on the ID tab. */
export function pinFor(id: ID): string {
  return (1000 + (hashId(id) % 9000)).toString()
}

export interface Candidate {
  member: Member
  /** Lower is better. */
  rank: number
}

/**
 * Search across name, phone tail, email and PIN. Kiosk search must tolerate a
 * half-typed name and a sweaty thumb, so matching is loose but ranked:
 * exact PIN > name prefix > word prefix > substring.
 */
export function lookup(query: string, limit = 6): Member[] {
  const q = query.trim().toLowerCase()
  if (q.length < 1) return []

  const digits = q.replace(/\D/g, '')
  const out: Candidate[] = []

  for (const m of members) {
    const name = m.name.toLowerCase()
    let rank = Number.POSITIVE_INFINITY

    if (digits.length >= 4) {
      if (pinFor(m.id) === digits) rank = Math.min(rank, 0)
      if (m.phone.replace(/\D/g, '').endsWith(digits)) rank = Math.min(rank, 1)
    }
    if (name.startsWith(q)) rank = Math.min(rank, 2)
    else if (m.lastName.toLowerCase().startsWith(q)) rank = Math.min(rank, 3)
    else if (name.includes(q)) rank = Math.min(rank, 4)
    else if (m.email.toLowerCase().includes(q)) rank = Math.min(rank, 5)

    if (Number.isFinite(rank)) out.push({ member: m, rank })
  }

  out.sort((a, b) => a.rank - b.rank || a.member.name.localeCompare(b.member.name))
  return out.slice(0, limit).map((c) => c.member)
}

/** Resolve a scanned QR / typed member id or PIN to a member. */
export function resolveScan(raw: string): Member | undefined {
  const value = raw.trim()
  if (!value) return undefined
  // QR payloads look like "FF:m-0142".
  const direct = value.startsWith('FF:') ? value.slice(3) : value
  const byId = memberById.get(direct)
  if (byId) return byId
  const digits = value.replace(/\D/g, '')
  if (digits.length === 4) return members.find((m) => pinFor(m.id) === digits)
  return undefined
}

/* -------------------------------------------------------------------------- */
/* Today's context                                                            */
/* -------------------------------------------------------------------------- */

export const TODAY_WEEKDAY = NOW.getUTCDay()
export const TODAY_LABEL = WEEKDAY_LABELS[TODAY_WEEKDAY]

/** Classes scheduled today, earliest first. */
export function todaysClasses() {
  return classes
    .filter((c) => c.dayOfWeek === TODAY_WEEKDAY)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}

/** The class a member is booked into today, if any — drives "you're in Spin at 6:30". */
export function bookedClassToday(memberId: ID) {
  return todaysClasses().find((c) => c.roster.includes(memberId))
}

export function trainerName(id: ID | null): string {
  if (!id) return 'Unassigned'
  return getStaff(id)?.name ?? 'Unassigned'
}

/** Parse "18:30" against the fixed NOW date, in UTC to match the data engine. */
export function classStart(startTime: string, base: Date = NOW): Date {
  const [h, min] = startTime.split(':').map(Number)
  const d = new Date(base.getTime())
  d.setUTCHours(h, min, 0, 0)
  return d
}
