// Retention derivations. Pure, deterministic, computed from the Batch 2 dataset.
// No new entity types are invented here — everything is derived from Member +
// RiskResult so the numbers on this screen reconcile with the member directory.

import { members as allMembers } from '@/lib/data/members'
import { staff } from '@/lib/data/staff'
import { makeRng, NOW, addDays, isoDate } from '@/lib/seed'
import { bandForScore } from '@/lib/risk'
import type { Member, RiskBand, RiskFactor } from '@/lib/types'

/** Only members you can still save. Cancelled/expired belong to win-back, not retention. */
export const retentionPool: Member[] = allMembers.filter(
  (m) => m.status === 'active' || m.status === 'trial' || m.status === 'frozen',
)

/* -------------------------------------------------------------------------- */
/*  Distribution                                                              */
/* -------------------------------------------------------------------------- */

export interface RiskBucket {
  /** Lower bound of the 10-point bucket. */
  from: number
  to: number
  band: RiskBand
  count: number
  /** Combined monthly recurring value sitting in this bucket. */
  value: number
}

export function riskDistribution(pool: Member[] = retentionPool): RiskBucket[] {
  const buckets: RiskBucket[] = Array.from({ length: 10 }, (_, i) => ({
    from: i * 10,
    to: i * 10 + 9,
    band: bandForScore(i * 10 + 9),
    count: 0,
    value: 0,
  }))
  for (const m of pool) {
    const i = Math.min(9, Math.floor(m.risk.score / 10))
    buckets[i].count += 1
    buckets[i].value += m.metrics.monthlyValue
  }
  return buckets
}

export interface BandSummary {
  band: RiskBand
  count: number
  share: number
  monthlyValue: number
}

export function bandSummary(pool: Member[] = retentionPool): BandSummary[] {
  const bands: RiskBand[] = ['high', 'medium', 'low']
  return bands.map((band) => {
    const rows = pool.filter((m) => m.risk.band === band)
    return {
      band,
      count: rows.length,
      share: pool.length > 0 ? (rows.length / pool.length) * 100 : 0,
      monthlyValue: rows.reduce((s, m) => s + m.metrics.monthlyValue, 0),
    }
  })
}

/* -------------------------------------------------------------------------- */
/*  Movement — who crossed the high-risk line this week                       */
/* -------------------------------------------------------------------------- */

/**
 * Reconstructs last week's score for the members near a boundary. The dataset is
 * a single snapshot, so prior-week scores are derived deterministically from the
 * member id: the same member always shows the same movement on every render.
 */
export interface RiskMovement {
  member: Member
  previousScore: number
  currentScore: number
  delta: number
  /** The factor most responsible for the move. */
  driver: RiskFactor | null
}

function priorScoreFor(member: Member, rng: () => number): number {
  // Members whose risk is dominated by inactivity drift upward over a week;
  // members with a resolved billing issue drift down.
  const inactivity = member.risk.factors.find((f) => f.key === 'inactivity')
  const billing = member.risk.factors.find((f) => f.key === 'billing')
  const roll = rng()
  let shift = 0
  if (inactivity && roll < 0.55) shift = -(6 + Math.round(roll * 14))
  else if (billing && roll > 0.75) shift = 5 + Math.round((roll - 0.75) * 40)
  else shift = Math.round((roll - 0.5) * 10)
  return Math.max(0, Math.min(100, member.risk.score + shift))
}

interface Movements {
  entering: RiskMovement[]
  leaving: RiskMovement[]
}

function buildMovements(): Movements {
  const rng = makeRng(50501).next
  const entering: RiskMovement[] = []
  const leaving: RiskMovement[] = []

  for (const member of retentionPool) {
    const previousScore = priorScoreFor(member, rng)
    const currentScore = member.risk.score
    if (previousScore === currentScore) continue
    const crossedUp = previousScore < 70 && currentScore >= 70
    const crossedDown = previousScore >= 70 && currentScore < 70
    if (!crossedUp && !crossedDown) continue
    const movement: RiskMovement = {
      member,
      previousScore,
      currentScore,
      delta: currentScore - previousScore,
      driver: member.risk.factors[0] ?? null,
    }
    if (crossedUp) entering.push(movement)
    else leaving.push(movement)
  }

  entering.sort((a, b) => b.delta - a.delta)
  leaving.sort((a, b) => a.delta - b.delta)
  return { entering, leaving }
}

const movements = buildMovements()
export const enteringRisk = movements.entering
export const leavingRisk = movements.leaving

/* -------------------------------------------------------------------------- */
/*  Intervention queue — risk × value                                         */
/* -------------------------------------------------------------------------- */

export type InterventionPlay = 'call' | 'sms' | 'trainer-checkin' | 'billing-fix' | 'plan-review'

export interface InterventionPlayMeta {
  id: InterventionPlay
  label: string
  /** What the staff member actually does. */
  script: string
}

export const PLAYS: Record<InterventionPlay, InterventionPlayMeta> = {
  call: {
    id: 'call',
    label: 'Phone call',
    script: 'Ask what changed. Do not pitch. Book their next visit while on the call.',
  },
  sms: {
    id: 'sms',
    label: 'SMS nudge',
    script: 'One line, their first name, one specific class time this week.',
  },
  'trainer-checkin': {
    id: 'trainer-checkin',
    label: 'Trainer check-in',
    script: 'Assigned trainer reaches out personally — highest response rate, highest staff cost.',
  },
  'billing-fix': {
    id: 'billing-fix',
    label: 'Fix billing',
    script: 'Retry the card and confirm by SMS. Never let a failed payment read as a cancellation.',
  },
  'plan-review': {
    id: 'plan-review',
    label: 'Plan review',
    script: 'They pay for more than they use. Move them down a tier before they leave entirely.',
  },
}

