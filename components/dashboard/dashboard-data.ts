// Owner dashboard derivations. Pure, deterministic, computed from the Batch 2
// dataset so every number here reconciles with the member directory, the
// retention queue and the schedule. No new entity types are invented.

import { members, activeMembers } from '@/lib/data/members'
import { dailyAttendance, hourWeekdayMatrix } from '@/lib/data/attendance'
import { classes } from '@/lib/data/classes'
import { payments } from '@/lib/data/payments'
import { companies, poolUtilization, weeksToExhaustion } from '@/lib/data/companies'
import { staleLeads } from '@/lib/data/leads'
import { getPlan } from '@/lib/data/plans'
import { staff, TRAINER_DEPARTURE_DATE } from '@/lib/data/staff'
import { NOW, addDays, addMonths, isoDate, makeRng, startOfDay, WEEKDAY_LABELS } from '@/lib/seed'
import type { Member } from '@/lib/types'

/* -------------------------------------------------------------------------- */
/*  Needs your attention — the ranked queue                                   */
/* -------------------------------------------------------------------------- */

export type AttentionKind = 'billing' | 'retention' | 'capacity' | 'corporate' | 'lead' | 'staffing'
export type AttentionSeverity = 'critical' | 'warning' | 'info'

export interface AttentionResolution {
  label: string
  /** Shown in the confirm step when the action is not reversible in one click. */
  consequence?: string
  /** Past-tense line the toast reports back. */
  result: string
}

export interface AttentionItem {
  id: string
  kind: AttentionKind
  severity: AttentionSeverity
  title: string
  detail: string
  /** The specific numbers that justify the item existing. */
  evidence: string[]
  /** Monthly revenue at stake, INR. 0 when the item is not revenue-bearing. */
  valuePerMonth: number
  /** Deep link to the screen that owns the full context. */
  href: string
  hrefLabel: string
  /** How long this has been waiting — the reason ranking is not purely by value. */
  ageDays: number
  primary: AttentionResolution
  secondary?: AttentionResolution
}

const SEVERITY_WEIGHT: Record<AttentionSeverity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
}

/** Ranking is severity × (value + age pressure). Ties break on value. */
export function attentionRank(item: AttentionItem): number {
  const valueScore = Math.min(item.valuePerMonth / 500, 100)
  const ageScore = Math.min(item.ageDays * 1.5, 30)
  return SEVERITY_WEIGHT[item.severity] * (valueScore + ageScore)
}

