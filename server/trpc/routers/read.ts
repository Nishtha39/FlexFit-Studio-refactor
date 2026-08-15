/**
 * Reads. One `bootstrap` call returns everything a screen can derive from, plus
 * a few per-entity queries for data too large to ship up front.
 *
 * Why one big call instead of a query per screen: `components/**\/*-data.ts`
 * derive invoices, dunning ladders, pool health, cohorts and all twelve reports
 * from the *whole* dataset — that is the convention MERGE-NOTES sets, and it is
 * a good one, because the derivations stay next to the screen that explains
 * them. Those derivations need the entities, not a pre-chewed answer, so the
 * API's job is to hand over the entities faithfully.
 *
 * The one thing bootstrap does NOT ship is the ~37,000 check-in rows. They are
 * ~4 MB of JSON, and no screen needs them all: the dashboard needs the 168-cell
 * hour x weekday matrix, the reports need daily totals, and a member profile
 * needs that member's own visits. All three are served in the shape they are
 * consumed in.
 */
import { z } from 'zod'
import { desc, eq, inArray, sql } from 'drizzle-orm'
import { publicProcedure, router } from '../init'
import {
  attendanceMatrix,
  checkIns,
  classMoves,
  classSeats,
  classes,
  companies,
  dailyAttendance,
  equipment,
  equipmentFaults,
  equipmentReservations,
  equipmentServices,
  leads,
  locations,
  memberNotes,
  members,
  notifications,
  payments,
  plans,
  settings,
  staff,
  workItems,
} from '../../db/schema'
import {
  toClass,
  toCompany,
  toEquipment,
  toEquipmentFault,
  toEquipmentReservation,
  toEquipmentService,
  toLead,
  toMember,
  toMemberNote,
  toNotification,
  toPayment,
  toPlan,
  toStaff,
  toWorkItem,
  type SeatRow,
} from '../../domain/mappers'

export const readRouter = router({
  /** Everything the client hydrates `lib/data/*` from, in one round trip. */
  bootstrap: publicProcedure.query(async ({ ctx }) => {
    const { db } = ctx

    const [
      locationRows,
      planRows,
      staffRows,
      companyRows,
      memberRows,
      classRows,
      seatRows,
      paymentRows,
      leadRows,
      notificationRows,
      dailyRows,
      matrixRows,
      settingRows,
      recentRows,
      equipmentRows,
      faultRows,
      serviceRows,
      reservationRows,
      noteRows,
      workItemRows,
      moveRows,
    ] = await Promise.all([
      db.select().from(locations),
      db.select().from(plans),
      db.select().from(staff),
      db.select().from(companies),
      db.select().from(members),
      db.select().from(classes),
      db.select().from(classSeats),
      db.select().from(payments),
      db.select().from(leads),
      db.select().from(notifications),
      db.select().from(dailyAttendance).orderBy(dailyAttendance.date),
      db.select().from(attendanceMatrix),
      db.select().from(settings),
      // The kiosk shows a short "recently checked in" strip; 200 rows covers it
      // without shipping the archive.
      db.select().from(checkIns).orderBy(desc(checkIns.timestamp)).limit(200),
      // Equipment ships whole. The register is ~50 rows and its fault/service
      // logs are small; the screens cross-reference all four (an asset's status
      // is only explicable next to its open faults), so splitting them into
      // per-screen queries would cost more round trips than it saves bytes.
      db.select().from(equipment),
      db.select().from(equipmentFaults).orderBy(desc(equipmentFaults.reportedAt)),
      db.select().from(equipmentServices).orderBy(desc(equipmentServices.date)),
      db.select().from(equipmentReservations),
      // Notes are ~900 rows of short text. The profile screen needs one
      // member's, but the overview card and the kiosk both need pinned notes
      // across members, so they ship whole rather than per-member.
      db.select().from(memberNotes).orderBy(desc(memberNotes.timestamp)),
      // Only rows somebody has acted on exist at all, so this stays small.
      db.select().from(workItems),
      // Reschedules, oldest first — the engine applies them in order and lets
      // the last one win.
      db.select().from(classMoves).orderBy(classMoves.createdAt),
    ])

    const seats = seatRows as unknown as SeatRow[]

    // employeeMemberIds is derived from members.company_id rather than stored —
    // the seed's two copies were verified identical, so this cannot lose anyone.
    const employeesByCompany = new Map<string, string[]>()
    for (const m of memberRows) {
      if (!m.companyId) continue
      const list = employeesByCompany.get(m.companyId) ?? []
      list.push(m.id)
      employeesByCompany.set(m.companyId, list)
    }

    // The heatmap is [weekday][hour], the shape hourWeekdayMatrix() returned.
    const heatmap: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))
    for (const cell of matrixRows) heatmap[cell.weekday][cell.hour] = cell.count

    return {
      locations: locationRows,
      plans: planRows.map(toPlan),
      staff: staffRows.map(toStaff),
      companies: companyRows.map((c) => toCompany(c, employeesByCompany.get(c.id) ?? [])),
      members: memberRows.map(toMember),
      classes: classRows.map((c) => toClass(c, seats)),
      payments: paymentRows.map(toPayment),
      leads: leadRows.map(toLead),
      notifications: notificationRows.map(toNotification),
      dailyAttendance: dailyRows,
      attendanceMatrix: heatmap,
      recentCheckIns: recentRows,
      equipment: equipmentRows.map(toEquipment),
      equipmentFaults: faultRows.map(toEquipmentFault),
      equipmentServices: serviceRows.map(toEquipmentService),
      equipmentReservations: reservationRows.map(toEquipmentReservation),
      memberNotes: noteRows.map(toMemberNote),
      workItems: workItemRows.map(toWorkItem),
      classMoves: moveRows.map((m) => ({
        id: m.id,
        classId: m.classId,
        scope: m.scope,
        fromIso: m.fromIso,
        toIso: m.toIso,
        toStartTime: m.toStartTime,
      })),
      settings: Object.fromEntries(settingRows.map((s) => [s.key, s.value])),
    }
  }),

  /**
   * COUNT(*) over check_ins. Exists so the materialised heatmap can be checked
   * against its source table: the two are maintained separately, and a counter
   * that silently stops agreeing with the rows it summarises is the failure mode
   * that made materialising it worth doing in the first place.
   */
  checkInCount: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.select({ total: sql<number>`count(*)` }).from(checkIns)
    return { total: Number(rows[0]?.total ?? 0) }
  }),

  /** A single member's visit history — loaded when a profile opens, not before. */
  memberCheckIns: publicProcedure
    .input(z.object({ memberId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(checkIns)
        .where(eq(checkIns.memberId, input.memberId))
        .orderBy(desc(checkIns.timestamp))
    }),

  /** Visit history for several members at once (the intervention queue). */
  checkInsForMembers: publicProcedure
    .input(z.object({ memberIds: z.array(z.string()).min(1).max(50) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.select().from(checkIns).where(inArray(checkIns.memberId, input.memberIds))
    }),
})
