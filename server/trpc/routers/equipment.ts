/**
 * Equipment: the asset register, its fault log, its service history and member
 * reservations.
 *
 * Two things here are worth reading rather than skimming.
 *
 * **Faults drive status, status is not typed in by hand.** Whenever a fault is
 * filed or resolved, the asset's status is recomputed from the set of faults
 * still open (`statusForFaults`). An unsafe fault takes the machine off the
 * floor automatically. If status were a free field, a rig with an open "cable
 * frayed, do not use" report could sit there marked in-service because nobody
 * remembered the second step — and it would still be bookable.
 *
 * **A reservation is an interval, not a counter.** See
 * server/domain/equipment-rules.ts for why comparing start times is not enough.
 */
import { z } from 'zod'
import { and, eq, sql } from 'drizzle-orm'
import { publicProcedure, recordEvent, refuse, router } from '../init'
import type { Db } from '../../db/client'
import {
  equipment,
  equipmentFaults,
  equipmentReservations,
  equipmentServices,
  members,
  staff,
} from '../../db/schema'
import {
  toEquipment,
  toEquipmentReservation,
  toMember,
} from '../../domain/mappers'
import { reservationRefusal, statusForFaults } from '../../domain/equipment-rules'
import { NOW, isoDate, isoStamp } from '../../../lib/seed'

const LOCATIONS = ['downtown', 'riverside', 'north-loop'] as const
const CATEGORIES = ['cardio', 'strength', 'free-weights', 'functional', 'recovery', 'studio'] as const
const STATUSES = ['in-service', 'needs-service', 'out-of-service', 'retired'] as const
const SEVERITIES = ['minor', 'major', 'unsafe'] as const
const SERVICE_KINDS = ['routine', 'repair', 'inspection', 'install'] as const

const RESERVATION_MESSAGE: Record<string, string> = {
  'equipment-not-found': 'That equipment is not on the register.',
  'member-not-found': 'That member no longer exists.',
  'not-bookable': 'This equipment is not reservable — walk up and use it.',
  'equipment-unavailable': 'This equipment is off the floor and cannot be reserved.',
  'membership-inactive': 'This membership is not active, so it cannot hold a reservation.',
  'outside-hours': 'The studio is open 06:00–22:00.',
  'bad-slot': 'That start time is not one of this equipment’s slots.',
  'in-the-past': 'That slot has already passed.',
  'already-booked': 'This member already holds this equipment at that time.',
  'no-units-free': 'Every unit is taken for that slot.',
}

/**
 * Recompute an asset's status from the faults still open against it, and write
 * it. Called after every fault change so the two can never contradict.
 */
async function syncStatusToFaults(db: Db, equipmentId: string): Promise<void> {
  const rows = await db.select().from(equipment).where(eq(equipment.id, equipmentId))
  const asset = rows[0]
  if (!asset) return

  const open = await db
    .select({ severity: equipmentFaults.severity })
    .from(equipmentFaults)
    .where(and(eq(equipmentFaults.equipmentId, equipmentId), sql`${equipmentFaults.status} != 'resolved'`))

  const next = statusForFaults(
    asset.status,
    open.map((f) => f.severity),
  )
  if (next !== asset.status) {
    await db.update(equipment).set({ status: next }).where(eq(equipment.id, equipmentId))
  }
}

/** Who is filing this — staff or member. Used for the fault log's reporter name. */
async function resolveReporter(db: Db, id: string): Promise<{ id: string; name: string } | null> {
  const s = await db.select().from(staff).where(eq(staff.id, id))
  if (s[0]) return { id: s[0].id, name: s[0].name }
  const m = await db.select().from(members).where(eq(members.id, id))
  if (m[0]) return { id: m[0].id, name: m[0].name }
  return null
}

