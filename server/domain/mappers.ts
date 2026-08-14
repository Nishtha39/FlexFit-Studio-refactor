/**
 * Row → entity. One place where the storage shape becomes the shape
 * `lib/types.ts` promises, so no procedure has to remember that metrics are
 * flat columns or that a roster is a set of rows.
 *
 * Everything derived is derived HERE rather than stored:
 *   - `member.risk`            — `computeRisk` over the member's own metrics
 *   - `lead.ageDays`           — NOW minus createdDate
 *   - `class.roster/waitlist`  — rebuilt from class_seats, waitlist in position order
 *   - `company.employeeMemberIds` — the members pointing at the company
 *   - `notification.entity`    — re-nested from the two flat columns
 *
 * The clock is `NOW` from lib/seed.ts, not `new Date()`. The entire dataset was
 * generated relative to that fixed instant, so using the wall clock here would
 * make "39 days since last visit" drift away from the check-ins that justify it
 * — the numbers on screen would stop agreeing with each other overnight.
 */
import type {
  AppNotification,
  Company,
  GymClass,
  Lead,
  Member,
  Payment,
  Plan,
  Staff,
} from '../../lib/types'
import { computeRisk } from '../../lib/risk'
import { NOW, daysBetween } from '../../lib/seed'

type Row = Record<string, unknown>

export function toPlan(r: Row): Plan {
  return {
    id: r.id as string,
    name: r.name as string,
    description: r.description as string,
    interval: r.interval as Plan['interval'],
    price: r.price as number,
    visitsPerMonth: (r.visitsPerMonth ?? null) as number | null,
    corporateOnly: Boolean(r.corporateOnly),
    active: Boolean(r.active),
    perks: (r.perks ?? []) as string[],
  }
}

export function toStaff(r: Row): Staff {
  return {
    id: r.id as string,
    firstName: r.firstName as string,
    lastName: r.lastName as string,
    name: r.name as string,
    initials: r.initials as string,
    role: r.role as Staff['role'],
    email: r.email as string,
    phone: r.phone as string,
    specialties: (r.specialties ?? []) as string[],
    locations: (r.locations ?? []) as Staff['locations'],
    activeFrom: r.activeFrom as string,
    activeTo: (r.activeTo ?? null) as string | null,
    active: Boolean(r.active),
  }
}

export function toMember(r: Row): Member {
  const metrics: Member['metrics'] = {
    tenureMonths: r.metricTenureMonths as number,
    lastVisit: (r.metricLastVisit ?? null) as string | null,
    daysSinceLastVisit: (r.metricDaysSinceLastVisit ?? null) as number | null,
    visitsLast30: r.metricVisitsLast30 as number,
    visitsPrev30: r.metricVisitsPrev30 as number,
    avgVisitsPerWeek: r.metricAvgVisitsPerWeek as number,
    planVisitsPerMonth: (r.metricPlanVisitsPerMonth ?? null) as number | null,
    creditsRemaining: (r.metricCreditsRemaining ?? null) as number | null,
    freezeCount: r.metricFreezeCount as number,
    cancelRate: r.metricCancelRate as number,
    failedPayments: r.metricFailedPayments as number,
    lifetimeValue: r.metricLifetimeValue as number,
    monthlyValue: r.metricMonthlyValue as number,
  }

  const status = r.status as Member['status']

  return {
    id: r.id as string,
    firstName: r.firstName as string,
    lastName: r.lastName as string,
    name: r.name as string,
    initials: r.initials as string,
    email: r.email as string,
    phone: r.phone as string,
    status,
    planId: r.planId as string,
    homeLocation: r.homeLocation as Member['homeLocation'],
    assignedTrainerId: (r.assignedTrainerId ?? null) as string | null,
    companyId: (r.companyId ?? null) as string | null,
    joinedDate: r.joinedDate as string,
    endDate: (r.endDate ?? null) as string | null,
    tags: (r.tags ?? []) as string[],
    metrics,
    // Derived, never stored — a saved score would go stale the moment a member
    // checks in, and the factor breakdown is what the profile screen explains.
    risk: computeRisk({
      status,
      daysSinceLastVisit: metrics.daysSinceLastVisit,
      visitsLast30: metrics.visitsLast30,
      visitsPrev30: metrics.visitsPrev30,
      planVisitsPerMonth: metrics.planVisitsPerMonth,
      tenureMonths: metrics.tenureMonths,
      failedPayments: metrics.failedPayments,
      cancelRate: metrics.cancelRate,
      freezeCount: metrics.freezeCount,
    }),
  }
}

export interface SeatRow {
  classId: string
  memberId: string
  kind: 'roster' | 'waitlist'
  position: number
}

/** Seats arrive as rows; `GymClass` wants two ordered id arrays. */
export function toClass(r: Row, seats: SeatRow[]): GymClass {
  const mine = seats.filter((s) => s.classId === r.id)
  return {
    id: r.id as string,
    name: r.name as string,
    type: r.type as GymClass['type'],
    trainerId: r.trainerId as string,
    location: r.location as GymClass['location'],
    dayOfWeek: r.dayOfWeek as number,
    startTime: r.startTime as string,
    durationMin: r.durationMin as number,
    capacity: r.capacity as number,
    roster: mine.filter((s) => s.kind === 'roster').map((s) => s.memberId),
    waitlist: mine
      .filter((s) => s.kind === 'waitlist')
      .sort((a, b) => a.position - b.position)
      .map((s) => s.memberId),
  }
}

export function toCompany(r: Row, employeeMemberIds: string[]): Company {
  return {
    id: r.id as string,
    name: r.name as string,
    contactName: r.contactName as string,
    contactEmail: r.contactEmail as string,
    planId: r.planId as string,
    poolCredits: r.poolCredits as number,
    creditsUsed: r.creditsUsed as number,
    burnRatePerWeek: r.burnRatePerWeek as number,
    employeeMemberIds,
    startDate: r.startDate as string,
    renewalDate: r.renewalDate as string,
  }
}

export function toPayment(r: Row): Payment {
  return {
    id: r.id as string,
    invoiceId: r.invoiceId as string,
    memberId: r.memberId as string,
    planId: (r.planId ?? null) as string | null,
    amount: r.amount as number,
    method: r.method as Payment['method'],
    status: r.status as Payment['status'],
    date: r.date as string,
    description: r.description as string,
    reversalOf: (r.reversalOf ?? null) as string | null,
  }
}

export function toLead(r: Row): Lead {
  const createdDate = r.createdDate as string
  return {
    id: r.id as string,
    name: r.name as string,
    email: r.email as string,
    phone: r.phone as string,
    source: r.source as Lead['source'],
    stage: r.stage as Lead['stage'],
    ownerId: r.ownerId as string,
    createdDate,
    // Derived: a stored age is wrong by the next morning.
    ageDays: Math.max(0, daysBetween(new Date(createdDate), NOW)),
    estValue: r.estValue as number,
    interestedPlanId: (r.interestedPlanId ?? null) as string | null,
    note: (r.note ?? '') as string,
  }
}

export function toNotification(r: Row): AppNotification {
  const entityType = (r.entityType ?? null) as AppNotification['entity'] extends null
    ? never
    : 'member' | 'class' | 'company' | 'payment' | 'lead' | null
  const entityId = (r.entityId ?? null) as string | null
  return {
    id: r.id as string,
    kind: r.kind as AppNotification['kind'],
    severity: r.severity as AppNotification['severity'],
    title: r.title as string,
    body: r.body as string,
    timestamp: r.timestamp as string,
    read: Boolean(r.read),
    entity: entityType && entityId ? { type: entityType, id: entityId } : null,
  }
}
