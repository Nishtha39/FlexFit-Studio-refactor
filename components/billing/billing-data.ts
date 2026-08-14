// Billing derivations. Invoices are NOT a new entity in the seed data — they are
// derived from lib/data/payments.ts so the ledger, the dunning queue and the
// member profile all reconcile to the same rows.

import { payments } from '@/lib/data/payments'
import { getMember, members } from '@/lib/data/members'
import { getPlan, plans } from '@/lib/data/plans'
import { addDays, isoDate, makeRng, NOW } from '@/lib/seed'
import type { Payment, PaymentMethod, PaymentStatus, Plan } from '@/lib/types'

export const GST_RATE = 0.18

export interface InvoiceLine {
  label: string
  detail: string
  qty: number
  unit: number
  amount: number
}

export interface Invoice {
  /** Human invoice number, e.g. INV-4812. Also the route param. */
  id: string
  memberId: string
  memberName: string
  planId: string | null
  planName: string
  issuedDate: string
  dueDate: string
  /** Gross amount including tax. */
  amount: number
  taxAmount: number
  netAmount: number
  status: PaymentStatus
  method: PaymentMethod
  description: string
  lines: InvoiceLine[]
  /** Payment rows that settle (or reverse) this invoice. */
  paymentIds: string[]
  /** Sum of reversal rows against this invoice — negative or 0. */
  reversed: number
  /** Days past the due date; 0 when not overdue. */
  overdueDays: number
}

/**
 * Seed for the dunning next-action dates. Deliberately NOT a shared module-level
 * generator: `makeRng` is stateful, and `dunningQueue()` runs once on the server
 * and again on the client during hydration. A shared instance would already have
 * been advanced by the server pass, so the client drew different dates and React
 * reported a hydration mismatch. Re-seeding per call makes the output identical
 * on both passes.
 */
const DUNNING_SEED = 0x8111e0

function daysPast(iso: string): number {
  return Math.max(0, Math.floor((NOW.getTime() - new Date(iso).getTime()) / 86_400_000))
}

function linesFor(plan: Plan | undefined, net: number, tax: number, member: string): InvoiceLine[] {
  const lines: InvoiceLine[] = [
    {
      label: plan?.name ?? 'Membership',
      detail: plan
        ? plan.interval === 'annual'
          ? '12 months, billed once'
          : plan.interval === 'per-visit'
            ? 'Single visit'
            : 'Monthly subscription'
        : 'Membership dues',
      qty: 1,
      unit: net,
      amount: net,
    },
    {
      label: 'GST',
      detail: '18% on membership services',
      qty: 1,
      unit: tax,
      amount: tax,
    },
  ]
  if (plan?.corporateOnly) {
    lines[0].detail = `Pooled credits — ${member}`
  }
  return lines
}

function build(): Invoice[] {
  const primaries = payments.filter((p) => p.reversalOf === null)
  return primaries.map((p) => {
    const member = getMember(p.memberId)
    const plan = p.planId ? getPlan(p.planId) : undefined
    const net = Math.round(p.amount / (1 + GST_RATE))
    const tax = p.amount - net
    const issued = p.date.slice(0, 10)
    const dueOffset = plan?.interval === 'annual' ? 14 : 7
    const dueDate = isoDate(addDays(new Date(issued), dueOffset))
    const reversals = payments.filter((r) => r.reversalOf === p.id)
    const unsettled = p.status === 'failed' || p.status === 'pending'

    return {
      id: p.invoiceId,
      memberId: p.memberId,
      memberName: member?.name ?? 'Unknown member',
      planId: p.planId,
      planName: plan?.name ?? 'Membership',
      issuedDate: issued,
      dueDate,
      amount: p.amount,
      taxAmount: tax,
      netAmount: net,
      status: p.status,
      method: p.method,
      description: p.description,
      lines: linesFor(plan, net, tax, member?.name ?? ''),
      paymentIds: [p.id, ...reversals.map((r) => r.id)],
      reversed: reversals.reduce((s, r) => s + r.amount, 0),
      overdueDays: unsettled ? daysPast(dueDate) : 0,
    }
  })
}

export const invoices: Invoice[] = build()

export const invoiceById = new Map(invoices.map((i) => [i.id, i]))

export function getInvoice(id: string): Invoice | undefined {
  return invoiceById.get(id)
}

export function paymentsForInvoice(invoice: Invoice): Payment[] {
  return payments.filter((p) => invoice.paymentIds.includes(p.id))
}

/* -------------------------------------------------------------------------- */
/*  Totals                                                                    */
/* -------------------------------------------------------------------------- */

export interface BillingTotals {
  billed: number
  collected: number
  outstanding: number
  failed: number
  refunded: number
  collectionRate: number
}

