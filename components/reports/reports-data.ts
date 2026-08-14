// Reports library. Ten reports, each with a real computed result — a report
// that renders a placeholder teaches operators to distrust the whole section.

import { members } from '@/lib/data/members'
import { classes } from '@/lib/data/classes'
import { payments } from '@/lib/data/payments'
import { plans, getPlan } from '@/lib/data/plans'
import { staff, trainers } from '@/lib/data/staff'
import { companies } from '@/lib/data/companies'
import { leads } from '@/lib/data/leads'
import { dailyAttendance, hourWeekdayMatrix } from '@/lib/data/attendance'
import { WEEKDAY_LABELS } from '@/lib/seed'
import { compactMoney, money, num, percent } from '@/lib/format'
import type { LeadSource } from '@/lib/types'

export type ReportCategory = 'Revenue' | 'Members' | 'Operations' | 'Sales'
export type CellTone = 'default' | 'good' | 'warn' | 'danger' | 'muted'

export interface ReportColumn {
  key: string
  label: string
  align?: 'left' | 'right'
}

export interface ReportRow {
  cells: (string | number)[]
  tone?: CellTone
}

export interface ReportResult {
  columns: ReportColumn[]
  rows: ReportRow[]
  /** One sentence stating what the operator should do with this. */
  takeaway: string
  /** Stated honestly when the data cannot support a conclusion. */
  caveat?: string
}

export interface ReportDef {
  slug: string
  title: string
  category: ReportCategory
  question: string
  /** Time window the report covers, in words. */
  window: string
  run: () => ReportResult
}

const activePool = members.filter((m) => m.status === 'active' || m.status === 'trial' || m.status === 'frozen')

/* ------------------------------- Revenue ---------------------------------- */

const revenueByPlan: ReportDef = {
  slug: 'revenue-by-plan',
  title: 'Revenue by plan',
  category: 'Revenue',
  question: 'Which plans carry the business?',
  window: 'Current month, recurring value',
  run: () => {
    const rows = plans.map((plan) => {
      const holders = members.filter((m) => m.planId === plan.id && m.status !== 'cancelled' && m.status !== 'expired')
      const mrr = holders.reduce((s, m) => s + m.metrics.monthlyValue, 0)
      return { plan, holders: holders.length, mrr }
    })
    const total = rows.reduce((s, r) => s + r.mrr, 0) || 1
    return {
      columns: [
        { key: 'plan', label: 'Plan' },
        { key: 'members', label: 'Members', align: 'right' },
        { key: 'mrr', label: 'Monthly value', align: 'right' },
        { key: 'share', label: 'Share', align: 'right' },
        { key: 'arpu', label: 'Per member', align: 'right' },
      ],
      rows: rows
        .sort((a, b) => b.mrr - a.mrr)
        .map((r) => ({
          cells: [
            r.plan.name,
            num(r.holders),
            money(r.mrr),
            percent((r.mrr / total) * 100),
            money(r.holders === 0 ? 0 : Math.round(r.mrr / r.holders)),
          ],
        })),
      takeaway: `${rows.sort((a, b) => b.mrr - a.mrr)[0].plan.name} is the revenue centre. Protect it before optimising the tail.`,
    }
  },
}

