/**
 * Money. Every procedure here appends to the ledger; none of them edits a row
 * that is already in it.
 *
 * There is no `invoices` table, so there is no "invoice" to update: an invoice
 * is the set of payment rows sharing an `invoiceId`, and its status is whatever
 * replaying those rows says it is. That is why a refund inserts a reversal and a
 * retry inserts a fresh attempt, rather than either one flipping a status
 * column. `components/billing/billing-data.ts` keeps deriving the invoice view
 * exactly as it did before the database existed.
 */
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { publicProcedure, recordEvent, refuse, router } from '../init'
import { members, payments } from '../../db/schema'
import { toPayment } from '../../domain/mappers'
import { buildRetry, buildReversal, refundRefusal } from '../../domain/ledger-rules'
import { recomputeMemberMetrics } from '../../domain/metrics'

const REFUND_MESSAGE: Record<string, string> = {
  'not-found': 'That payment does not exist.',
  'is-reversal': 'This row is itself a refund; it cannot be refunded again.',
  'already-reversed': 'This payment has already been refunded.',
  'not-refundable': 'Only a settled payment can be refunded.',
}

export const billingRouter = router({
  /** Refund: appends the paired reversal row. The original is left untouched. */
  refund: publicProcedure
    .input(z.object({ paymentId: z.string().min(1), reason: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const all = (await ctx.db.select().from(payments)).map(toPayment)
      const original = all.find((p) => p.id === input.paymentId)

      const refusal = refundRefusal(original, all)
      if (refusal) refuse(refusal === 'not-found' ? 'NOT_FOUND' : 'BAD_REQUEST', REFUND_MESSAGE[refusal])

      const reversal = buildReversal(original!, input.reason)
      await ctx.db.insert(payments).values(reversal)
      await recomputeMemberMetrics(ctx.db, original!.memberId)

      await recordEvent(ctx, {
        kind: 'payment.refunded',
        entityType: 'payment',
        entityId: original!.id,
        summary: `Refunded ${original!.id} — ${input.reason}`,
        payload: { reversalId: reversal.id, amount: reversal.amount },
      })

      return reversal
    }),

  /**
   * Retry a failed card. The failed row stays in the ledger — the dunning screen
   * counts attempts per invoice, so erasing the failure would erase the ladder.
   */
  retry: publicProcedure
    .input(z.object({ paymentId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(payments).where(eq(payments.id, input.paymentId))
      const original = rows[0] ? toPayment(rows[0]) : undefined
      if (!original) refuse('NOT_FOUND', REFUND_MESSAGE['not-found'])
      if (original!.status !== 'failed') refuse('BAD_REQUEST', 'Only a failed payment can be retried.')

      const siblings = await ctx.db
        .select()
        .from(payments)
        .where(eq(payments.invoiceId, original!.invoiceId))
      const attempt = siblings.length

      const retry = buildRetry(original!, attempt)
      await ctx.db.insert(payments).values(retry)

      await recordEvent(ctx, {
        kind: 'payment.retried',
        entityType: 'payment',
        entityId: original!.id,
        summary: `Retried ${original!.invoiceId} (attempt ${attempt})`,
        payload: { retryId: retry.id },
      })

      return retry
    }),

  /**
   * Dunning rungs that are human actions rather than money movements — "front
   * desk called them", "access paused". They are events, not columns: which rung
   * an invoice sits on is derived from what has happened to it.
   */
  dunningAction: publicProcedure
    .input(
      z.object({
        invoiceId: z.string().min(1),
        memberId: z.string().min(1),
        action: z.enum(['called', 'sms-sent', 'access-paused', 'access-restored']),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Pausing access is the one rung that changes the member itself.
      if (input.action === 'access-paused') {
        await ctx.db.update(members).set({ status: 'frozen' }).where(eq(members.id, input.memberId))
      }
      if (input.action === 'access-restored') {
        await ctx.db.update(members).set({ status: 'active' }).where(eq(members.id, input.memberId))
      }

      await recordEvent(ctx, {
        kind: `dunning.${input.action}`,
        entityType: 'invoice',
        entityId: input.invoiceId,
        summary: `${input.action} on ${input.invoiceId}`,
        payload: { memberId: input.memberId, note: input.note ?? null },
      })

      return { invoiceId: input.invoiceId, action: input.action }
    }),
})