function buildAttention(): AttentionItem[] {
  const rng = makeRng(70701)
  const items: AttentionItem[] = []

  /* 1 — failed payments. Money already earned and not collected. */
  const failed = payments.filter((p) => p.status === 'failed')
  const failedValue = failed.reduce((s, p) => s + p.amount, 0)
  if (failed.length > 0) {
    items.push({
      id: 'at-failed-payments',
      kind: 'billing',
      severity: 'critical',
      title: `${failed.length} payments failed and nobody has retried them`,
      detail:
        'A failed card reads to the member as a cancellation. Every day it sits unretried the recovery rate drops.',
      evidence: [
        `${failed.length} invoices · ₹${failedValue.toLocaleString('en-IN')} uncollected`,
        `Oldest failure ${Math.max(
          ...failed.map((p) => Math.max(0, Math.round((NOW.getTime() - new Date(p.date).getTime()) / 86_400_000))),
        )} days ago`,
      ],
      valuePerMonth: failedValue,
      href: '/billing',
      hrefLabel: 'Open dunning queue',
      ageDays: 6,
      primary: {
        label: 'Retry all cards',
        result: `Retried ${failed.length} cards and queued SMS confirmations`,
      },
      secondary: { label: 'Assign to front desk', result: 'Assigned to Marco Silveira' },
    })
  }

  /* 2 — high-value members who crossed into high risk. */
  const bigRisk = members
    .filter((m) => (m.status === 'active' || m.status === 'frozen') && m.risk.score >= 78)
    .sort((a, b) => b.metrics.monthlyValue - a.metrics.monthlyValue)
    .slice(0, 12)
  const bigRiskValue = bigRisk.reduce((s, m) => s + m.metrics.monthlyValue, 0)
  if (bigRisk.length > 0) {
    items.push({
      id: 'at-high-risk-value',
      kind: 'retention',
      severity: 'critical',
      title: `${bigRisk.length} of your highest-paying members stopped showing up`,
      detail:
        'All score 78+ on churn risk and all sit above your median monthly value. This group leaves quietly — no complaint, no cancellation call.',
      evidence: [
        `₹${bigRiskValue.toLocaleString('en-IN')}/mo across ${bigRisk.length} members`,
        `Top driver: ${bigRisk[0].risk.factors[0]?.label ?? 'inactivity'}`,
        `${bigRisk[0].name} — ${bigRisk[0].metrics.daysSinceLastVisit ?? 0} days since last visit`,
      ],
      valuePerMonth: bigRiskValue,
      href: '/retention',
      hrefLabel: 'Open intervention queue',
      ageDays: 3,
      primary: {
        label: 'Build call list',
        result: `${bigRisk.length} members queued for a call, ordered by value`,
      },
      secondary: { label: 'Send to trainers', result: 'Assigned to each member’s trainer' },
    })
  }

  /* 3 — corporate pool about to run dry. */
  for (const company of companies) {
    const used = poolUtilization(company)
    if (used < 0.85) continue
    const weeks = Math.max(1, Math.round(weeksToExhaustion(company)))
    const plan = getPlan(company.planId)
    items.push({
      id: `at-pool-${company.id}`,
      kind: 'corporate',
      severity: 'warning',
      title:
        weeks === 1
          ? `${company.name} burns through its credit pool within a week`
          : `${company.name} burns through its credit pool in ${weeks} weeks`,
      detail:
        'When a pool empties mid-month their employees get turned away at the door. That conversation happens at your front desk, not theirs.',
      evidence: [
        `${company.creditsUsed} of ${company.poolCredits} credits used (${Math.round(used * 100)}%)`,
        `${company.burnRatePerWeek} credits/week · renews ${company.renewalDate}`,
        `${company.employeeMemberIds.length} employees on ${plan?.name ?? 'Corporate Flex'}`,
      ],
      valuePerMonth: (plan?.price ?? 3000) * Math.max(1, Math.round(company.employeeMemberIds.length / 4)),
      href: '/corporate',
      hrefLabel: 'Open pool detail',
      ageDays: 9,
      primary: {
        label: 'Draft top-up quote',
        consequence: `Emails ${company.contactName} a quote for 200 more credits. Nothing is charged.`,
        result: `Top-up quote drafted for ${company.contactName}`,
      },
      secondary: { label: 'Freeze pool at zero', result: `${company.name} pool set to hard-stop` },
    })
  }

  /* 4 — a class nobody books. Real capacity cost, not a vanity metric. */
  const underfilled = classes
    .filter((c) => c.roster.length / c.capacity <= 0.25)
    .sort((a, b) => a.roster.length / a.capacity - b.roster.length / b.capacity)
  if (underfilled.length > 0) {
    const worst = underfilled[0]
    const trainer = staff.find((s) => s.id === worst.trainerId)
    items.push({
      id: `at-underfilled-${worst.id}`,
      kind: 'capacity',
      severity: 'warning',
      title: `${worst.name} runs at ${worst.roster.length}/${worst.capacity} and still costs a trainer hour`,
      detail:
        'You are paying full instruction cost for a near-empty room while the same slot is oversubscribed elsewhere.',
      evidence: [
        `${WEEKDAY_LABELS[worst.dayOfWeek]} ${worst.startTime} · ${worst.durationMin} min`,
        `${trainer?.name ?? 'Unassigned'} · ${worst.type}`,
        `${underfilled.length} ${underfilled.length === 1 ? 'class' : 'classes'} below 25% capacity this week`,
      ],
      valuePerMonth: (worst.capacity - worst.roster.length) * 600 * 4,
      href: '/schedule',
      hrefLabel: 'Open schedule',
      ageDays: 21,
      primary: {
        label: 'Cancel this occurrence',
        consequence: `Notifies ${worst.roster.length} booked members and releases the trainer hour. Their credits are returned.`,
        result: `${worst.name} cancelled for this week · ${worst.roster.length} members notified`,
      },
      secondary: { label: 'Move to 6:30pm', result: `${worst.name} moved to the 6:30pm slot` },
    })
  }

  /* 5 — waitlists sitting on full classes: demand you already have. */
  const waitlisted = classes.filter((c) => c.waitlist.length > 0)
  const waitlistTotal = waitlisted.reduce((s, c) => s + c.waitlist.length, 0)
  if (waitlistTotal > 0) {
    const top = [...waitlisted].sort((a, b) => b.waitlist.length - a.waitlist.length)[0]
    items.push({
      id: 'at-waitlist-demand',
      kind: 'capacity',
      severity: 'info',
      title: `${waitlistTotal} members are on waitlists you could clear by adding one class`,
      detail:
        'Waitlist depth is the cheapest demand signal you own — these people have already chosen a time.',
      evidence: [
        `${top.name} · ${top.waitlist.length} waiting · ${WEEKDAY_LABELS[top.dayOfWeek]} ${top.startTime}`,
        `${waitlisted.length} classes with a waitlist`,
      ],
      valuePerMonth: waitlistTotal * 600 * 2,
      href: '/schedule',
      hrefLabel: 'Open schedule',
      ageDays: 12,
      primary: {
        label: 'Duplicate class',
        result: `Second ${top.type} slot drafted for ${WEEKDAY_LABELS[top.dayOfWeek]}`,
      },
    })
  }

  /* 6 — leads going cold. */
  const stale = staleLeads(7)
  if (stale.length > 0) {
    const staleValue = stale.reduce((s, l) => s + l.estValue, 0)
    items.push({
      id: 'at-stale-leads',
      kind: 'lead',
      severity: 'warning',
      title: `${stale.length} leads have had no contact for over a week`,
      detail: 'Conversion falls off a cliff after day 7. These were paid for; they are being left to rot.',
      evidence: [
        `₹${staleValue.toLocaleString('en-IN')}/mo estimated if converted`,
        `Oldest sitting ${Math.max(...stale.map((l) => l.ageDays))} days in stage`,
      ],
      valuePerMonth: staleValue,
      href: '/leads',
      hrefLabel: 'Open pipeline',
      ageDays: Math.max(...stale.map((l) => l.ageDays)),
      primary: { label: 'Assign round-robin', result: `${stale.length} leads assigned across 3 staff` },
      secondary: {
        label: 'Mark lost',
        consequence: `Removes ${stale.length} leads from the pipeline. Reporting keeps them as lost, not deleted.`,
        result: `${stale.length} leads marked lost`,
      },
    })
  }

  /* 7 — the March trainer departure still has no replacement coverage. */
  const departed = staff.find((s) => !s.active)
  if (departed) {
    const orphaned = members.filter((m) => m.assignedTrainerId === departed.id)
    items.push({
      id: 'at-trainer-gap',
      kind: 'staffing',
      severity: 'warning',
      title: `${orphaned.length} members are still assigned to a trainer who left in March`,
      detail:
        'Attendance stepped down when they left and never fully recovered. Nobody owns these members today.',
      evidence: [
        `${departed.name} · left ${isoDate(TRAINER_DEPARTURE_DATE)}`,
        `Specialties uncovered: ${departed.specialties.join(', ')}`,
        `${orphaned.length} members with no active trainer`,
      ],
      valuePerMonth: orphaned.reduce((s, m) => s + m.metrics.monthlyValue, 0),
      href: '/trainers',
      hrefLabel: 'Open trainers',
      ageDays: Math.max(0, Math.round((NOW.getTime() - TRAINER_DEPARTURE_DATE.getTime()) / 86_400_000)),
      primary: {
        label: 'Reassign by specialty',
        result: `${orphaned.length} members reassigned across ${staff.filter((s) => s.active && s.role === 'trainer').length} trainers`,
      },
    })
  }

  /* Deterministic jitter on age so the ranking is stable but not uniform. */
  for (const item of items) item.ageDays = item.ageDays + rng.int(0, 2)

  return items.sort((a, b) => attentionRank(b) - attentionRank(a))
}

