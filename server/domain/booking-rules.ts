/**
 * Pure booking rules — capacity, credits and waitlist order — with no database
 * access, so they can be unit-tested and reused from the UI for the optimistic
 * pass without a second implementation drifting away from the real one.
 *
 * The database enforces what a pure function cannot: `class_seats` has a
 * composite primary key on (class_id, member_id), so "book the same class
 * twice" is rejected by the storage engine even if two requests race past the
 * check below.
 */
import type { Company, GymClass, Member } from '../../lib/types'

export type BookingRefusal =
  | 'class-not-found'
  | 'member-not-found'
  | 'membership-inactive'
  | 'already-booked'
  | 'no-credits'
  | 'pool-exhausted'

export interface BookingContext {
  member: Member | undefined
  klass: GymClass | undefined
  company: Company | undefined
  /** Roster + waitlist ids for the class, as stored. */
  rosterIds: string[]
  waitlistIds: string[]
}

/** A member can hold a seat only while their membership is live. */
export function membershipIsLive(member: Member): boolean {
  return member.status === 'active' || member.status === 'trial'
}

/**
 * Does this booking consume a credit? Unlimited plans carry
 * `creditsRemaining === null`, and the seed uses that same null to mean "not
 * applicable" — so the check is for a number, not for truthiness. A member on 0
 * credits would otherwise book free forever.
 */
export function consumesCredit(member: Member): boolean {
  return typeof member.metrics.creditsRemaining === 'number'
}

export function bookingRefusal(ctx: BookingContext): BookingRefusal | null {
  const { member, klass, company, rosterIds, waitlistIds } = ctx
  if (!klass) return 'class-not-found'
  if (!member) return 'member-not-found'
  if (!membershipIsLive(member)) return 'membership-inactive'
  if (rosterIds.includes(member.id) || waitlistIds.includes(member.id)) return 'already-booked'
  if (consumesCredit(member) && (member.metrics.creditsRemaining ?? 0) <= 0) return 'no-credits'
  // A corporate member spends the employer's pool, not their own wallet; an
  // exhausted pool is why employees "get turned away at the door".
  if (company && company.creditsUsed >= company.poolCredits) return 'pool-exhausted'
  return null
}

/** Seats go to the roster while there is room, and to the waitlist after that. */
export function seatKindFor(klass: GymClass, rosterCount: number): 'roster' | 'waitlist' {
  return rosterCount < klass.capacity ? 'roster' : 'waitlist'
}

export function isFull(klass: GymClass, rosterCount: number): boolean {
  return rosterCount >= klass.capacity
}

/**
 * Waitlist positions after removing one member: the survivors keep their
 * relative order and are renumbered from 0, so position is always dense and
 * "you are 3rd in line" stays true when the 1st person cancels.
 */
export function compactWaitlist(waitlistIds: string[], removedId?: string): { memberId: string; position: number }[] {
  return waitlistIds
    .filter((id) => id !== removedId)
    .map((memberId, position) => ({ memberId, position }))
}

/** Who moves up when a roster seat is freed — the head of the waitlist, or nobody. */
export function nextPromotion(waitlistIds: string[]): string | null {
  return waitlistIds[0] ?? null
}
