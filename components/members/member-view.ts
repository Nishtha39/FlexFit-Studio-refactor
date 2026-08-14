import type { Member } from '@/lib/types'
import { NOW, daysBetween } from '@/lib/seed'
import { getPlan } from '@/lib/data/plans'
import { getStaff } from '@/lib/data/staff'
import { getCompany } from '@/lib/data/companies'
import { locationById } from '@/lib/data'

/**
 * Batch 2 stores the raw membership lifecycle (`expired`, `cancelled`, …) while
 * Batch 1's `memberStatusMap` speaks the operator's vocabulary (`lapsed`,
 * `past_due`, `at_risk`, …). This module is the ONLY place that translation
 * happens, so the directory, the profile and every future batch label a member
 * identically. It also derives the handful of display facts (plan name, trainer
 * name, utilization) that would otherwise be recomputed in each component.
 */

export type MemberChipStatus =
  | 'active'
  | 'at_risk'
  | 'past_due'
  | 'frozen'
  | 'lapsed'
  | 'trial'
  | 'expiring'

/**
 * Resolution order matters: billing failure outranks churn risk, because a
 * failed payment is actionable today while risk is a forecast.
 */
export function chipStatusFor(member: Member): MemberChipStatus {
  const { status, metrics, risk } = member
  if (status === 'expired' || status === 'cancelled') return 'lapsed'
  if (status === 'frozen') return 'frozen'
  if (metrics.failedPayments > 0) return 'past_due'
  if (status === 'trial') return 'trial'
  if (risk.band === 'high') return 'at_risk'
  return 'active'
}

/** Plan utilization as a fraction, or null for unlimited plans. */
export function utilizationFor(member: Member): number | null {
  const allowance = member.metrics.planVisitsPerMonth
  if (allowance === null || allowance <= 0) return null
  return member.metrics.visitsLast30 / allowance
}

export interface MemberView {
  member: Member
  chipStatus: MemberChipStatus
  planName: string
  planInterval: string
  trainerName: string | null
  companyName: string | null
  locationName: string
  utilization: number | null
  joinedDaysAgo: number
}

export function toMemberView(member: Member): MemberView {
  const plan = getPlan(member.planId)
  const trainer = member.assignedTrainerId ? getStaff(member.assignedTrainerId) : null
  const company = member.companyId ? getCompany(member.companyId) : null

  return {
    member,
    chipStatus: chipStatusFor(member),
    planName: plan?.name ?? 'No plan',
    planInterval: plan?.interval ?? 'monthly',
    trainerName: trainer?.name ?? null,
    companyName: company?.name ?? null,
    locationName: locationById.get(member.homeLocation)?.shortName ?? member.homeLocation,
    utilization: utilizationFor(member),
    joinedDaysAgo: daysBetween(new Date(member.joinedDate), NOW),
  }
}

/** Label for a member's plan allowance, e.g. "12 / mo" or "Unlimited". */
export function allowanceLabel(member: Member): string {
  const allowance = member.metrics.planVisitsPerMonth
  return allowance === null ? 'Unlimited' : `${allowance} / mo`
}
