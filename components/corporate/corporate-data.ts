// Corporate pool derivations. Burn rate is the only number that matters here:
// a pool that empties mid-quarter turns 24 paying employees away at the desk.

import { companies, poolUtilization, weeksToExhaustion } from '@/lib/data/companies'
import { getMember } from '@/lib/data/members'
import { getPlan } from '@/lib/data/plans'
import { addDays, isoDate, makeRng, NOW } from '@/lib/seed'
import type { Company, Member } from '@/lib/types'

/**
 * Seed for per-employee credit jitter. Kept as a seed rather than a shared
 * `makeRng` instance because `employeeUsage()` runs during render (server pass
 * and client hydration). A shared generator is stateful, so repeated calls
 * return different numbers and the two passes disagree — the hydration bug that
 * `dunningQueue()` in billing-data.ts hit for real. Re-seed per call instead.
 */
const EMPLOYEE_USAGE_SEED = 0xc0_11de

export type PoolHealth = 'healthy' | 'watch' | 'critical' | 'exhausted'

export interface PoolStatus {
  company: Company
  utilization: number
  remaining: number
  weeksLeft: number
  /** Weeks between now and the renewal date. */
  weeksToRenewal: number
  /** Credits the pool will be short by at renewal, 0 if it lasts. */
  shortfall: number
  health: PoolHealth
  employees: Member[]
  /** Employees who used a credit in the last 30 days. */
  activeEmployees: number
  planName: string
  costPerCredit: number
}

export const HEALTH_META: Record<PoolHealth, { label: string; tone: 'good' | 'warn' | 'danger' | 'neutral' }> = {
  healthy: { label: 'On track', tone: 'good' },
  watch: { label: 'Watch', tone: 'warn' },
  critical: { label: 'Runs out early', tone: 'danger' },
  exhausted: { label: 'Exhausted', tone: 'danger' },
}

function healthFor(weeksLeft: number, weeksToRenewal: number, remaining: number): PoolHealth {
  if (remaining <= 0) return 'exhausted'
  if (weeksLeft < weeksToRenewal - 2) return 'critical'
  if (weeksLeft < weeksToRenewal + 2) return 'watch'
  return 'healthy'
}

export function poolStatus(company: Company): PoolStatus {
  const employees = company.employeeMemberIds
    .map((id) => getMember(id))
    .filter((m): m is Member => Boolean(m))
  const remaining = Math.max(0, company.poolCredits - company.creditsUsed)
  const weeksLeft = weeksToExhaustion(company)
  const weeksToRenewal = Math.max(
    0,
    (new Date(company.renewalDate).getTime() - NOW.getTime()) / (7 * 86_400_000),
  )
  const plan = getPlan(company.planId)
  return {
    company,
    utilization: poolUtilization(company) * 100,
    remaining,
    weeksLeft,
    weeksToRenewal,
    shortfall: Math.max(0, Math.round((weeksToRenewal - weeksLeft) * company.burnRatePerWeek)),
    health: healthFor(weeksLeft, weeksToRenewal, remaining),
    employees,
    activeEmployees: employees.filter((m) => (m.metrics.daysSinceLastVisit ?? 99) <= 30).length,
    planName: plan?.name ?? 'Corporate Flex',
    costPerCredit: plan ? Math.round(plan.price / 12) : 250,
  }
}

export const pools: PoolStatus[] = companies
  .map(poolStatus)
  .sort((a, b) => b.utilization - a.utilization)

/* -------------------------------------------------------------------------- */
/*  Burn history — 12 weeks of consumption per pool                           */
/* -------------------------------------------------------------------------- */

export interface BurnWeek {
  weekStart: string
  credits: number
  /** Rolling remaining balance at the end of that week. */
  remaining: number
}

export function burnHistory(company: Company, weeks = 12): BurnWeek[] {
  const stream = makeRng(company.id.length * 7919 + company.poolCredits)
  const out: BurnWeek[] = []
  let used = company.creditsUsed
  for (let i = 0; i < weeks; i++) {
    const jitter = stream.float(0.72, 1.32)
    const credits = Math.max(0, Math.round(company.burnRatePerWeek * jitter))
    out.unshift({
      weekStart: isoDate(addDays(NOW, -7 * i)),
      credits,
      remaining: Math.max(0, company.poolCredits - used),
    })
    used = Math.max(0, used - credits)
  }
  return out
}

/** Forward projection to the renewal date at the current burn rate. */
export function projection(status: PoolStatus, weeks = 8): { weekStart: string; remaining: number }[] {
  const out: { weekStart: string; remaining: number }[] = []
  for (let i = 1; i <= weeks; i++) {
    out.push({
      weekStart: isoDate(addDays(NOW, 7 * i)),
      remaining: Math.max(0, status.remaining - status.company.burnRatePerWeek * i),
    })
  }
  return out
}

export const TOP_UP_SIZES = [50, 100, 200] as const

/** Deterministic per-employee credit usage, for the pool detail table. */
export function employeeUsage(status: PoolStatus): { member: Member; credits: number; lastVisit: string | null }[] {
  const rng = makeRng(EMPLOYEE_USAGE_SEED)
  return status.employees
    .map((member) => ({
      member,
      credits: Math.max(0, member.metrics.visitsLast30 + rng.int(0, 6)),
      lastVisit: member.metrics.lastVisit,
    }))
    .sort((a, b) => b.credits - a.credits)
}