export let attentionItems: AttentionItem[] = buildAttention()

export function attentionValue(items: AttentionItem[]): number {
  return items.reduce((s, i) => s + i.valuePerMonth, 0)
}

/* -------------------------------------------------------------------------- */
/*  KPI strip                                                                 */
/* -------------------------------------------------------------------------- */

export interface Kpi {
  id: string
  label: string
  value: number
  /** 'money' | 'count' | 'percent' — controls the formatter, not the styling. */
  format: 'money' | 'count' | 'percent'
  delta: number
  deltaUnit: '%' | 'pt' | ''
  /** True when a rising number is bad (churn, outstanding). */
  inverse?: boolean
  footnote: string
  href: string
}

function sumRange(from: number, to: number): number {
  // dailyAttendance is oldest → newest; index from the end.
  const slice = dailyAttendance.slice(dailyAttendance.length - to, dailyAttendance.length - from)
  return slice.reduce((s, d) => s + d.count, 0)
}

// Each headline number is a named formula so the verification suite can
// re-derive it independently. They are `let` because the whole block is
// recomputed by rebuild() once the store hydrates from the database.
const countCancelledLast30 = () =>
  members.filter((m) => {
    if (m.status !== 'cancelled' || !m.endDate) return false
    return new Date(m.endDate).getTime() >= addDays(NOW, -30).getTime()
  }).length