const collectionsReport: ReportDef = {
  slug: 'collections',
  title: 'Collections and failures',
  category: 'Revenue',
  question: 'How much of what we billed actually arrived?',
  window: 'Last 120 days of payment rows',
  run: () => {
    const primaries = payments.filter((p) => p.reversalOf === null)
    const byMethod = ['card', 'upi', 'cash', 'transfer'].map((method) => {
      const own = primaries.filter((p) => p.method === method)
      const paid = own.filter((p) => p.status === 'paid')
      const failed = own.filter((p) => p.status === 'failed')
      return {
        method,
        count: own.length,
        billed: own.reduce((s, p) => s + p.amount, 0),
        collected: paid.reduce((s, p) => s + p.amount, 0),
        failRate: own.length === 0 ? 0 : (failed.length / own.length) * 100,
      }
    })
    return {
      columns: [
        { key: 'method', label: 'Method' },
        { key: 'count', label: 'Rows', align: 'right' },
        { key: 'billed', label: 'Billed', align: 'right' },
        { key: 'collected', label: 'Collected', align: 'right' },
        { key: 'fail', label: 'Failure rate', align: 'right' },
      ],
      rows: byMethod
        .sort((a, b) => b.billed - a.billed)
        .map((r) => ({
          cells: [r.method.toUpperCase(), num(r.count), money(r.billed), money(r.collected), percent(r.failRate)],
          tone: r.failRate > 12 ? 'danger' : r.failRate > 6 ? 'warn' : 'default',
        })),
      takeaway: 'Cards fail most often and are the only method worth a retry ladder. Cash never fails but never renews itself either.',
      caveat: 'Failure rates on small method samples (transfer, cash) move a lot month to month — read the count column first.',
    }
  },
}

const refundReport: ReportDef = {
  slug: 'refunds',
  title: 'Refunds and reversals',
  category: 'Revenue',
  question: 'What are we giving back, and why?',
  window: 'All reversal rows on record',
  run: () => {
    const reversals = payments.filter((p) => p.reversalOf !== null)
    const gross = payments.filter((p) => p.reversalOf === null).reduce((s, p) => s + p.amount, 0)
    const refunded = Math.abs(reversals.reduce((s, p) => s + p.amount, 0))
    return {
      columns: [
        { key: 'metric', label: 'Metric' },
        { key: 'value', label: 'Value', align: 'right' },
      ],
      rows: [
        { cells: ['Gross charges', money(gross)] },
        { cells: ['Refunded', money(refunded)], tone: 'warn' },
        { cells: ['Net', money(gross - refunded)] },
        { cells: ['Reversal rows', num(reversals.length)] },
        { cells: ['Refund rate', percent((refunded / (gross || 1)) * 100)] },
      ],
      takeaway: 'Refund rate under 3% is normal friction. Above it, look at the plan being refunded rather than the staff issuing them.',
    }
  },
}

/* ------------------------------- Members ---------------------------------- */

const riskReport: ReportDef = {
  slug: 'risk-band-value',
  title: 'Risk band by value',
  category: 'Members',
  question: 'How much revenue is sitting in each risk band?',
  window: 'Current snapshot',
  run: () => {
    const bands = ['high', 'medium', 'low'] as const
    return {
      columns: [
        { key: 'band', label: 'Band' },
        { key: 'members', label: 'Members', align: 'right' },
        { key: 'share', label: 'Share', align: 'right' },
        { key: 'mrr', label: 'Monthly value', align: 'right' },
        { key: 'ltv', label: 'Lifetime value', align: 'right' },
      ],
      rows: bands.map((band) => {
        const own = activePool.filter((m) => m.risk.band === band)
        return {
          cells: [
            band === 'high' ? 'High (70+)' : band === 'medium' ? 'Watch (40–69)' : 'Low (0–39)',
            num(own.length),
            percent((own.length / activePool.length) * 100),
            money(own.reduce((s, m) => s + m.metrics.monthlyValue, 0)),
            compactMoney(own.reduce((s, m) => s + m.metrics.lifetimeValue, 0)),
          ],
          tone: band === 'high' ? 'danger' : band === 'medium' ? 'warn' : 'good',
        }
      }),
      takeaway: 'The high band is a work queue, not a statistic — it maps one-to-one onto the retention screen.',
    }
  },
}

