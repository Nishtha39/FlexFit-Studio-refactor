/**
 * Member metrics are denormalised onto the member row (see schema.ts for why),
 * which means something has to keep them true. This is that something: it
 * recomputes the visit- and payment-derived fields from the source tables and
 * writes them back.
 *
 * Called after any write that can move them — a check-in, a booking, a failed
 * or refunded payment — so the directory's sorts and the churn-risk score are
 * always reading numbers that the underlying rows still support.
 *
 * The clock is `NOW` from lib/seed.ts, not the wall clock: the seeded history
 * ends at that instant, so counting "the last 30 days" from today would report
 * zero visits for every member the day after the data was generated.
 */
import { and, eq, gte, lt, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { checkIns, members, payments } from '../db/schema'
import { NOW, addDays, daysBetween, isoDate } from '../../lib/seed'

const DAY_MS = 24 * 60 * 60 * 1000

export async function recomputeMemberMetrics(db: Db, memberId: string): Promise<void> {
  const from30 = isoDate(addDays(NOW, -30))
  const from60 = isoDate(addDays(NOW, -60))
  const today = isoDate(NOW)

  const [visits, prevVisits, lastVisitRow, failed, lifetime] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(checkIns)
      .where(and(eq(checkIns.memberId, memberId), gte(checkIns.date, from30))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(checkIns)
      .where(and(eq(checkIns.memberId, memberId), gte(checkIns.date, from60), lt(checkIns.date, from30))),
    db
      .select({ date: sql<string>`max(${checkIns.date})` })
      .from(checkIns)
      .where(eq(checkIns.memberId, memberId)),
    db
      .select({ n: sql<number>`count(*)` })
      .from(payments)
      .where(and(eq(payments.memberId, memberId), eq(payments.status, 'failed'))),
    // Lifetime value replays the ledger: paid rows add, reversal rows are
    // already negative, so a plain sum is the net the member has actually paid.
    db
      .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .where(and(eq(payments.memberId, memberId), sql`${payments.status} != 'pending'`)),
  ])

  const visitsLast30 = Number(visits[0]?.n ?? 0)
  const visitsPrev30 = Number(prevVisits[0]?.n ?? 0)
  const lastVisit = lastVisitRow[0]?.date ?? null

  await db
    .update(members)
    .set({
      metricVisitsLast30: visitsLast30,
      metricVisitsPrev30: visitsPrev30,
      metricLastVisit: lastVisit,
      metricDaysSinceLastVisit: lastVisit ? daysBetween(new Date(lastVisit), NOW) : null,
      // Four weeks in the 30-day window, matching how the seed generator framed it.
      metricAvgVisitsPerWeek: Math.round((visitsLast30 / 30) * 7 * 10) / 10,
      metricFailedPayments: Number(failed[0]?.n ?? 0),
      metricLifetimeValue: Math.max(0, Number(lifetime[0]?.total ?? 0)),
    })
    .where(eq(members.id, memberId))

  void today
  void DAY_MS
}

/**
 * The heatmap is materialised (168 rows) rather than aggregated over ~37,000
 * check-ins per page load, because D1 bills rows scanned. Every new check-in
 * nudges exactly one cell.
 */
export async function bumpAttendanceAggregates(
  db: Db,
  opts: { weekday: number; hour: number; date: string },
): Promise<void> {
  await db.run(sql`
    UPDATE attendance_matrix SET count = count + 1
    WHERE weekday = ${opts.weekday} AND hour = ${opts.hour}
  `)
  await db.run(sql`
    INSERT INTO daily_attendance (date, count) VALUES (${opts.date}, 1)
    ON CONFLICT(date) DO UPDATE SET count = count + 1
  `)
}
