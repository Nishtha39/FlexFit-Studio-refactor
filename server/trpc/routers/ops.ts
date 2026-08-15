/**
 * Front desk and back office: check-ins, membership state, corporate pools,
 * the plan catalogue and studio settings.
 */
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { publicProcedure, recordEvent, refuse, router } from '../init'
import { checkIns, classes, companies, locations, members, payments, plans, settings, staff } from '../../db/schema'
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

  /**
   * Activate or deactivate a staff member — the toggle on the trainers roster.
   *
   * `active` is not a free boolean: it is defined as "has no departure date",
   * and `lib/data/staff.ts` builds the seed that way. Writing one without the
   * other is how the roster ends up showing an active trainer whose row reads
   * "Left 21 Mar 2025", so both move together here.
   *
   * A departure does NOT reassign their classes or their clients. That is
   * deliberate: the trainer detail screen exists to show exactly that gap, and
   * the March 2025 attendance step-down in the seed is explained by a departing
   * trainer's classes going uncovered. Silently reassigning would erase the
   * evidence for a number the dashboard reports.
   */
  setStaffActive: publicProcedure
    .input(
      z.object({
        staffId: z.string().min(1),
        active: z.boolean(),
        /** Departure date; defaults to today. Ignored when reactivating. */
        activeTo: z.string().min(10).max(10).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(staff).where(eq(staff.id, input.staffId))
      if (!rows[0]) refuse('NOT_FOUND', 'No staff member with that id.')
      const before = rows[0]

      if (before.active === input.active) {
        refuse('BAD_REQUEST', `${before.name} is already ${input.active ? 'active' : 'inactive'}.`)
      }

      const activeTo = input.active ? null : (input.activeTo ?? isoDate(NOW))

      await ctx.db
        .update(staff)
        .set({ active: input.active, activeTo })
        .where(eq(staff.id, input.staffId))

      const openClasses = await ctx.db
        .select({ id: classes.id })
        .from(classes)
        .where(eq(classes.trainerId, input.staffId))
      const clients = await ctx.db
        .select({ id: members.id })
        .from(members)
        .where(eq(members.assignedTrainerId, input.staffId))

      await recordEvent(ctx, {
        kind: input.active ? 'staff.reactivated' : 'staff.deactivated',
        entityType: 'staff',
        entityId: input.staffId,
        summary: input.active
          ? `${before.name} returned to active`
          : `${before.name} marked inactive from ${activeTo}`,
        payload: {
          activeTo,
          classesStillAssigned: openClasses.length,
          clientsStillAssigned: clients.length,
        },
      })

      // Returned so the UI can warn about what is now uncovered rather than
      // letting it be discovered on the schedule next week.
      return {
        staffId: input.staffId,
        name: before.name,
        active: input.active,
        activeTo,
        classesStillAssigned: openClasses.length,
        clientsStillAssigned: clients.length,
      }
    }),

  /**
   * Take a payment at the desk. Appends to the ledger — the same append-only
   * rule the refund path follows, so gross/refunds/net still reconcile by
   * replay and there is no status column anywhere to disagree with the rows.
   *
   * The member's metrics are recomputed afterwards because lifetime value is
   * derived from this table; without it the profile would show a payment in the
   * list and an unchanged LTV above it.
   */
  takePayment: publicProcedure
    .input(
      z.object({
        memberId: z.string().min(1),
        amount: z.number().int().positive().max(10_000_000),
        method: z.enum(['card', 'cash', 'upi', 'transfer']),
        description: z.string().min(1).max(200),
        /** Null for an ad-hoc charge that is not against a plan. */
        planId: z.string().nullable().default(null),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(members).where(eq(members.id, input.memberId))
      if (!rows[0]) refuse('NOT_FOUND', 'No member with that id.')
      const member = toMember(rows[0])

      if (input.planId) {
        const plan = await ctx.db.select().from(plans).where(eq(plans.id, input.planId))
        if (!plan[0]) refuse('NOT_FOUND', 'No plan with that id.')
      }

      const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const payment = {
        id: `pay-${suffix}`,
        // A desk payment is its own single-row invoice; there is no invoice
        // table, so this id is simply what groups the row and any later reversal.
        invoiceId: `INV-${suffix.toUpperCase()}`,
        memberId: input.memberId,
        planId: input.planId,
        amount: input.amount,
        method: input.method,
        status: 'paid' as const,
        date: isoStamp(NOW),
        description: input.description,
        reversalOf: null,
      }

      await ctx.db.insert(payments).values(payment)
      await recomputeMemberMetrics(ctx.db, input.memberId)

      await recordEvent(ctx, {
        kind: 'payment.taken',
        entityType: 'payment',
        entityId: payment.id,
        summary: `Took ₹${input.amount} from ${member.name} by ${input.method}`,
        payload: { invoiceId: payment.invoiceId, memberId: input.memberId },
      })

      return payment
    }),

  /**
   * Create a member.
   *
   * Metrics start at zero rather than being left out: they are NOT NULL columns
   * that the directory sorts on and `computeRisk` reads, so a member without
   * them would break the very screen they are created from. `monthlyValue` is
   * the one that is not zero — it is what the plan is worth per month, which is
   * true from the moment they sign, and the MRR on the dashboard is the sum of
   * it. Everything visit-derived is genuinely zero until they come in.
   *
   * The id is minted here rather than accepted from the client so two desks
   * signing someone up at once cannot collide on it.
   */
  createMember: publicProcedure
    .input(
      z.object({
        firstName: z.string().min(1).max(60),
        lastName: z.string().min(1).max(60),
        email: z.string().email().max(160),
        phone: z.string().min(4).max(30),
        planId: z.string().min(1),
        homeLocation: z.enum(LOCATIONS),
        status: z.enum(['trial', 'active']).default('active'),
        assignedTrainerId: z.string().nullable().default(null),
        companyId: z.string().nullable().default(null),
        tags: z.array(z.string().max(30)).max(10).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const planRows = await ctx.db.select().from(plans).where(eq(plans.id, input.planId))
      if (!planRows[0]) refuse('NOT_FOUND', 'No plan with that id.')
      const plan = toPlan(planRows[0])
      if (!plan.active) refuse('BAD_REQUEST', `${plan.name} is closed to new members — pick a plan that is still sold.`)

      // A corporate-only plan without a company would count against no pool,
      // so the pool-health screen would under-report its own usage.
      if (plan.corporateOnly && !input.companyId) {
        refuse('BAD_REQUEST', `${plan.name} is a corporate plan — pick the company whose pool this member draws from.`)
      }

      if (input.companyId) {
        const co = await ctx.db.select().from(companies).where(eq(companies.id, input.companyId))
        if (!co[0]) refuse('NOT_FOUND', 'No company with that id.')
      }
      if (input.assignedTrainerId) {
        const t = await ctx.db.select().from(staff).where(eq(staff.id, input.assignedTrainerId))
        if (!t[0]) refuse('NOT_FOUND', 'No staff member with that id.')
      }

      const existing = await ctx.db
        .select({ id: members.id })
        .from(members)
        .where(eq(members.email, input.email.toLowerCase()))
      if (existing[0]) {
        refuse('CONFLICT', `${input.email} is already on ${existing[0].id}. Open that record instead of creating a second one.`)
      }

      const firstName = input.firstName.trim()
      const lastName = input.lastName.trim()
      const name = `${firstName} ${lastName}`
      const id = `m-new-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

      const monthlyValue =
        plan.interval === 'per-visit' ? plan.price : plan.interval === 'annual' ? Math.round(plan.price / 12) : plan.price

      const row = {
        id,
        firstName,
        lastName,
        name,
        initials: `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase(),
        email: input.email.toLowerCase(),
        phone: input.phone.trim(),
        status: input.status,
        planId: input.planId,
        homeLocation: input.homeLocation,
        assignedTrainerId: input.assignedTrainerId,
        companyId: input.companyId,
        joinedDate: isoDate(NOW),
        endDate: null,
        tags: input.tags,
        metricTenureMonths: 0,
        metricLastVisit: null,
        metricDaysSinceLastVisit: null,
        metricVisitsLast30: 0,
        metricVisitsPrev30: 0,
        metricAvgVisitsPerWeek: 0,
        metricPlanVisitsPerMonth: plan.visitsPerMonth,
        metricCreditsRemaining: plan.visitsPerMonth,
        metricFreezeCount: 0,
        metricCancelRate: 0,
        metricFailedPayments: 0,
        metricLifetimeValue: 0,
        // A member joining today has paid nothing before the ledger existed, so
        // every rupee they ever pay arrives as a payment row. See migration 0004.
        metricLifetimeBase: 0,
        metricMonthlyValue: monthlyValue,
      }

      await ctx.db.insert(members).values(row)
      await recordEvent(ctx, {
        kind: 'member.created',
        entityType: 'member',
        entityId: id,
        summary: `${name} joined on ${plan.name}`,
        payload: { planId: input.planId, homeLocation: input.homeLocation, status: input.status },
      })

      return { id, name }
    }),

  /**
   * Move a member onto a different plan.
   *
   * `monthlyValue` moves with it, because that is what the plan is worth — and
   * the MRR, the pool health and the churn-risk value all read it. The visit
   * allowance moves too; credits are re-based on the new allowance minus what
   * they have already used this month, so a downgrade cannot hand someone more
   * visits than the plan they just moved to allows.
   */
  setMemberPlan: publicProcedure
    .input(z.object({ memberId: z.string().min(1), planId: z.string().min(1), note: z.string().max(200).optional() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(members).where(eq(members.id, input.memberId))
      if (!rows[0]) refuse('NOT_FOUND', 'No member with that id.')
      const member = toMember(rows[0])

      const planRows = await ctx.db.select().from(plans).where(eq(plans.id, input.planId))
      if (!planRows[0]) refuse('NOT_FOUND', 'No plan with that id.')
      const plan = toPlan(planRows[0])

      if (member.planId === input.planId) {
        refuse('BAD_REQUEST', `${member.name} is already on ${plan.name}.`)
      }
      if (!plan.active) {
        refuse('BAD_REQUEST', `${plan.name} is closed — a member cannot be moved onto a plan that is no longer sold.`)
      }
      if (plan.corporateOnly && !member.companyId) {
        refuse('BAD_REQUEST', `${plan.name} is corporate-only and ${member.name} is not attached to a company.`)
      }

      const monthlyValue =
        plan.interval === 'per-visit'
          ? plan.price * Math.max(1, member.metrics.visitsLast30)
          : plan.interval === 'annual'
            ? Math.round(plan.price / 12)
            : plan.price

      const credits =
        plan.visitsPerMonth === null ? null : Math.max(0, plan.visitsPerMonth - member.metrics.visitsLast30)

      await ctx.db
        .update(members)
        .set({
          planId: input.planId,
          metricPlanVisitsPerMonth: plan.visitsPerMonth,
          metricCreditsRemaining: credits,
          metricMonthlyValue: monthlyValue,
        })
        .where(eq(members.id, input.memberId))

      await recordEvent(ctx, {
        kind: 'member.plan-changed',
        entityType: 'member',
        entityId: input.memberId,
        summary: `${member.name}: ${member.planId} → ${input.planId}`,
        payload: { from: member.planId, to: input.planId, note: input.note ?? null },
      })

      return { memberId: input.memberId, planId: input.planId, monthlyValue }
    }),

  /**
   * Replace a member's tags. Used one at a time from the profile and in bulk
   * from the directory — the bulk bar calls this once per selected member, so a
   * partial failure leaves the members it did reach correctly tagged rather
   * than rolling back work that succeeded.
   */
  setMemberTags: publicProcedure
    .input(z.object({ memberId: z.string().min(1), tags: z.array(z.string().max(30)).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(members).where(eq(members.id, input.memberId))
      if (!rows[0]) refuse('NOT_FOUND', 'No member with that id.')

      // Dedupe and drop blanks — a tag list is a set, and the filter bar counts
      // members per tag, so a duplicate would double-count one person.
      const tags = [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))]

      await ctx.db.update(members).set({ tags }).where(eq(members.id, input.memberId))
      await recordEvent(ctx, {
        kind: 'member.tags-set',
        entityType: 'member',
        entityId: input.memberId,
        summary: `Tags on ${rows[0].name}: ${tags.join(', ') || 'none'}`,
        payload: { tags },
      })
      return { memberId: input.memberId, tags }
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
   * this is the write that follows it.
   *
   * Every field the builder can edit is accepted. That is the point: the form
   * offers interval and perks, so dropping them here would publish a plan that
   * does not match the screen the operator just confirmed. `description` and
   * `corporateOnly` are optional because not every caller edits them — omitting
   * one keeps the stored value rather than blanking it.
   */
  savePlan: publicProcedure
    .input(
      z.object({
        planId: z.string().min(1),
        name: z.string().min(1).max(80),
        description: z.string().max(400).optional(),
        interval: z.enum(['per-visit', 'monthly', 'annual']).optional(),
        price: z.number().int().min(0),
        visitsPerMonth: z.number().int().positive().nullable(),
        corporateOnly: z.boolean().optional(),
        active: z.boolean(),
        perks: z.array(z.string().min(1).max(80)).max(12).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(plans).where(eq(plans.id, input.planId))
      if (!rows[0]) refuse('NOT_FOUND', 'No plan with that id.')
      const before = toPlan(rows[0])

      // A per-visit plan has no monthly allowance to spend, and an unlimited
      // plan has no credits to decrement — either combination would make the
      // kiosk turn people away for a limit the plan does not really have.
      if (input.interval === 'per-visit' && input.visitsPerMonth !== null) {
        refuse('BAD_REQUEST', 'A per-visit plan is billed each visit, so it cannot also carry a monthly visit allowance.')
      }

      await ctx.db
        .update(plans)
        .set({
          name: input.name,
          description: input.description ?? before.description,
          interval: input.interval ?? before.interval,
          price: input.price,
          visitsPerMonth: input.visitsPerMonth,
          corporateOnly: input.corporateOnly ?? before.corporateOnly,
          active: input.active,
          perks: input.perks ?? before.perks,
        })
        .where(eq(plans.id, input.planId))

      await recordEvent(ctx, {
        kind: 'plan.published',
        entityType: 'plan',
        entityId: input.planId,
        summary: `${before.name}: ₹${before.price} → ₹${input.price}`,
        payload: {
          before: {
            price: before.price,
            interval: before.interval,
            visitsPerMonth: before.visitsPerMonth,
            active: before.active,
            perks: before.perks,
          },
          after: input,
        },
      })

      return { planId: input.planId }
    }),

  /**
   * Rename a site or correct its timezone.
   *
   * The id is not editable and is not accepted here. It is a foreign key on
   * members, staff, classes, equipment and every check-in — changing it would
   * orphan all of them, and "rename this gym" never means "move everybody out
   * of it". Only the labels and the timezone can change.
   */
  saveLocation: publicProcedure
    .input(
      z.object({
        locationId: z.enum(LOCATIONS),
        name: z.string().min(1).max(80),
        shortName: z.string().min(1).max(30),
        timezone: z.string().min(1).max(60),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(locations).where(eq(locations.id, input.locationId))
      if (!rows[0]) refuse('NOT_FOUND', 'No location with that id.')

      await ctx.db
        .update(locations)
        .set({ name: input.name.trim(), shortName: input.shortName.trim(), timezone: input.timezone.trim() })
        .where(eq(locations.id, input.locationId))

      await recordEvent(ctx, {
        kind: 'location.updated',
        entityType: 'location',
        entityId: input.locationId,
        summary: `${rows[0].name} → ${input.name}`,
        payload: { before: rows[0], after: input },
      })

      return { locationId: input.locationId, name: input.name }
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