/** The play is chosen by the dominant risk factor, not by staff preference. */
export function playFor(member: Member): InterventionPlay {
  const top = member.risk.factors[0]?.key
  if (member.metrics.failedPayments > 0) return 'billing-fix'
  if (top === 'low-utilization') return 'plan-review'
  if (member.metrics.lifetimeValue >= 60_000) return 'call'
  if (member.assignedTrainerId) return 'trainer-checkin'
  return 'sms'
}

export interface InterventionItem {
  id: string
  member: Member
  /** risk score × monthly value, normalised 0–100. This is the queue order. */
  priority: number
  play: InterventionPlay
  /** Staff id this is assigned to, or null for unassigned. */
  assigneeId: string | null
  /** ISO date this item is snoozed until, or null. */
  snoozedUntil: string | null
  /** Days since the member was last contacted about retention. */
  lastContactDays: number | null
}

function buildQueue(): InterventionItem[] {
  const rng = makeRng(50502)
  const owners = staff.filter((s) => s.active && (s.role === 'trainer' || s.role === 'front-desk'))

  const candidates = retentionPool.filter((m) => m.risk.score >= 45)
  const maxValue = Math.max(...candidates.map((m) => m.metrics.monthlyValue), 1)

  const items = candidates.map((member) => {
    // Risk says who is leaving; value says who is worth the staff hour. Neither
    // alone produces a defensible queue.
    const valueWeight = member.metrics.monthlyValue / maxValue
    const priority = Math.round(member.risk.score * 0.62 + valueWeight * 100 * 0.38)
    const assign = rng.next()
    return {
      id: `iv-${member.id}`,
      member,
      priority,
      play: playFor(member),
      assigneeId: assign < 0.45 ? rng.pick(owners).id : null,
      snoozedUntil: null,
      lastContactDays: rng.bool(0.4) ? rng.int(2, 40) : null,
    }
  })

  items.sort((a, b) => b.priority - a.priority || b.member.risk.score - a.member.risk.score)
  return items
}

export const interventionQueue: InterventionItem[] = buildQueue()

export const assignableStaff = staff.filter(
  (s) => s.active && (s.role === 'trainer' || s.role === 'front-desk' || s.role === 'manager'),
)

export const SNOOZE_OPTIONS = [
  { days: 3, label: '3 days' },
  { days: 7, label: '1 week' },
  { days: 14, label: '2 weeks' },
] as const

export function snoozeDate(days: number): string {
  return isoDate(addDays(NOW, days))
}

/** Revenue at stake in the queue — the reason this screen exists. */
export function queueValue(items: InterventionItem[]): number {
  return items.reduce((s, i) => s + i.member.metrics.monthlyValue, 0)
}

/* -------------------------------------------------------------------------- */
/*  Effectiveness at 60 days                                                  */
/* -------------------------------------------------------------------------- */

export interface EffectivenessRow {
  play: InterventionPlay
  /** Members who received this play 60+ days ago. */
  cohort: number
  /** Still a member at day 60. */
  retained: number
  /** Matched control group that received nothing. */
  controlCohort: number
  controlRetained: number
  /** Staff minutes spent per member. */
  minutesPerMember: number
}

export interface EffectivenessResult extends EffectivenessRow {
  retainedRate: number
  controlRate: number
  /** Percentage-point lift over control. */
  lift: number
  /** ±95% confidence interval half-width on the lift, in points. */
  margin: number
  /** True when the interval straddles zero — an honest null finding. */
  inconclusive: boolean
}

/**
 * Fixed cohort counts. These are deliberately small for two plays so the report
 * is forced to admit it cannot prove a lift — the honest state the brief asks
 * for. A retention tool that always claims success teaches operators to ignore it.
 */
const EFFECTIVENESS_ROWS: EffectivenessRow[] = [
  { play: 'billing-fix', cohort: 46, retained: 39, controlCohort: 44, controlRetained: 24, minutesPerMember: 6 },
  { play: 'call', cohort: 58, retained: 41, controlCohort: 61, controlRetained: 33, minutesPerMember: 14 },
  { play: 'trainer-checkin', cohort: 31, retained: 22, controlCohort: 33, controlRetained: 19, minutesPerMember: 22 },
  { play: 'plan-review', cohort: 24, retained: 15, controlCohort: 26, controlRetained: 15, minutesPerMember: 11 },
  { play: 'sms', cohort: 88, retained: 47, controlCohort: 84, controlRetained: 44, minutesPerMember: 2 },
]

/** Standard two-proportion 95% interval. Small cohorts produce wide intervals. */
function liftMargin(a: number, an: number, b: number, bn: number): number {
  const pa = a / an
  const pb = b / bn
  const se = Math.sqrt((pa * (1 - pa)) / an + (pb * (1 - pb)) / bn)
  return 1.96 * se * 100
}

export const effectiveness: EffectivenessResult[] = EFFECTIVENESS_ROWS.map((row) => {
  const retainedRate = (row.retained / row.cohort) * 100
  const controlRate = (row.controlRetained / row.controlCohort) * 100
  const lift = retainedRate - controlRate
  const margin = liftMargin(row.retained, row.cohort, row.controlRetained, row.controlCohort)
  return {
    ...row,
    retainedRate,
    controlRate,
    lift,
    margin,
    inconclusive: Math.abs(lift) < margin,
  }
}).sort((a, b) => b.lift - a.lift)

export const EFFECTIVENESS_WINDOW_DAYS = 60
