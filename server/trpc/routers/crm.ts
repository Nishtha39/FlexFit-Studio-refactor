/**
 * Leads and notifications — the two things staff move through states all day.
 */
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { publicProcedure, recordEvent, refuse, router } from '../init'
import { leads, memberNotes, members, notifications, plans, staff } from '../../db/schema'
import { toLead, toMemberNote } from '../../domain/mappers'
import { NOW, isoDate, isoStamp } from '../../../lib/seed'

const STAGES = ['new', 'contacted', 'tour-booked', 'trial', 'won', 'lost'] as const
/** Must stay in step with `LeadSource` in lib/types.ts — the loss-reason and
 *  source-mix reports group on exactly these six. */
const SOURCES = ['walk-in', 'referral', 'website', 'instagram', 'google', 'corporate'] as const

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

  /**
   * Create a lead.
   *
   * `estValue` is what the pipeline is measured in, so it is required rather
   * than defaulted — a lead worth an unknown amount silently drags the
   * "₹X/mo in play" figure on the board down to nothing. Where a plan is named
   * its price is offered as the default in the UI, but the number that is
   * stored is the one the person entering it stands behind.
   */
  createLead: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(80),
        email: z.string().email().max(160),
        phone: z.string().min(4).max(30),
        source: z.enum(SOURCES),
        ownerId: z.string().min(1),
        estValue: z.number().int().nonnegative().max(1_000_000),
        interestedPlanId: z.string().nullable().default(null),
        note: z.string().max(2000).default(''),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const owner = await ctx.db.select().from(staff).where(eq(staff.id, input.ownerId))
      if (!owner[0]) refuse('NOT_FOUND', 'No staff member with that id to own the lead.')
      if (!owner[0].active) {
        refuse('BAD_REQUEST', `${owner[0].name} has left — a lead needs an owner who is still here to chase it.`)
      }
      if (input.interestedPlanId) {
        const plan = await ctx.db.select().from(plans).where(eq(plans.id, input.interestedPlanId))
        if (!plan[0]) refuse('NOT_FOUND', 'No plan with that id.')
      }

      const id = `lead-new-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const row = {
        id,
        name: input.name.trim(),
        email: input.email.toLowerCase(),
        phone: input.phone.trim(),
        source: input.source,
        // Everything starts in `new`. The board's SLA clock is the age of the
        // lead in its stage, so entering one further along would start it with
        // time already spent that nobody actually spent.
        stage: 'new' as const,
        ownerId: input.ownerId,
        createdDate: isoDate(NOW),
        estValue: input.estValue,
        interestedPlanId: input.interestedPlanId,
        note: input.note,
        lostReason: null,
      }

      await ctx.db.insert(leads).values(row)
      await recordEvent(ctx, {
        kind: 'lead.created',
        entityType: 'lead',
        entityId: id,
        summary: `${row.name} added from ${input.source}`,
        payload: { ownerId: input.ownerId, estValue: input.estValue },
      })

      return { id, name: row.name }
    }),

  /**
   * Add a note to a member.
   *
   * A pinned note is an instruction, not a comment — it is what the kiosk puts
   * in front of the desk before the door opens — so pinning is stored on the
   * note rather than inferred from its kind.
   */
  addMemberNote: publicProcedure
    .input(
      z.object({
        memberId: z.string().min(1),
        kind: z.enum(['note', 'call', 'injury', 'goal', 'complaint']),
        body: z.string().min(4).max(2000),
        pinned: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const m = await ctx.db.select().from(members).where(eq(members.id, input.memberId))
      if (!m[0]) refuse('NOT_FOUND', 'No member with that id.')

      const row = {
        id: `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        memberId: input.memberId,
        kind: input.kind,
        body: input.body.trim(),
        authorId: ctx.actor,
        timestamp: isoStamp(NOW),
        pinned: input.pinned,
      }

      await ctx.db.insert(memberNotes).values(row)
      await recordEvent(ctx, {
        kind: 'member.note-added',
        entityType: 'member',
        entityId: input.memberId,
        summary: `${input.kind} note on ${m[0].name}${input.pinned ? ' (pinned)' : ''}`,
      })

      return toMemberNote(row)
    }),

  setNotePinned: publicProcedure
    .input(z.object({ id: z.string().min(1), pinned: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(memberNotes).where(eq(memberNotes.id, input.id))
      if (!rows[0]) refuse('NOT_FOUND', 'That note no longer exists.')

      await ctx.db.update(memberNotes).set({ pinned: input.pinned }).where(eq(memberNotes.id, input.id))
      await recordEvent(ctx, {
        kind: input.pinned ? 'member.note-pinned' : 'member.note-unpinned',
        entityType: 'member',
        entityId: rows[0].memberId,
        summary: input.pinned ? 'Note pinned to check-in' : 'Note unpinned',
      })
      return { id: input.id, pinned: input.pinned }
    }),

  deleteMemberNote: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(memberNotes).where(eq(memberNotes.id, input.id))
      if (!rows[0]) refuse('NOT_FOUND', 'That note no longer exists.')

      await ctx.db.delete(memberNotes).where(eq(memberNotes.id, input.id))
      await recordEvent(ctx, {
        kind: 'member.note-deleted',
        entityType: 'member',
        entityId: rows[0].memberId,
        summary: `Deleted a ${rows[0].kind} note`,
        payload: { body: rows[0].body },
      })
      return { id: input.id }
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