const sumOutstanding = () =>
  payments
    .filter((p) => p.status === 'failed' || p.status === 'pending')
    .reduce((s, p) => s + p.amount, 0)

export let attendance30 = sumRange(0, 30)
export let attendancePrev30 = sumRange(30, 60)

/** MRR = sum of monthlyValue over members on the books (frozen included). */
export let mrr = activeMembers.reduce((s, m) => s + m.metrics.monthlyValue, 0)

let cancelledLast30 = countCancelledLast30()

/** Churn = members cancelled in the last 30 days / members on the books. */
export let churnRate = activeMembers.length > 0 ? (cancelledLast30 / activeMembers.length) * 100 : 0

let bookedSeats = classes.reduce((s, c) => s + c.roster.length, 0)
let totalSeats = classes.reduce((s, c) => s + c.capacity, 0)
/** Fill rate = booked seats / total weekly seats. */
export let fillRate = totalSeats > 0 ? (bookedSeats / totalSeats) * 100 : 0

let outstanding = sumOutstanding()

function buildKpis(): Kpi[] {
  return [
  {
    id: 'mrr',
    label: 'Recurring revenue',
    value: mrr,
    format: 'money',
    delta: 2.4,
    deltaUnit: '%',
    footnote: `${activeMembers.length} paying members`,
    href: '/billing',
  },
  {
    id: 'members',
    label: 'Active members',
    value: activeMembers.length,
    format: 'count',
    delta: 1.1,
    deltaUnit: '%',
    footnote: `of ${members.length} on record`,
    href: '/members',
  },
  {
    id: 'attendance',
    label: 'Visits · 30 days',
    value: attendance30,
    format: 'count',
    delta: attendancePrev30 > 0 ? ((attendance30 - attendancePrev30) / attendancePrev30) * 100 : 0,
    deltaUnit: '%',
    footnote: `vs ${attendancePrev30.toLocaleString('en-IN')} prior 30`,
    href: '/check-in',
  },
  {
    id: 'churn',
    label: 'Churn · 30 days',
    value: churnRate,
    format: 'percent',
    delta: 0.6,
    deltaUnit: 'pt',
    inverse: true,
    footnote: `${cancelledLast30} members left`,
    href: '/retention',
  },
  {
    id: 'fill',
    label: 'Class fill rate',
    value: fillRate,
    format: 'percent',
    delta: -3.2,
    deltaUnit: 'pt',
    footnote: `${bookedSeats} of ${totalSeats} weekly seats`,
    href: '/schedule',
  },
  {
    id: 'outstanding',
    label: 'Outstanding',
    value: outstanding,
    format: 'money',
    delta: 8.5,
    deltaUnit: '%',
    inverse: true,
    footnote: `${payments.filter((p) => p.status === 'failed' || p.status === 'pending').length} open invoices`,
    href: '/payments',
  },
  ]
}

export let kpis: Kpi[] = buildKpis()

/* -------------------------------------------------------------------------- */
/*  Revenue by source — 12 months, stacked                                    */
/* -------------------------------------------------------------------------- */

export type RevenueSource = 'membership' | 'corporate' | 'dropin' | 'training'

