/**
 * Pure ledger rules. No database, no React — so the API and the UI can both
 * import it and cannot disagree about what a refund looks like.
 *
 * This is the "one place instead of four" version of a rule that previously
 * lived only in `components/payments/payments-data.ts`. It stays pure so that
 * importing it into the Worker does not drag the client data layer along.
 *
 * The ledger is APPEND ONLY. Nothing here mutates a payment: a refund produces
 * a NEW row with a negative amount pointing back at the original through
 * `reversalOf`, which is what lets gross / refunds / net reconcile by replay
 * rather than by trusting a running total.
 */
import type { Payment } from '../../lib/types'
import { isoStamp, NOW } from '../../lib/seed'

/**
 * The reversal row for `original`. Byte-identical to the shape the UI has been
 * rendering since Batch 8 — same id scheme, same `-R` invoice suffix, same
 * description — so existing ledger rows and new ones are indistinguishable.
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

/**
 * A retry is a fresh attempt at the same invoice, not an edit of the failed row.
 * The failed row stays visible in the ledger — that history is the whole point
 * of the dunning screen, which counts attempts per invoice.
 */
export function buildRetry(original: Payment, attempt: number): Payment {
  return {
    id: `${original.id}-r${attempt}`,
    invoiceId: original.invoiceId,
    memberId: original.memberId,
    planId: original.planId,
    amount: original.amount,
    method: original.method,
    status: 'pending',
    date: isoStamp(NOW),
    description: `${original.description} — retry ${attempt}`,
    reversalOf: null,
  }
}

/** True once a reversal row exists for this payment. */
export function isReversed(payment: Payment, all: Payment[]): boolean {
  return all.some((p) => p.reversalOf === payment.id)
}

/**
 * Refusal reasons, as values rather than thrown strings, so the API and the UI
 * name the same failures. Every one is a case the UI could already produce.
 */
export type RefundRefusal = 'not-found' | 'already-reversed' | 'not-refundable' | 'is-reversal'

export function refundRefusal(payment: Payment | undefined, all: Payment[]): RefundRefusal | null {
  if (!payment) return 'not-found'
  if (payment.reversalOf !== null) return 'is-reversal'
  if (isReversed(payment, all)) return 'already-reversed'
  // Only money that actually moved can come back.
  if (payment.status !== 'paid') return 'not-refundable'
  return null
}
