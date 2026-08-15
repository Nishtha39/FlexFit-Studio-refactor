/**
 * Equipment rules — pure, no database, no React.
 *
 * The interesting one is the clash test. A class seat is a countable thing:
 * either there is a seat left or there is not. An equipment reservation is an
 * *interval*, and intervals collide in a way that counting cannot see — a
 * 45-minute reformer booking at 18:00 occupies the 18:30 slot even though no
 * reservation starts at 18:30. Comparing start times would let that through and
 * put two members on one machine.
 *
 * So the rule is: two reservations clash when their half-open intervals overlap,
 * and an asset can absorb `quantity` overlapping reservations at once (eight
 * treadmills take eight; one squash court takes one).
 *
 * The same overlap function backs `unitsFreeAt` in
 * components/equipment/equipment-data.ts, so the grid the member is looking at
 * and the check the server performs cannot disagree about what is free.
 */
import type { Equipment, EquipmentReservation, Member } from '../../lib/types'

export interface Interval {
  start: number
  end: number
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Half-open [start, end): a booking ending at 18:30 does not clash with one starting then. */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end
}

export const DAY_OPENS_MIN = 6 * 60
export const DAY_CLOSES_MIN = 22 * 60

export type ReservationRefusal =
  | 'equipment-not-found'
  | 'member-not-found'
  | 'not-bookable'
  | 'equipment-unavailable'
  | 'membership-inactive'
  | 'outside-hours'
  | 'bad-slot'
  | 'in-the-past'
  | 'already-booked'
  | 'no-units-free'

export interface ReservationRequest {
  equipment: Equipment | undefined
  member: Member | undefined
  date: string
  startTime: string
  /** Live reservations for this asset on this date (cancelled ones excluded). */
  existing: EquipmentReservation[]
  /** Today, as an ISO date — passed in so this stays a pure function. */
  today: string
}

/**
 * Returns the reason a reservation cannot be made, or null if it can.
 *
 * Written as "why not" rather than "is it allowed" so the caller can show the
 * member the actual reason. "That slot is taken" and "your membership is
 * frozen" are different problems and only one of them is fixed by picking a
 * different time.
 */
export function reservationRefusal(req: ReservationRequest): ReservationRefusal | null {
  const { equipment, member, date, startTime, existing, today } = req

  if (!equipment) return 'equipment-not-found'
  if (!member) return 'member-not-found'
  if (!equipment.bookable) return 'not-bookable'

  // A machine that is off the floor cannot be reserved. `needs-service` is
  // deliberately still bookable — it is flagged, not broken, and blocking it
  // would empty the schedule every time a service fell due.
  if (equipment.status === 'out-of-service' || equipment.status === 'retired') {
    return 'equipment-unavailable'
  }

  // Frozen is inactive here on purpose: a frozen membership has had billing
  // stopped, so it cannot hold a booking either.
  if (member.status !== 'active' && member.status !== 'trial') return 'membership-inactive'

  if (date < today) return 'in-the-past'

  const start = toMinutes(startTime)
  if (Number.isNaN(start)) return 'bad-slot'
  // Reservations must land on the asset's own slot grid, or the grid the member
  // is shown stops describing what is actually bookable.
  if ((start - DAY_OPENS_MIN) % equipment.slotMinutes !== 0) return 'bad-slot'
  const end = start + equipment.slotMinutes
  if (start < DAY_OPENS_MIN || end > DAY_CLOSES_MIN) return 'outside-hours'

  const slot: Interval = { start, end }
  const clashing = existing.filter((r) =>
    overlaps(slot, { start: toMinutes(r.startTime), end: toMinutes(r.startTime) + r.durationMin }),
  )

  // Someone holding the machine at that moment cannot take a second unit of it.
  if (clashing.some((r) => r.memberId === member.id)) return 'already-booked'

  if (clashing.length >= equipment.quantity) return 'no-units-free'

  return null
}

/** Units of an asset free during a slot, for the booking grid. */
export function unitsFree(
  equipment: Equipment,
  existing: EquipmentReservation[],
  startTime: string,
  durationMin = equipment.slotMinutes,
): number {
  const slot: Interval = { start: toMinutes(startTime), end: toMinutes(startTime) + durationMin }
  const taken = existing.filter((r) =>
    overlaps(slot, { start: toMinutes(r.startTime), end: toMinutes(r.startTime) + r.durationMin }),
  ).length
  return Math.max(0, equipment.quantity - taken)
}

/**
 * The status an asset should carry given its open faults.
 *
 * An unsafe fault takes the machine off the floor — that is not a judgement
 * call, and leaving it to whoever files the report is how a broken rig stays
 * bookable. A major or minor fault flags it for service but leaves it usable.
 * Retired is terminal and is never overridden here.
 */
export function statusForFaults(
  current: Equipment['status'],
  openSeverities: Array<'minor' | 'major' | 'unsafe'>,
): Equipment['status'] {
  if (current === 'retired') return 'retired'
  if (openSeverities.includes('unsafe')) return 'out-of-service'
  if (openSeverities.length > 0) return 'needs-service'
  // No open faults: an out-of-service asset comes back to the floor only when
  // the last fault is resolved, which is exactly this branch.
  return 'in-service'
}
