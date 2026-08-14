/**
 * Class bookings: take a seat, give it up, and move the waitlist along.
 *
 * The rules live in `server/domain/booking-rules.ts` as pure functions; this
 * file is only the part that talks to the database, so the interesting logic
 * can be read (and tested) without a D1 binding in scope.
 */
import { z } from 'zod'
import { and, asc, eq, sql } from 'drizzle-orm'
import { publicProcedure, recordEvent, refuse, router } from '../init'
import type { Db } from '../../db/client'
import { classSeats, classes, companies, members } from '../../db/schema'
import { toClass, toCompany, toMember, type SeatRow } from '../../domain/mappers'
import { bookingRefusal, consumesCredit, nextPromotion, seatKindFor } from '../../domain/booking-rules'
import { isoStamp, NOW } from '../../../lib/seed'

const REFUSAL_MESSAGE: Record<string, string> = {
  'class-not-found': 'That class no longer exists.',
  'member-not-found': 'That member no longer exists.',
  'membership-inactive': 'This membership is not active, so it cannot hold a seat.',
  'already-booked': 'This member already has a seat or a waitlist place in this class.',
  'no-credits': 'No class credits remaining on this membership.',
  'pool-exhausted': 'The corporate pool is out of credits.',
}

/** Loads everything the rules need to judge a booking. */
async function loadContext(db: Db, classId: string, memberId: string) {
  const [klassRows, memberRows, seatRows] = await Promise.all([
    db.select().from(classes).where(eq(classes.id, classId)),
    db.select().from(members).where(eq(members.id, memberId)),
    db.select().from(classSeats).where(eq(classSeats.classId, classId)).orderBy(asc(classSeats.position)),
  ])
  const memberRow = memberRows[0]
  const companyRows = memberRow?.companyId
    ? await db.select().from(companies).where(eq(companies.id, memberRow.companyId))
    : []

  const seats = seatRows as SeatRow[]
  return {
    klass: klassRows[0] ? toClass(klassRows[0], seats) : undefined,
    member: memberRow ? toMember(memberRow) : undefined,
    company: companyRows[0] ? toCompany(companyRows[0], []) : undefined,
    seats,
  }
}