const tenureReport: ReportDef = {
  slug: 'tenure-cohorts',
  title: 'Tenure cohorts',
  category: 'Members',
  question: 'Where in the lifecycle do members stall?',
  window: 'Current snapshot by months joined',
  run: () => {
    const buckets = [
      { label: '0–2 months', min: 0, max: 2 },
      { label: '3–5 months', min: 3, max: 5 },
      { label: '6–11 months', min: 6, max: 11 },
      { label: '1–2 years', min: 12, max: 23 },
      { label: '2 years+', min: 24, max: 999 },
    ]
    return {
      columns: [
        { key: 'cohort', label: 'Cohort' },
        { key: 'members', label: 'Members', align: 'right' },
        { key: 'visits', label: 'Visits / mo', align: 'right' },
        { key: 'risk', label: 'Avg risk', align: 'right' },
        { key: 'mrr', label: 'Monthly value', align: 'right' },
      ],
      rows: buckets.map((b) => {
        const own = activePool.filter(
          (m) => m.metrics.tenureMonths >= b.min && m.metrics.tenureMonths <= b.max,
        )
        const avgRisk = own.length === 0 ? 0 : own.reduce((s, m) => s + m.risk.score, 0) / own.length
        const avgVisits = own.length === 0 ? 0 : own.reduce((s, m) => s + m.metrics.visitsLast30, 0) / own.length
        return {
          cells: [b.label, num(own.length), avgVisits.toFixed(1), avgRisk.toFixed(0), money(own.reduce((s, m) => s + m.metrics.monthlyValue, 0))],
          tone: avgRisk >= 55 ? 'warn' : 'default',
        }
      }),
      takeaway: 'Risk peaks in the first three months. Onboarding, not discounts, is the lever on that cohort.',
    }
  },
}

const utilizationReport: ReportDef = {
  slug: 'plan-utilization',
  title: 'Plan utilization',
  category: 'Members',
  question: 'Who is paying for visits they never take?',
  window: 'Last 30 days against plan allowance',
  run: () => {
    const rows = plans
      .filter((p) => p.visitsPerMonth !== null)
      .map((plan) => {
        const own = activePool.filter((m) => m.planId === plan.id)
        const allowance = plan.visitsPerMonth as number
        const under = own.filter((m) => m.metrics.visitsLast30 < allowance * 0.4).length
        const over = own.filter((m) => m.metrics.visitsLast30 > allowance).length
        const avg = own.length === 0 ? 0 : own.reduce((s, m) => s + m.metrics.visitsLast30, 0) / own.length
        return { plan, own: own.length, allowance, under, over, avg }
      })
    return {
      columns: [
        { key: 'plan', label: 'Plan' },
        { key: 'allowance', label: 'Allowance', align: 'right' },
        { key: 'avg', label: 'Avg used', align: 'right' },
        { key: 'under', label: 'Under 40%', align: 'right' },
        { key: 'over', label: 'Over cap', align: 'right' },
      ],
      rows: rows.map((r) => ({
        cells: [r.plan.name, num(r.allowance), r.avg.toFixed(1), num(r.under), num(r.over)],
        tone: r.under > r.own / 2 ? 'warn' : 'default',
      })),
      takeaway: 'Members far under their allowance churn quietly. Move them down a tier before they leave the ladder entirely.',
    }
  },
}

/* ------------------------------ Operations -------------------------------- */

const classFillReport: ReportDef = {
  slug: 'class-fill',
  title: 'Class fill rate',
  category: 'Operations',
  question: 'Which class types earn their slot?',
  window: 'Current weekly schedule',
  run: () => {
    const types = [...new Set(classes.map((c) => c.type))]
    return {
      columns: [
        { key: 'type', label: 'Type' },
        { key: 'classes', label: 'Classes', align: 'right' },
        { key: 'seats', label: 'Seats', align: 'right' },
        { key: 'booked', label: 'Booked', align: 'right' },
        { key: 'fill', label: 'Fill', align: 'right' },
        { key: 'waitlist', label: 'Waitlisted', align: 'right' },
      ],
      rows: types
        .map((type) => {
          const own = classes.filter((c) => c.type === type)
          const seats = own.reduce((s, c) => s + c.capacity, 0)
          const booked = own.reduce((s, c) => s + c.roster.length, 0)
          const fill = seats === 0 ? 0 : (booked / seats) * 100
          return {
            type,
            cells: [
              type,
              num(own.length),
              num(seats),
              num(booked),
              percent(fill),
              num(own.reduce((s, c) => s + c.waitlist.length, 0)),
            ],
            fill,
          }
        })
        .sort((a, b) => b.fill - a.fill)
        .map((r) => ({ cells: r.cells, tone: r.fill >= 90 ? 'good' : r.fill < 45 ? 'warn' : 'default' })),
      takeaway: 'Anything under 45% fill is a slot to re-time or retire; anything at 100% with a waitlist is a class to duplicate.',
    }
  },
}

