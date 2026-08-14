/**
 * Leads and notifications — the two things staff move through states all day.
 */
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { publicProcedure, recordEvent, refuse, router } from '../init'
import { leads, notifications } from '../../db/schema'
import { toLead } from '../../domain/mappers'

const STAGES = ['new', 'contacted', 'tour-booked', 'trial', 'won', 'lost'] as const

export const crmRouter = router({
  moveStage: publicProcedure
    .input(
      z.object({
        leadId: z.string().min(1),
        stage: z.enum(STAGES),
        /** Required by the board when moving to `lost` — the reason is the point. */
        lostReason: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(leads).where(eq(leads.id, input.leadId))
      if (!rows[0]) refuse('NOT_FOUND', 'That lead no longer exists.')
      const before = toLead(rows[0])

      if (input.stage === 'lost' && !input.lostReason) {
        refuse('BAD_REQUEST', 'A lost lead needs a reason — the loss-reason breakdown depends on it.')
      }

      await ctx.db
        .update(leads)
        .set({
          stage: input.stage,
          // Moving back out of `lost` clears the reason rather than leaving a
          // stale one attached to a live lead.
          lostReason: input.stage === 'lost' ? (input.lostReason ?? null) : null,
        })
        .where(eq(leads.id, input.leadId))

      await recordEvent(ctx, {
        kind: 'lead.stage-changed',
        entityType: 'lead',
        entityId: input.leadId,
        summary: `${before.name}: ${before.stage} → ${input.stage}`,
        payload: { from: before.stage, to: input.stage, lostReason: input.lostReason ?? null },
      })

      return { leadId: input.leadId, stage: input.stage }
    }),

  addLeadNote: publicProcedure
    .input(z.object({ leadId: z.string().min(1), note: z.string().max(2000) }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(leads).where(eq(leads.id, input.leadId))
      if (!rows[0]) refuse('NOT_FOUND', 'That lead no longer exists.')

      await ctx.db.update(leads).set({ note: input.note }).where(eq(leads.id, input.leadId))
      await recordEvent(ctx, {
        kind: 'lead.note',
        entityType: 'lead',
        entityId: input.leadId,
        summary: `Note updated on ${rows[0].name}`,
      })
      return { leadId: input.leadId, note: input.note }
    }),

  markNotificationRead: publicProcedure
    .input(z.object({ id: z.string().min(1), read: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(notifications).set({ read: input.read }).where(eq(notifications.id, input.id))
      return { id: input.id, read: input.read }
    }),

  markAllNotificationsRead: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.db.update(notifications).set({ read: true })
    await recordEvent(ctx, {
      kind: 'notifications.all-read',
      entityType: 'notification',
      entityId: '*',
      summary: 'Marked every notification read',
    })
    return { ok: true }
  }),
})