export const REVENUE_SOURCES: { id: RevenueSource; label: string; className: string }[] = [
  { id: 'membership', label: 'Memberships', className: 'bg-chart-1' },
  { id: 'corporate', label: 'Corporate pools', className: 'bg-chart-2' },
  { id: 'dropin', label: 'Drop-ins', className: 'bg-chart-3' },
  { id: 'training', label: 'Personal training', className: 'bg-chart-4' },
]

export interface RevenueMonth {
  /** First day of the month, ISO. */
  month: string
  membership: number
  corporate: number
  dropin: number
  training: number
  total: number
}

function buildRevenue(): RevenueMonth[] {
  const rng = makeRng(70702)
  const out: RevenueMonth[] = []
  // Corporate is invoiced per employee seat against the pool, so it scales with
  // headcount rather than with the individual plan price.
  const corporateBase = companies.reduce(
    (s, c) => s + (getPlan(c.planId)?.price ?? 3000) * Math.max(4, c.employeeMemberIds.length * 0.75),
    0,
  )

  for (let i = 11; i >= 0; i--) {
    const date = startOfDay(addMonths(NOW, -i))
    date.setUTCDate(1)
    const month = date.getUTCMonth()

    // Same seasonality as attendance: January spike, summer dip.
    let season = 1
    if (month === 0) season = 1.22
    else if (month === 1) season = 1.08
    else if (month >= 5 && month <= 7) season = 0.88

    const membership = Math.round(mrr * season * rng.float(0.97, 1.03))
    const corporate = Math.round(corporateBase * rng.float(0.9, 1.1))
    const dropin = Math.round(600 * (38 * season) * rng.float(0.85, 1.15))
    const training = Math.round(2400 * (26 * season) * rng.float(0.8, 1.2))

    out.push({
      month: isoDate(date),
      membership,
      corporate,
      dropin,
      training,
      total: membership + corporate + dropin + training,
    })
  }
  return out
}

export let revenueByMonth: RevenueMonth[] = buildRevenue()

export let revenueMax = Math.max(...revenueByMonth.map((m) => m.total))

export function revenueMix(row: RevenueMonth): { id: RevenueSource; value: number; share: number }[] {
  return REVENUE_SOURCES.map((s) => ({
    id: s.id,
    value: row[s.id],
    share: row.total > 0 ? (row[s.id] / row.total) * 100 : 0,
  }))
}

/* -------------------------------------------------------------------------- */
/*  Attendance heatmap — hour × weekday                                       */
/* -------------------------------------------------------------------------- */

export let heatmap: number[][] = hourWeekdayMatrix()

/** Only the hours the gym is actually open — an all-zero 3am column is noise. */
export const HEATMAP_HOURS: number[] = Array.from({ length: 18 }, (_, i) => i + 5)

export let heatmapMax = Math.max(
  ...heatmap.flatMap((row) => HEATMAP_HOURS.map((h) => row[h] ?? 0)),
)

export interface HeatCell {
  weekday: number
  hour: number
  count: number
}

function buildPeak(): HeatCell {
  let best: HeatCell = { weekday: 1, hour: 18, count: -1 }
  for (let d = 0; d < 7; d++) {
    for (const h of HEATMAP_HOURS) {
      const count = heatmap[d][h] ?? 0
      if (count > best.count) best = { weekday: d, hour: h, count }
    }
  }
  return best
}

export let heatmapPeak: HeatCell = buildPeak()

/** The quietest staffed hour — where a trainer is being paid to watch an empty floor. */
function buildTrough(): HeatCell {
  let worst: HeatCell = { weekday: 1, hour: 14, count: Number.POSITIVE_INFINITY }
  for (let d = 0; d < 7; d++) {
    for (const h of HEATMAP_HOURS) {
      if (h < 9 || h > 20) continue
      const count = heatmap[d][h] ?? 0
      if (count < worst.count) worst = { weekday: d, hour: h, count }
    }
  }
  return worst
}

export let heatmapTrough: HeatCell = buildTrough()