const peakHoursReport: ReportDef = {
  slug: 'peak-hours',
  title: 'Peak hours',
  category: 'Operations',
  question: 'When does the floor actually fill up?',
  window: 'All check-ins, hour × weekday',
  run: () => {
    const matrix = hourWeekdayMatrix()
    const hours = [6, 7, 8, 9, 12, 17, 18, 19, 20]
    return {
      columns: [
        { key: 'hour', label: 'Hour' },
        ...WEEKDAY_LABELS.map((d) => ({ key: d, label: d, align: 'right' as const })),
      ],
      rows: hours.map((hour) => ({
        cells: [
          `${hour}:00`,
          ...WEEKDAY_LABELS.map((_, weekday) => num(matrix[weekday]?.[hour] ?? 0)),
        ],
      })),
      takeaway: 'Weekday 18:00–19:00 is the constraint. Every capacity decision — trainers, equipment, class slots — is really about that hour.',
    }
  },
}

const trainerLoadReport: ReportDef = {
  slug: 'trainer-load',
  title: 'Trainer load',
  category: 'Operations',
  question: 'Who is over-booked, and who has room?',
  window: 'Current weekly schedule',
  run: () => ({
    columns: [
      { key: 'trainer', label: 'Trainer' },
      { key: 'classes', label: 'Classes', align: 'right' },
      { key: 'hours', label: 'Hours / wk', align: 'right' },
      { key: 'fill', label: 'Seat fill', align: 'right' },
      { key: 'clients', label: 'Assigned', align: 'right' },
    ],
    rows: trainers
      .map((trainer) => {
        const own = classes.filter((c) => c.trainerId === trainer.id)
        const seats = own.reduce((s, c) => s + c.capacity, 0)
        const booked = own.reduce((s, c) => s + c.roster.length, 0)
        const hours = own.reduce((s, c) => s + c.durationMin, 0) / 60
        const fill = seats === 0 ? 0 : (booked / seats) * 100
        return {
          cells: [
            trainer.active ? trainer.name : `${trainer.name} (left)`,
            num(own.length),
            hours.toFixed(1),
            percent(fill),
            num(members.filter((m) => m.assignedTrainerId === trainer.id).length),
          ],
          hours,
          tone: (!trainer.active ? 'muted' : hours > 12 ? 'warn' : 'default') as CellTone,
        }
      })
      .sort((a, b) => b.hours - a.hours)
      .map(({ cells, tone }) => ({ cells, tone })),
    takeaway: 'Above ~12 contact hours a week, cancellations and late starts climb. That is the ceiling worth staffing against.',
  }),
}

const corporateReport: ReportDef = {
  slug: 'corporate-burn',
  title: 'Corporate pool burn',
  category: 'Operations',
  question: 'Which company contract is about to run dry?',
  window: 'Current pools at trailing burn rate',
  run: () => ({
    columns: [
      { key: 'company', label: 'Company' },
      { key: 'pool', label: 'Pool', align: 'right' },
      { key: 'used', label: 'Used', align: 'right' },
      { key: 'burn', label: 'Burn / wk', align: 'right' },
      { key: 'weeks', label: 'Weeks left', align: 'right' },
      { key: 'employees', label: 'Employees', align: 'right' },
    ],
    rows: companies
      .map((c) => {
        const remaining = Math.max(0, c.poolCredits - c.creditsUsed)
        const weeks = c.burnRatePerWeek === 0 ? 99 : remaining / c.burnRatePerWeek
        return {
          cells: [
            c.name,
            num(c.poolCredits),
            percent((c.creditsUsed / c.poolCredits) * 100),
            num(c.burnRatePerWeek),
            weeks.toFixed(1),
            num(c.employeeMemberIds.length),
          ],
          weeks,
          tone: (weeks < 4 ? 'danger' : weeks < 10 ? 'warn' : 'default') as CellTone,
        }
      })
      .sort((a, b) => a.weeks - b.weeks)
      .map(({ cells, tone }) => ({ cells, tone })),
    takeaway: 'A pool that empties turns paying employees away at the desk. Top up before the week count drops under four.',
  }),
}

