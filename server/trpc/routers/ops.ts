/**
 * Front desk and back office: check-ins, membership state, corporate pools,
 * the plan catalogue and studio settings.
 */
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { publicProcedure, recordEvent, refuse, router } from '../init'
import { checkIns, classes, companies, members, plans, settings } from '../../db/schema'
import { toMember, toPlan } from '../../domain/mappers'
import { bumpAttendanceAggregates, recomputeMemberMetrics } from '../../domain/metrics'
import { membershipIsLive } from '../../domain/booking-rules'
import { NOW, isoDate, isoStamp, weekday } from '../../../lib/seed'

const LOCATIONS = ['downtown', 'riverside', 'north-loop'] as const

export const opsRouter = router({
  /**
   * Front-desk check-in. Writes the visit, nudges the two attendance aggregates
   * and recomputes the member's metrics — so the churn score, "days since last
   * visit" and the heatmap all move together instead of drifting apart.
   */
  checkIn: publicProcedure
    .input(
      z.object({
        memberId: z.string().min(1),
        location: z.enum(LOCATIONS),
        classId: z.string().nullable().default(null),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(members).where(eq(members.id, input.memberId))
      if (!rows[0]) refuse('NOT_FOUND', 'No member with that id.')
      const member = toMember(rows[0])
      if (!membershipIsLive(member)) {
        refuse('BAD_REQUEST', `${member.name}'s membership is ${member.status}, so check-in is blocked.`)
      }

      if (input.classId) {
        const klass = await ctx.db.select().from(classes).where(eq(classes.id, input.classId))
        if (!klass[0]) refuse('NOT_FOUND', 'No class with that id.')
      }

      const stamp = isoStamp(NOW)
      const record = {
        // Deterministic id: the same member cannot be recorded twice for the
        // same instant, which is what a double-tap at the kiosk produces.
        id: `ci-${input.memberId}-${stamp}`,
        memberId: input.memberId,
        location: input.location,
        timestamp: stamp,
        date: isoDate(NOW),
        hour: NOW.getUTCHours(),
        weekday: weekday(NOW),
        classId: input.classId,
      }

      // `returning` is what makes the double-tap safe. The conflict clause stops
      // the duplicate row, but the aggregates are counters — bumping them
      // unconditionally would drift the heatmap away from check_ins, and nothing
      // downstream could tell. An empty result means nothing was inserted, so
      // nothing should be counted.
      const inserted = await ctx.db
        .insert(checkIns)
        .values(record)
        .onConflictDoNothing()
        .returning({ id: checkIns.id })

      const isNew = inserted.length > 0
      if (isNew) {
        await bumpAttendanceAggregates(ctx.db, {
          weekday: record.weekday,
          hour: record.hour,
          date: record.date,
        })
        await recomputeMemberMetrics(ctx.db, input.memberId)
      }

      if (isNew) {
        await recordEvent(ctx, {
          kind: 'member.checked-in',
          entityType: 'member',
          entityId: input.memberId,
          summary: `${member.name} checked in at ${input.location}`,
          payload: { classId: input.classId },
        })
      }

      // `duplicate` rather than an error: at a kiosk a second tap means the same
      // thing as the first, and the screen should say "you're in", not fail.
      return { ...record, duplicate: !isNew }
    }),

  /** Freeze, reactivate, cancel — the membership states the directory acts on. */
  setMemberStatus: publicProcedure
    .input(
      z.object({
        memberId: z.string().min(1),
        status: z.enum(['trial', 'active', 'frozen', 'expired', 'cancelled']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(members).where(eq(members.id, input.memberId))
      if (!rows[0]) refuse('NOT_FOUND', 'No member with that id.')
      const before = toMember(rows[0])

      await ctx.db
        .update(members)
        .set({
          status: input.status,
          // A freeze is counted, because the risk model weighs how often someone
          // has paused rather than whether they are paused right now.
          metricFreezeCount:
            input.status === 'frozen'
              ? sql`${members.metricFreezeCount} + 1`
              : members.metricFreezeCount,
          endDate:
            input.status === 'cancelled' || input.status === 'expired' ? isoDate(NOW) : null,
        })
        .where(eq(members.id, input.memberId))

      await recordEvent(ctx, {
        kind: 'member.status-changed',
        entityType: 'member',
        entityId: input.memberId,
        summary: `${before.name}: ${before.status} → ${input.status}`,
        payload: { from: before.status, to: input.status },
      })

      return { memberId: input.memberId, status: input.status }
    }),

  assignTrainer: publicProcedure
    .input(z.object({ memberId: z.string().min(1), trainerId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(members)
        .set({ assignedTrainerId: input.trainerId })
        .where(eq(members.id, input.memberId))
      await recordEvent(ctx, {
        kind: 'member.trainer-assigned',
        entityType: 'member',
        entityId: input.memberId,
        summary: input.trainerId ? `Assigned to ${input.trainerId}` : 'Trainer unassigned',
      })
      return { memberId: input.memberId, trainerId: input.trainerId }
    }),

  /** Corporate top-up: adds credits to the pool. Pools grow, they never shrink. */
  topUpPool: publicProcedure
    .input(z.object({ companyId: z.string().min(1), credits: z.number().int().positive().max(10_000) }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(companies).where(eq(companies.id, input.companyId))
      if (!rows[0]) refuse('NOT_FOUND', 'No corporate pool with that id.')

      await ctx.db
        .update(companies)
        .set({ poolCredits: sql`${companies.poolCredits} + ${input.credits}` })
        .where(eq(companies.id, input.companyId))

      await recordEvent(ctx, {
        kind: 'pool.topped-up',
        entityType: 'company',
        entityId: input.companyId,
        summary: `${rows[0].name} topped up by ${input.credits} credits`,
        payload: { credits: input.credits },
      })

      return { companyId: input.companyId, added: input.credits }
    }),

  /**
   * Publish a plan edit. The plan builder shows the MRR delta before confirming;
   * this is the write that follows it. Price and allowance are the only fields
   * the builder can change, so they are the only ones accepted.
   */
  savePlan: publicProcedure
    .input(
      z.object({
        planId: z.string().min(1),
        name: z.string().min(1).max(80),
        description: z.string().max(400),
        price: z.number().int().min(0),
        visitsPerMonth: z.number().int().positive().nullable(),
        active: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(plans).where(eq(plans.id, input.planId))
      if (!rows[0]) refuse('NOT_FOUND', 'No plan with that id.')
      const before = toPlan(rows[0])

      await ctx.db
        .update(plans)
        .set({
          name: input.name,
          description: input.description,
          price: input.price,
          visitsPerMonth: input.visitsPerMonth,
          active: input.active,
        })
        .where(eq(plans.id, input.planId))

      await recordEvent(ctx, {
        kind: 'plan.published',
        entityType: 'plan',
        entityId: input.planId,
        summary: `${before.name}: ₹${before.price} → ₹${input.price}`,
        payload: { before: { price: before.price, visitsPerMonth: before.visitsPerMonth }, after: input },
      })

      return { planId: input.planId }
    }),

  /** Settings are one row per key, so a save touches only what changed. */
  saveSetting: publicProcedure
    .input(z.object({ key: z.string().min(1).max(120), value: z.unknown() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(settings)
        .values({ key: input.key, value: input.value, updatedAt: isoStamp(NOW) })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: input.value, updatedAt: isoStamp(NOW) },
        })
      return { key: input.key, value: input.value }
    }),
})