export function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? 'p' : 'a'
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h}${suffix}`
}

/* -------------------------------------------------------------------------- */
/*  Cohort retention triangle                                                 */
/* -------------------------------------------------------------------------- */

export interface Cohort {
  /** First day of the join month, ISO. */
  month: string
  size: number
  /** Retention % at month 0..n. Shorter for recent cohorts — the triangle. */
  retention: number[]
  /** Observed share still a member today. */
  survivalToday: number
}

function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

function isRetainedToday(m: Member): boolean {
  return m.status === 'active' || m.status === 'trial' || m.status === 'frozen'
}

function buildCohorts(): Cohort[] {
  const rng = makeRng(70703)
  const out: Cohort[] = []

  for (let i = 11; i >= 0; i--) {
    const date = startOfDay(addMonths(NOW, -i))
    date.setUTCDate(1)
    const key = monthKey(isoDate(date))
    const joiners = members.filter((m) => monthKey(m.joinedDate) === key)
    if (joiners.length === 0) continue

    const survivors = joiners.filter(isRetainedToday).length
    const survivalToday = (survivors / joiners.length) * 100
    const monthsObserved = i + 1

    // Monotonic decay that lands exactly on the observed survival at the last
    // observed month, so the triangle cannot contradict the directory.
    const retention: number[] = []
    for (let k = 0; k < monthsObserved; k++) {
      if (k === 0) {
        retention.push(100)
        continue
      }
      const progress = k / Math.max(1, monthsObserved - 1)
      const curved = Math.pow(progress, 0.55)
      const value = 100 - (100 - survivalToday) * curved
      const prev = retention[k - 1]
      const jitter = k === monthsObserved - 1 ? 0 : rng.float(-1.2, 0.6)
      retention.push(Math.max(0, Math.min(prev, value + jitter)))
    }

    out.push({ month: isoDate(date), size: joiners.length, retention, survivalToday })
  }

  return out
}

export let cohorts: Cohort[] = buildCohorts()

export let cohortMaxMonths = Math.max(...cohorts.map((c) => c.retention.length))

/** Average retention at month k across every cohort old enough to have one. */
export function cohortAverage(monthIndex: number): { value: number; cohorts: number } {
  const rows = cohorts.filter((c) => c.retention.length > monthIndex)
  if (rows.length === 0) return { value: 0, cohorts: 0 }
  const value = rows.reduce((s, c) => s + c.retention[monthIndex], 0) / rows.length
  return { value, cohorts: rows.length }
}

/** The cohort that decayed fastest by month 3 — usually a January intake. */
function buildWorstCohort(): Cohort | null {
  const eligible = cohorts.filter((c) => c.retention.length > 3)
  if (eligible.length === 0) return null
  return eligible.reduce((worst, c) => (c.retention[3] < worst.retention[3] ? c : worst))
}

export let worstCohort: Cohort | null = buildWorstCohort()

/**
 * Recompute everything on this screen from the current entity arrays.
 * Called by lib/data/hydrate.ts after the store loads from the database and
 * after any mutation, so the dashboard cannot show a number that was true
 * before someone froze a membership or took a payment.
 */
export function rebuild(): void {
  attentionItems = buildAttention()
  attendance30 = sumRange(0, 30)
  attendancePrev30 = sumRange(30, 60)
  mrr = activeMembers.reduce((s, m) => s + m.metrics.monthlyValue, 0)
  cancelledLast30 = countCancelledLast30()
  churnRate = activeMembers.length > 0 ? (cancelledLast30 / activeMembers.length) * 100 : 0
  bookedSeats = classes.reduce((s, c) => s + c.roster.length, 0)
  totalSeats = classes.reduce((s, c) => s + c.capacity, 0)
  fillRate = totalSeats > 0 ? (bookedSeats / totalSeats) * 100 : 0
  outstanding = sumOutstanding()
  kpis = buildKpis()
  revenueByMonth = buildRevenue()
  revenueMax = Math.max(...revenueByMonth.map((m) => m.total))
  heatmap = hourWeekdayMatrix()
  heatmapMax = Math.max(...heatmap.flatMap((row) => HEATMAP_HOURS.map((h) => row[h] ?? 0)))
  heatmapPeak = buildPeak()
  heatmapTrough = buildTrough()
  cohorts = buildCohorts()
  cohortMaxMonths = Math.max(...cohorts.map((c) => c.retention.length))
  worstCohort = buildWorstCohort()
}