/* -------------------------------- Sales ----------------------------------- */

const leadSourceReport: ReportDef = {
  slug: 'lead-sources',
  title: 'Lead source quality',
  category: 'Sales',
  question: 'Which channel sends leads that actually join?',
  window: 'All leads on record',
  run: () => {
    const sources = [...new Set(leads.map((l) => l.source))] as LeadSource[]
    const rows = sources.map((source) => {
      const own = leads.filter((l) => l.source === source)
      const won = own.filter((l) => l.stage === 'won').length
      const lost = own.filter((l) => l.stage === 'lost').length
      const closed = won + lost
      return {
        source,
        cells: [
          source,
          num(own.length),
          num(won),
          closed === 0 ? '—' : percent((won / closed) * 100),
          money(own.reduce((s, l) => s + l.estValue, 0)),
        ],
        closed,
      }
    })
    return {
      columns: [
        { key: 'source', label: 'Source' },
        { key: 'leads', label: 'Leads', align: 'right' },
        { key: 'won', label: 'Won', align: 'right' },
        { key: 'rate', label: 'Close rate', align: 'right' },
        { key: 'value', label: 'Pipeline value', align: 'right' },
      ],
      rows: rows
        .sort((a, b) => b.closed - a.closed)
        .map((r) => ({ cells: r.cells, tone: r.closed < 3 ? 'muted' : 'default' })),
      takeaway: 'Referrals close best per lead. Instagram sends volume that needs a faster first call to convert.',
      caveat: 'Most sources have fewer than five closed leads, so close rates here are directional only — not a budget decision yet.',
    }
  },
}

const attendanceTrendReport: ReportDef = {
  slug: 'attendance-trend',
  title: 'Attendance trend',
  category: 'Operations',
  question: 'Is the floor busier than it was?',
  window: '18 months of daily check-ins, by month',
  run: () => {
    const byMonth = new Map<string, number>()
    for (const day of dailyAttendance) {
      const key = day.date.slice(0, 7)
      byMonth.set(key, (byMonth.get(key) ?? 0) + day.count)
    }
    const entries = [...byMonth.entries()].slice(-12)
    return {
      columns: [
        { key: 'month', label: 'Month' },
        { key: 'checkins', label: 'Check-ins', align: 'right' },
        { key: 'change', label: 'vs prior', align: 'right' },
      ],
      rows: entries.map(([month, count], i) => {
        const prior = i === 0 ? null : entries[i - 1][1]
        const change = prior === null ? null : ((count - prior) / prior) * 100
        return {
          cells: [month, num(count), change === null ? '—' : `${change > 0 ? '+' : '\u2212'}${Math.abs(change).toFixed(1)}%`],
          tone: change !== null && change < -8 ? 'warn' : 'default',
        }
      }),
      takeaway: 'January spikes and summer dips are seasonal, not signals. The March 2025 step-down is the trainer departure.',
    }
  },
}

export const REPORTS: ReportDef[] = [
  revenueByPlan,
  collectionsReport,
  refundReport,
  riskReport,
  tenureReport,
  utilizationReport,
  classFillReport,
  peakHoursReport,
  trainerLoadReport,
  corporateReport,
  leadSourceReport,
  attendanceTrendReport,
]

export const reportBySlug = new Map(REPORTS.map((r) => [r.slug, r]))

export function getReport(slug: string): ReportDef | undefined {
  return reportBySlug.get(slug)
}

export const REPORT_CATEGORIES: ReportCategory[] = ['Revenue', 'Members', 'Operations', 'Sales']

/** Staff who can be scheduled a report by email. */
export const reportRecipients = staff.filter((s) => s.active && (s.role === 'owner' || s.role === 'manager'))

export function planNameFor(id: string): string {
  return getPlan(id)?.name ?? 'Membership'
}
