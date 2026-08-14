// Payment ledger derivations. The ledger is append-only: a refund is a paired
// reversal row referencing the original, so gross, refunds and net always
// reconcile against lib/data/payments.ts.

import { payments } from '@/lib/data/payments'
import { getMember } from '@/lib/data/members'
import { getPlan } from '@/lib/data/plans'
import { isoStamp, NOW } from '@/lib/seed'
import type { Payment, PaymentMethod, PaymentStatus } from '@/lib/types'

export interface LedgerRow {
  payment: Payment
  memberName: string
  planName: string
  /** True for a negative reversal row. */
  isReversal: boolean
  /** For an original that has been reversed: the reversal row's id. */
  reversedBy: string | null
}

export function ledgerRows(rows: Payment[] = payments): LedgerRow[] {
  return rows.map((payment) => ({
    payment,
    memberName: getMember(payment.memberId)?.name ?? 'Unknown member',
    planName: payment.planId ? (getPlan(payment.planId)?.name ?? 'Membership') : 'Membership',
    isReversal: payment.reversalOf !== null,
    reversedBy: rows.find((r) => r.reversalOf === payment.id)?.id ?? null,
  }))
}

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  card: 'Card',
  cash: 'Cash',
  upi: 'UPI',
  transfer: 'Bank transfer',
}

export const STATUS_ORDER: PaymentStatus[] = ['paid', 'pending', 'failed', 'refunded']

export interface LedgerTotals {
  gross: number
  refunds: number
  net: number
  settled: number
  unsettled: number
  count: number
}

export function ledgerTotals(rows: LedgerRow[]): LedgerTotals {
  const gross = rows.filter((r) => !r.isReversal).reduce((s, r) => s + r.payment.amount, 0)
  const refunds = rows.filter((r) => r.isReversal).reduce((s, r) => s + r.payment.amount, 0)
  const settled = rows
    .filter((r) => !r.isReversal && r.payment.status === 'paid')
    .reduce((s, r) => s + r.payment.amount, 0)
  const unsettled = rows
    .filter((r) => r.payment.status === 'failed' || r.payment.status === 'pending')
    .reduce((s, r) => s + r.payment.amount, 0)
  return { gross, refunds, net: gross + refunds, settled, unsettled, count: rows.length }
}

export interface MethodSplit {
  method: PaymentMethod
  label: string
  count: number
  amount: number
  share: number
}

export function methodSplit(rows: LedgerRow[]): MethodSplit[] {
  const primaries = rows.filter((r) => !r.isReversal)
  const total = primaries.reduce((s, r) => s + r.payment.amount, 0) || 1
  return (Object.keys(METHOD_LABELS) as PaymentMethod[])
    .map((method) => {
      const own = primaries.filter((r) => r.payment.method === method)
      const amount = own.reduce((s, r) => s + r.payment.amount, 0)
      return { method, label: METHOD_LABELS[method], count: own.length, amount, share: (amount / total) * 100 }
    })
    .sort((a, b) => b.amount - a.amount)
}

/**
 * Builds the reversal row for a refund. Nothing is mutated: the caller appends
 * this row, exactly as the server ledger would.
 */
export function buildReversal(original: Payment, reason: string): Payment {
  return {
    id: `pay-rev-${original.id}`,
    invoiceId: `${original.invoiceId}-R`,
    memberId: original.memberId,
    planId: original.planId,
    amount: -original.amount,
    method: original.method,
    status: 'refunded',
    date: isoStamp(NOW),
    description: `Refund — ${reason}`,
    reversalOf: original.id,
  }
}

export const REFUND_REASONS = [
  'Duplicate charge',
  'Cancelled within cooling-off period',
  'Billed after freeze started',
  'Class cancelled by studio',
  'Goodwill — service issue',
] as const