export function billingTotals(rows: Invoice[] = invoices): BillingTotals {
  const billed = rows.reduce((s, i) => s + i.amount, 0)
  const collected = rows.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
  const outstanding = rows.filter((i) => i.status === 'pending').reduce((s, i) => s + i.amount, 0)
  const failed = rows.filter((i) => i.status === 'failed').reduce((s, i) => s + i.amount, 0)
  const refunded = rows.filter((i) => i.status === 'refunded').reduce((s, i) => s + Math.abs(i.reversed), 0)
  return {
    billed,
    collected,
    outstanding,
    failed,
    refunded,
    collectionRate: billed > 0 ? (collected / billed) * 100 : 0,
  }
}

/* -------------------------------------------------------------------------- */
/*  Dunning — the recovery ladder                                             */
/* -------------------------------------------------------------------------- */

export type DunningStep = 'retry-1' | 'sms' | 'call' | 'retry-final' | 'suspend'

export interface DunningStepMeta {
  id: DunningStep
  label: string
  /** What actually happens when this step runs. */
  action: string
  /** Day, counted from the first failure. */
  onDay: number
  automatic: boolean
}

export const DUNNING_LADDER: DunningStepMeta[] = [
  { id: 'retry-1', label: 'Retry card', action: 'Automatic retry on the saved card.', onDay: 1, automatic: true },
  { id: 'sms', label: 'SMS notice', action: 'One SMS with a payment link. No marketing copy.', onDay: 3, automatic: true },
  { id: 'call', label: 'Staff call', action: 'Front desk calls to confirm the card is live.', onDay: 7, automatic: false },
  { id: 'retry-final', label: 'Final retry', action: 'Last automatic attempt before access is paused.', onDay: 12, automatic: true },
  { id: 'suspend', label: 'Pause access', action: 'Check-in is blocked. Membership is not cancelled.', onDay: 18, automatic: false },
]

export interface DunningItem {
  invoice: Invoice
  step: DunningStepMeta
  /** Retry attempts already made. */
  attempts: number
  nextActionDate: string
  /** Monthly value of the member behind this invoice — recovery worth. */
  monthlyValue: number
  riskScore: number
  paused: boolean
}

export function dunningQueue(): DunningItem[] {
  const rng = makeRng(DUNNING_SEED)
  const open = invoices.filter((i) => i.status === 'failed' || i.status === 'pending')
  const items = open.map((invoice) => {
    const step =
      [...DUNNING_LADDER].reverse().find((s) => invoice.overdueDays >= s.onDay) ?? DUNNING_LADDER[0]
    const member = getMember(invoice.memberId)
    return {
      invoice,
      step,
      attempts: Math.min(3, 1 + Math.floor(invoice.overdueDays / 6)),
      nextActionDate: isoDate(addDays(NOW, rng.int(0, 3))),
      monthlyValue: member?.metrics.monthlyValue ?? 0,
      riskScore: member?.risk.score ?? 0,
      paused: step.id === 'suspend',
    }
  })
  // Recovery order: how much is at stake, then how late it is.
  items.sort(
    (a, b) =>
      b.invoice.amount + b.monthlyValue - (a.invoice.amount + a.monthlyValue) ||
      b.invoice.overdueDays - a.invoice.overdueDays,
  )
  return items
}

/* -------------------------------------------------------------------------- */
/*  Plan builder                                                              */
/* -------------------------------------------------------------------------- */

export interface PlanDraft {
  id: string
  name: string
  interval: Plan['interval']
  price: number
  visitsPerMonth: number | null
  corporateOnly: boolean
  active: boolean
  perks: string[]
}

export function draftFromPlan(plan: Plan): PlanDraft {
  return {
    id: plan.id,
    name: plan.name,
    interval: plan.interval,
    price: plan.price,
    visitsPerMonth: plan.visitsPerMonth,
    corporateOnly: plan.corporateOnly,
    active: plan.active,
    perks: [...plan.perks],
  }
}

export interface PlanImpact {
  members: number
  currentMrr: number
  draftMrr: number
  deltaMrr: number
  /** Members whose visit allowance would drop below what they already use. */
  overAllowance: number
}

/** Monthly-equivalent revenue for a plan price at a given interval. */
export function monthlyEquivalent(price: number, interval: Plan['interval']): number {
  if (interval === 'annual') return Math.round(price / 12)
  if (interval === 'per-visit') return price * 4
  return price
}

export function planImpact(draft: PlanDraft): PlanImpact {
  const plan = getPlan(draft.id)
  const holders = members.filter((m) => m.planId === draft.id)
  const current = plan ? monthlyEquivalent(plan.price, plan.interval) : 0
  const next = monthlyEquivalent(draft.price, draft.interval)
  return {
    members: holders.length,
    currentMrr: current * holders.length,
    draftMrr: next * holders.length,
    deltaMrr: (next - current) * holders.length,
    overAllowance:
      draft.visitsPerMonth === null
        ? 0
        : holders.filter((m) => m.metrics.visitsLast30 > (draft.visitsPerMonth as number)).length,
  }
}

export const planCatalog = plans