export const equipmentRouter = router({
  /**
   * Create or update an asset. The owner screen is the only caller; every field
   * it can edit is accepted and nothing else is, so a stray key cannot rewrite
   * an asset tag or a purchase price by accident.
   */
  save: publicProcedure
    .input(
      z.object({
        /** Omitted when creating — the id is minted here so two clients cannot collide. */
        id: z.string().min(1).optional(),
        name: z.string().min(1).max(80),
        category: z.enum(CATEGORIES),
        make: z.string().max(60),
        model: z.string().max(60),
        assetTag: z.string().min(1).max(24),
        location: z.enum(LOCATIONS),
        zone: z.string().min(1).max(60),
        quantity: z.number().int().min(1).max(500),
        purchaseDate: z.string().min(10).max(10),
        unitCost: z.number().int().min(0),
        usefulLifeMonths: z.number().int().min(1).max(600),
        serviceIntervalDays: z.number().int().min(1).max(1095),
        bookable: z.boolean(),
        slotMinutes: z.number().int().min(15).max(180),
        notes: z.string().max(500).default(''),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx

      if (input.id) {
        const rows = await db.select().from(equipment).where(eq(equipment.id, input.id))
        if (!rows[0]) refuse('NOT_FOUND', 'That equipment is not on the register.')
        const before = toEquipment(rows[0])

        // `status` is absent on purpose: it is owned by the fault log, not by
        // this form. Retiring is a separate procedure for the same reason.
        await db
          .update(equipment)
          .set({
            name: input.name,
            category: input.category,
            make: input.make,
            model: input.model,
            assetTag: input.assetTag,
            location: input.location,
            zone: input.zone,
            quantity: input.quantity,
            purchaseDate: input.purchaseDate,
            unitCost: input.unitCost,
            usefulLifeMonths: input.usefulLifeMonths,
            serviceIntervalDays: input.serviceIntervalDays,
            bookable: input.bookable,
            slotMinutes: input.slotMinutes,
            notes: input.notes,
          })
          .where(eq(equipment.id, input.id))

        await recordEvent(ctx, {
          kind: 'equipment.updated',
          entityType: 'equipment',
          entityId: input.id,
          summary: `${before.name} (${before.assetTag}) updated`,
          payload: { before: { name: before.name, quantity: before.quantity, unitCost: before.unitCost } },
        })
        return { id: input.id, created: false }
      }

      // Mint an id that cannot collide with the seeded `eq-NNN` range.
      const id = `eq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      await db.insert(equipment).values({
        id,
        ...input,
        status: 'in-service',
        lastServiceDate: null,
      })

      // The purchase becomes the `install` row, so lifetime spend on a new asset
      // is a plain SUM over equipment_services from the moment it is created.
      await db.insert(equipmentServices).values({
        id: `svc-${id}`,
        equipmentId: id,
        date: input.purchaseDate,
        kind: 'install',
        vendor: 'Supplier commissioning',
        cost: input.unitCost * input.quantity,
        note: `${input.quantity} × ${input.make} ${input.model} commissioned`,
      })

      await recordEvent(ctx, {
        kind: 'equipment.created',
        entityType: 'equipment',
        entityId: id,
        summary: `${input.name} (${input.assetTag}) added at ${input.location}`,
        payload: { quantity: input.quantity, unitCost: input.unitCost },
      })
      return { id, created: true }
    }),

  /**
   * Change status directly — take a machine off the floor, put it back, retire
   * it. Separate from `save` because it is the one field with a consequence:
   * an out-of-service asset stops absorbing reservations.
   */
  setStatus: publicProcedure
    .input(z.object({ id: z.string().min(1), status: z.enum(STATUSES), note: z.string().max(300).optional() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(equipment).where(eq(equipment.id, input.id))
      if (!rows[0]) refuse('NOT_FOUND', 'That equipment is not on the register.')
      const before = toEquipment(rows[0])

      await ctx.db.update(equipment).set({ status: input.status }).where(eq(equipment.id, input.id))

      // Taking an asset off the floor cancels the reservations it can no longer
      // honour. Leaving them would show members a booking against a machine that
      // is not there.
      let cancelled = 0
      if (input.status === 'out-of-service' || input.status === 'retired') {
        const affected = await ctx.db
          .update(equipmentReservations)
          .set({ status: 'cancelled' })
          .where(
            and(
              eq(equipmentReservations.equipmentId, input.id),
              eq(equipmentReservations.status, 'booked'),
              sql`${equipmentReservations.date} >= ${isoDate(NOW)}`,
            ),
          )
          .returning({ id: equipmentReservations.id })
        cancelled = affected.length
      }

      await recordEvent(ctx, {
        kind: 'equipment.status-changed',
        entityType: 'equipment',
        entityId: input.id,
        summary: `${before.name} (${before.assetTag}): ${before.status} → ${input.status}`,
        payload: { from: before.status, to: input.status, note: input.note ?? null, cancelledReservations: cancelled },
      })

      return { id: input.id, status: input.status, cancelledReservations: cancelled }
    }),

  /** Report a fault. Anyone on the floor can — trainer, front desk or member. */
  reportFault: publicProcedure
    .input(
      z.object({
        equipmentId: z.string().min(1),
        reportedBy: z.string().min(1),
        severity: z.enum(SEVERITIES),
        summary: z.string().min(3).max(300),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(equipment).where(eq(equipment.id, input.equipmentId))
      if (!rows[0]) refuse('NOT_FOUND', 'That equipment is not on the register.')
      const asset = toEquipment(rows[0])

      const reporter = await resolveReporter(ctx.db, input.reportedBy)
      if (!reporter) refuse('BAD_REQUEST', 'The reporter is neither a staff member nor a member.')

      const id = `fault-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      await ctx.db.insert(equipmentFaults).values({
        id,
        equipmentId: input.equipmentId,
        reportedBy: reporter!.id,
        reporterName: reporter!.name,
        reportedAt: isoStamp(NOW),
        severity: input.severity,
        summary: input.summary,
        status: 'open',
        resolvedAt: null,
        resolutionNote: null,
      })

      // An unsafe report takes the machine off the floor here, not in a second
      // step someone has to remember.
      await syncStatusToFaults(ctx.db, input.equipmentId)

      const after = await ctx.db.select().from(equipment).where(eq(equipment.id, input.equipmentId))
      const newStatus = after[0]?.status ?? asset.status

      let cancelled = 0
      if (newStatus === 'out-of-service') {
        const affected = await ctx.db
          .update(equipmentReservations)
          .set({ status: 'cancelled' })
          .where(
            and(
              eq(equipmentReservations.equipmentId, input.equipmentId),
              eq(equipmentReservations.status, 'booked'),
              sql`${equipmentReservations.date} >= ${isoDate(NOW)}`,
            ),
          )
          .returning({ id: equipmentReservations.id })
        cancelled = affected.length
      }

      await recordEvent(ctx, {
        kind: 'equipment.fault-reported',
        entityType: 'equipment',
        entityId: input.equipmentId,
        summary: `${input.severity} fault on ${asset.name} (${asset.assetTag}): ${input.summary}`,
        payload: { faultId: id, reportedBy: reporter!.id, statusAfter: newStatus },
      })

      return { id, status: newStatus, cancelledReservations: cancelled }
    }),

  /** Acknowledge or resolve a fault. Resolving may return the asset to service. */
  updateFault: publicProcedure
    .input(
      z.object({
        faultId: z.string().min(1),
        status: z.enum(['open', 'acknowledged', 'resolved']),
        resolutionNote: z.string().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(equipmentFaults).where(eq(equipmentFaults.id, input.faultId))
      if (!rows[0]) refuse('NOT_FOUND', 'That fault report no longer exists.')
      if (input.status === 'resolved' && !input.resolutionNote) {
        refuse('BAD_REQUEST', 'Say what fixed it — the service history is the point of the log.')
      }

      await ctx.db
        .update(equipmentFaults)
        .set({
          status: input.status,
          resolvedAt: input.status === 'resolved' ? isoStamp(NOW) : null,
          resolutionNote: input.status === 'resolved' ? (input.resolutionNote ?? null) : null,
        })
        .where(eq(equipmentFaults.id, input.faultId))

      await syncStatusToFaults(ctx.db, rows[0].equipmentId)

      await recordEvent(ctx, {
        kind: `equipment.fault-${input.status}`,
        entityType: 'equipment',
        entityId: rows[0].equipmentId,
        summary: `Fault ${input.faultId} marked ${input.status}`,
        payload: { note: input.resolutionNote ?? null },
      })

      return { faultId: input.faultId, status: input.status }
    }),

  /**
   * Log a service. This is the only thing that moves `lastServiceDate`, which is
   * what the next-service date and the overdue queue are derived from — so a
   * machine leaves the overdue list by being serviced, not by being edited.
   */
  logService: publicProcedure
    .input(
      z.object({
        equipmentId: z.string().min(1),
        kind: z.enum(SERVICE_KINDS),
        vendor: z.string().min(1).max(80),
        cost: z.number().int().min(0),
        note: z.string().max(300).default(''),
        date: z.string().min(10).max(10).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(equipment).where(eq(equipment.id, input.equipmentId))
      if (!rows[0]) refuse('NOT_FOUND', 'That equipment is not on the register.')
      const asset = toEquipment(rows[0])
      const date = input.date ?? isoDate(NOW)

      const id = `svc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      await ctx.db.insert(equipmentServices).values({
        id,
        equipmentId: input.equipmentId,
        date,
        kind: input.kind,
        vendor: input.vendor,
        cost: input.cost,
        note: input.note,
      })

      // An install row is the purchase, not a service — it must not reset the
      // maintenance clock, or a newly registered asset would look freshly
      // serviced when it has never been touched.
      if (input.kind !== 'install') {
        await ctx.db
          .update(equipment)
          .set({ lastServiceDate: date })
          .where(eq(equipment.id, input.equipmentId))
      }

      await recordEvent(ctx, {
        kind: 'equipment.serviced',
        entityType: 'equipment',
        entityId: input.equipmentId,
        summary: `${asset.name} (${asset.assetTag}) — ${input.kind} by ${input.vendor}`,
        payload: { serviceId: id, cost: input.cost, date },
      })

      return { id, equipmentId: input.equipmentId, date }
    }),

  /**
   * Member reserves a slot.
   *
   * The refusal check and the insert are separated so the reason a booking was
   * refused survives to the screen. The clash test itself is a pure function
   * shared with the browser, so the grid the member clicks and the check the
   * server runs are the same rule.
   */
  reserve: publicProcedure
    .input(
      z.object({
        equipmentId: z.string().min(1),
        memberId: z.string().min(1),
        date: z.string().min(10).max(10),
        startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be HH:MM.'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx
      const [assetRows, memberRows, existing] = await Promise.all([
        db.select().from(equipment).where(eq(equipment.id, input.equipmentId)),
        db.select().from(members).where(eq(members.id, input.memberId)),
        db
          .select()
          .from(equipmentReservations)
          .where(
            and(
              eq(equipmentReservations.equipmentId, input.equipmentId),
              eq(equipmentReservations.date, input.date),
            ),
          ),
      ])

      const asset = assetRows[0] ? toEquipment(assetRows[0]) : undefined
      const member = memberRows[0] ? toMember(memberRows[0]) : undefined
      const live = existing.map(toEquipmentReservation).filter((r) => r.status !== 'cancelled')

      const refusal = reservationRefusal({
        equipment: asset,
        member,
        date: input.date,
        startTime: input.startTime,
        existing: live,
        today: isoDate(NOW),
      })
      if (refusal) {
        refuse(
          refusal === 'equipment-not-found' || refusal === 'member-not-found' ? 'NOT_FOUND' : 'BAD_REQUEST',
          RESERVATION_MESSAGE[refusal],
        )
      }

      const id = `res-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      await db.insert(equipmentReservations).values({
        id,
        equipmentId: input.equipmentId,
        memberId: input.memberId,
        date: input.date,
        startTime: input.startTime,
        durationMin: asset!.slotMinutes,
        status: 'booked',
        createdAt: isoStamp(NOW),
      })

      await recordEvent(ctx, {
        kind: 'equipment.reserved',
        entityType: 'equipment',
        entityId: input.equipmentId,
        summary: `${member!.name} reserved ${asset!.name} on ${input.date} at ${input.startTime}`,
        payload: { reservationId: id, memberId: input.memberId },
      })

      return { id, equipmentId: input.equipmentId, date: input.date, startTime: input.startTime }
    }),

  /**
   * Give up a reservation. The row is marked cancelled rather than deleted:
   * utilisation history should show that the slot was taken and then released,
   * which is a different fact from the slot never having been booked.
   */
  cancelReservation: publicProcedure
    .input(z.object({ reservationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(equipmentReservations)
        .where(eq(equipmentReservations.id, input.reservationId))
      if (!rows[0]) refuse('NOT_FOUND', 'That reservation no longer exists.')
      if (rows[0].status === 'cancelled') refuse('BAD_REQUEST', 'That reservation is already cancelled.')

      await ctx.db
        .update(equipmentReservations)
        .set({ status: 'cancelled' })
        .where(eq(equipmentReservations.id, input.reservationId))

      await recordEvent(ctx, {
        kind: 'equipment.reservation-cancelled',
        entityType: 'equipment',
        entityId: rows[0].equipmentId,
        summary: `Reservation ${input.reservationId} cancelled`,
        payload: { memberId: rows[0].memberId, date: rows[0].date, startTime: rows[0].startTime },
      })

      return { reservationId: input.reservationId, status: 'cancelled' as const }
    }),
})