export const bookingRouter = router({
  /**
   * Take a seat. Goes to the roster while there is room and to the waitlist
   * after that — the caller does not choose, so the two paths cannot disagree
   * about whether a class was full.
   */
  book: publicProcedure
    .input(z.object({ classId: z.string().min(1), memberId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx
      const { klass, member, company, seats } = await loadContext(db, input.classId, input.memberId)

      const refusal = bookingRefusal({
        member,
        klass,
        company,
        rosterIds: klass?.roster ?? [],
        waitlistIds: klass?.waitlist ?? [],
      })
      if (refusal) {
        refuse(refusal === 'class-not-found' || refusal === 'member-not-found' ? 'NOT_FOUND' : 'BAD_REQUEST',
          REFUSAL_MESSAGE[refusal])
      }
      // Narrowed by bookingRefusal returning null.
      const theClass = klass!
      const theMember = member!

      const rosterCount = theClass.roster.length
      const kind = seatKindFor(theClass, rosterCount)
      const position = kind === 'waitlist' ? theClass.waitlist.length : 0

      await db.insert(classSeats).values({
        classId: theClass.id,
        memberId: theMember.id,
        kind,
        position,
        bookedAt: isoStamp(NOW),
      })

      // A credit is spent on a confirmed seat only. Waitlisted members pay when
      // they are promoted, which is the moment they actually get to attend.
      if (kind === 'roster') await spendCredit(db, theMember.id, theMember.companyId)

      await recordEvent(ctx, {
        kind: kind === 'roster' ? 'class.booked' : 'class.waitlisted',
        entityType: 'class',
        entityId: theClass.id,
        summary: `${theMember.name} ${kind === 'roster' ? 'booked' : 'joined the waitlist for'} ${theClass.name}`,
        payload: { memberId: theMember.id, position },
      })

      void seats
      return { kind, position, classId: theClass.id, memberId: theMember.id }
    }),

  /**
   * Give up a seat. Freeing a roster place promotes the head of the waitlist
   * (spending their credit at that point), and the remaining waitlist is
   * renumbered so "3rd in line" stays true.
   */
  cancel: publicProcedure
    .input(z.object({ classId: z.string().min(1), memberId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx
      const { klass, member } = await loadContext(db, input.classId, input.memberId)
      if (!klass) refuse('NOT_FOUND', REFUSAL_MESSAGE['class-not-found'])
      if (!member) refuse('NOT_FOUND', REFUSAL_MESSAGE['member-not-found'])

      const wasOnRoster = klass!.roster.includes(input.memberId)
      const wasWaitlisted = klass!.waitlist.includes(input.memberId)
      if (!wasOnRoster && !wasWaitlisted) {
        refuse('BAD_REQUEST', 'This member does not hold a place in that class.')
      }

      await db
        .delete(classSeats)
        .where(and(eq(classSeats.classId, input.classId), eq(classSeats.memberId, input.memberId)))

      if (wasOnRoster) await refundCredit(db, member!.id, member!.companyId)

      let promoted: string | null = null
      const remainingWaitlist = klass!.waitlist.filter((id) => id !== input.memberId)

      if (wasOnRoster) {
        promoted = nextPromotion(remainingWaitlist)
        if (promoted) {
          await db
            .update(classSeats)
            .set({ kind: 'roster', position: 0 })
            .where(and(eq(classSeats.classId, input.classId), eq(classSeats.memberId, promoted)))
          const promotedRows = await db.select().from(members).where(eq(members.id, promoted))
          if (promotedRows[0]) await spendCredit(db, promoted, promotedRows[0].companyId)
        }
      }

      // Renumber whoever is left so positions stay dense.
      const stillWaiting = remainingWaitlist.filter((id) => id !== promoted)
      for (let i = 0; i < stillWaiting.length; i++) {
        await db
          .update(classSeats)
          .set({ position: i })
          .where(and(eq(classSeats.classId, input.classId), eq(classSeats.memberId, stillWaiting[i])))
      }

      await recordEvent(ctx, {
        kind: 'class.cancelled',
        entityType: 'class',
        entityId: input.classId,
        summary: `${member!.name} gave up a place in ${klass!.name}`,
        payload: { memberId: input.memberId, promoted },
      })

      return { promoted, freedRosterSeat: wasOnRoster }
    }),
})

/**
 * Spending a credit touches two places for a corporate member: their own
 * remaining balance and the employer's pool. `metric_credits_remaining` is null
 * on unlimited plans, and the guard is a type check rather than a truthiness
 * check so that a member on zero does not read as "unlimited".
 */
async function spendCredit(db: Db, memberId: string, companyId: string | null): Promise<void> {
  const rows = await db.select().from(members).where(eq(members.id, memberId))
  const member = rows[0] ? toMember(rows[0]) : undefined
  if (member && consumesCredit(member)) {
    await db
      .update(members)
      .set({ metricCreditsRemaining: sql`max(0, ${members.metricCreditsRemaining} - 1)` })
      .where(eq(members.id, memberId))
  }
  if (companyId) {
    await db
      .update(companies)
      .set({ creditsUsed: sql`${companies.creditsUsed} + 1` })
      .where(eq(companies.id, companyId))
  }
}

async function refundCredit(db: Db, memberId: string, companyId: string | null): Promise<void> {
  const rows = await db.select().from(members).where(eq(members.id, memberId))
  const member = rows[0] ? toMember(rows[0]) : undefined
  if (member && consumesCredit(member)) {
    await db
      .update(members)
      .set({ metricCreditsRemaining: sql`${members.metricCreditsRemaining} + 1` })
      .where(eq(members.id, memberId))
  }
  if (companyId) {
    await db
      .update(companies)
      .set({ creditsUsed: sql`max(0, ${companies.creditsUsed} - 1)` })
      .where(eq(companies.id, companyId))
  }
}
