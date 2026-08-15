// Equipment derivations.
//
// Every number the equipment screens show is defined here once, as a named
// formula, and nowhere else. That is deliberate: the same figure appears on the
// owner list, the asset detail, the trainer view and the reports, and the only
// way three screens cannot disagree is if they call the same function.
//
// `scripts/verify-numbers.mjs` re-derives each of these from the raw entities
// by a different route and fails if the two answers differ.

import {
  equipment,
  equipmentFaults,
  equipmentReservations,
  equipmentServices,
} from '@/lib/data/equipment'
import { memberById } from '@/lib/data/members'
import { locationById } from '@/lib/data'
import { NOW, addDays, daysBetween, isoDate } from '@/lib/seed'
import type {
  Equipment,
  EquipmentFault,
  EquipmentReservation,
  EquipmentService,
  EquipmentStatus,
  LocationId,
} from '@/lib/types'

export const STATUS_META: Record<
  EquipmentStatus,
  { label: string; tone: 'good' | 'warn' | 'danger' | 'neutral'; description: string }
> = {
  'in-service': { label: 'In service', tone: 'good', description: 'On the floor and usable.' },
  'needs-service': {
    label: 'Needs service',
    tone: 'warn',
    description: 'Still usable, but a service is due or a minor fault is open.',
  },
  'out-of-service': {
    label: 'Out of service',
    tone: 'danger',
    description: 'Taken off the floor. Does not count toward available capacity.',
  },
  retired: {
    label: 'Retired',
    tone: 'neutral',
    description: 'Disposed of. Kept on the register so historic spend still reconciles.',
  },
}

export const SEVERITY_META = {
  minor: { label: 'Minor', tone: 'neutral' as const, rank: 1 },
  major: { label: 'Major', tone: 'warn' as const, rank: 2 },
  unsafe: { label: 'Unsafe', tone: 'danger' as const, rank: 3 },
}

/** A retired asset is off the floor; everything else is part of the estate. */
export function isOnFloor(e: Equipment): boolean {
  return e.status !== 'retired'
}

/** Usable right now — what a member or trainer can actually walk up to. */
export function isAvailable(e: Equipment): boolean {
  return e.status === 'in-service' || e.status === 'needs-service'
}

// ---------------------------------------------------------------------------
// Formulas
// ---------------------------------------------------------------------------

/**
 * Next service date = last service + interval.
 * An asset never serviced falls back to its purchase date, because the interval
 * runs from when it went on the floor.
 */
export function nextServiceDate(e: Equipment): string {
  const from = new Date(`${e.lastServiceDate ?? e.purchaseDate}T00:00:00.000Z`)
  return isoDate(addDays(from, e.serviceIntervalDays))
}

/** Positive = overdue by that many days. Negative = that many days of slack. */
export function serviceOverdueDays(e: Equipment, now: Date = NOW): number {
  return daysBetween(new Date(`${nextServiceDate(e)}T00:00:00.000Z`), now)
}

export function isServiceOverdue(e: Equipment, now: Date = NOW): boolean {
  return isOnFloor(e) && serviceOverdueDays(e, now) > 0
}

/** Age of the asset in whole months, from purchase. */
export function ageMonths(e: Equipment, now: Date = NOW): number {
  return Math.max(0, Math.floor(daysBetween(new Date(`${e.purchaseDate}T00:00:00.000Z`), now) / 30.44))
}

/**
 * Straight-line depreciation to zero over `usefulLifeMonths`, no residual.
 *
 *   bookValue = unitCost × quantity × max(0, 1 − age/life)
 *
 * Held as a formula rather than a stored column so it cannot go stale, and
 * rounded once at the end so a total over many assets does not accumulate the
 * rounding error of each line.
 */
export function replacementCost(e: Equipment): number {
  return e.unitCost * e.quantity
}

export function bookValue(e: Equipment, now: Date = NOW): number {
  const life = Math.max(1, e.usefulLifeMonths)
  const remaining = Math.max(0, 1 - ageMonths(e, now) / life)
  return Math.round(replacementCost(e) * remaining)
}

/** Whole months until the asset is fully written down; 0 once it is. */
export function monthsToWriteOff(e: Equipment, now: Date = NOW): number {
  return Math.max(0, e.usefulLifeMonths - ageMonths(e, now))
}

/** Everything ever spent on this asset, purchase included (the install row). */
export function lifetimeSpend(e: Equipment): number {
  return servicesFor(e.id).reduce((sum, s) => sum + s.cost, 0)
}

/** Maintenance only — the install row is capital, not running cost. */
export function maintenanceSpend(e: Equipment): number {
  return servicesFor(e.id)
    .filter((s) => s.kind !== 'install')
    .reduce((sum, s) => sum + s.cost, 0)
}

/**
 * Running cost per unit per month since purchase. The denominator is clamped to
 * 1 so a machine installed this month does not report an infinite cost.
 */
export function monthlyRunningCost(e: Equipment, now: Date = NOW): number {
  const months = Math.max(1, ageMonths(e, now))
  return Math.round(maintenanceSpend(e) / months)
}

// ---------------------------------------------------------------------------
// Joins
// ---------------------------------------------------------------------------

export function faultsFor(equipmentId: string): EquipmentFault[] {
  return equipmentFaults.filter((f) => f.equipmentId === equipmentId)
}

export function openFaultsFor(equipmentId: string): EquipmentFault[] {
  return faultsFor(equipmentId).filter((f) => f.status !== 'resolved')
}

export function servicesFor(equipmentId: string): EquipmentService[] {
  return equipmentServices.filter((s) => s.equipmentId === equipmentId)
}

export function reservationsFor(equipmentId: string): EquipmentReservation[] {
  return equipmentReservations.filter((r) => r.equipmentId === equipmentId)
}

/** Live reservations only — a cancelled slot is free and must not read as taken. */
export function activeReservationsFor(equipmentId: string, date?: string): EquipmentReservation[] {
  return equipmentReservations.filter(
    (r) =>
      r.equipmentId === equipmentId &&
      r.status !== 'cancelled' &&
      (date === undefined || r.date === date),
  )
}

export function reservationsForMember(memberId: string): EquipmentReservation[] {
  return equipmentReservations
    .filter((r) => r.memberId === memberId && r.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
}

/** Upcoming for a member: today onward, still booked. */
export function upcomingReservations(memberId: string, now: Date = NOW): EquipmentReservation[] {
  const today = isoDate(now)
  return reservationsForMember(memberId).filter((r) => r.status === 'booked' && r.date >= today)
}

// ---------------------------------------------------------------------------
// Slots — the booking grid, and the rule that stops a double-booking
// ---------------------------------------------------------------------------

export const DAY_OPENS_MIN = 6 * 60 // 06:00
export const DAY_CLOSES_MIN = 22 * 60 // 22:00

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** Every slot start for one day, as "HH:MM". */
export function slotsForDay(e: Equipment): string[] {
  const out: string[] = []
  for (let m = DAY_OPENS_MIN; m + e.slotMinutes <= DAY_CLOSES_MIN; m += e.slotMinutes) {
    out.push(toTime(m))
  }
  return out
}

/**
 * How many of this asset's units are free in a given slot.
 *
 * Two reservations clash when they overlap in time on the same asset, and the
 * asset can absorb `quantity` of them at once — eight treadmills means eight
 * simultaneous bookings, one squash court means one. Overlap is a strict
 * interval test, not equality of start time, so a 45-minute booking correctly
 * blocks the 30-minute slot that starts inside it.
 */
export function unitsFreeAt(
  e: Equipment,
  date: string,
  startTime: string,
  durationMin = e.slotMinutes,
): number {
  const start = toMinutes(startTime)
  const end = start + durationMin
  const overlapping = activeReservationsFor(e.id, date).filter((r) => {
    const rStart = toMinutes(r.startTime)
    return rStart < end && rStart + r.durationMin > start
  })
  return Math.max(0, e.quantity - overlapping.length)
}

export function isSlotFree(e: Equipment, date: string, startTime: string): boolean {
  return unitsFreeAt(e, date, startTime) > 0
}

/**
 * Share of the day's slot-capacity taken on a date, 0..100.
 *   utilisation = booked slot-units / (slots per day × units)
 */
export function utilizationOn(e: Equipment, date: string): number {
  const capacity = slotsForDay(e).length * e.quantity
  if (capacity === 0) return 0
  return (activeReservationsFor(e.id, date).length / capacity) * 100
}

/** Mean utilisation across the trailing `days` days, ending today. */
export function utilizationTrailing(e: Equipment, days = 14, now: Date = NOW): number {
  if (!e.bookable) return 0
  let sum = 0
  for (let i = 1; i <= days; i++) sum += utilizationOn(e, isoDate(addDays(now, -i)))
  return sum / days
}

// ---------------------------------------------------------------------------
// Rows and roll-ups
// ---------------------------------------------------------------------------

export interface EquipmentRow {
  equipment: Equipment
  locationName: string
  openFaults: EquipmentFault[]
  worstSeverity: EquipmentFault['severity'] | null
  nextService: string
  overdueDays: number
  bookValue: number
  replacementCost: number
  maintenanceSpend: number
  monthlyRunningCost: number
  ageMonths: number
  utilization: number
}

export function toRow(e: Equipment): EquipmentRow {
  const open = openFaultsFor(e.id)
  const worst = open.reduce<EquipmentFault | null>(
    (worstSoFar, f) =>
      worstSoFar === null || SEVERITY_META[f.severity].rank > SEVERITY_META[worstSoFar.severity].rank
        ? f
        : worstSoFar,
    null,
  )
  return {
    equipment: e,
    locationName: locationById.get(e.location)?.shortName ?? e.location,
    openFaults: open,
    worstSeverity: worst?.severity ?? null,
    nextService: nextServiceDate(e),
    overdueDays: serviceOverdueDays(e),
    bookValue: bookValue(e),
    replacementCost: replacementCost(e),
    maintenanceSpend: maintenanceSpend(e),
    monthlyRunningCost: monthlyRunningCost(e),
    ageMonths: ageMonths(e),
    utilization: utilizationTrailing(e),
  }
}

export interface EstateSummary {
  assets: number
  units: number
  onFloor: number
  down: number
  overdue: number
  openFaults: number
  unsafeFaults: number
  bookValue: number
  replacementCost: number
  maintenance12m: number
  bookableAssets: number
  avgUtilization: number
}

/**
 * The estate roll-up. `units` counts physical machines, `assets` counts register
 * lines — eight treadmills are one asset and eight units, and the two are shown
 * separately because "how many things do we own" and "how many rows are on the
 * register" are different questions that people mix up.
 */
export function summarize(list: Equipment[], now: Date = NOW): EstateSummary {
  const onFloor = list.filter(isOnFloor)
  const bookable = onFloor.filter((e) => e.bookable)
  const cutoff = isoDate(addDays(now, -365))
  const ids = new Set(list.map((e) => e.id))

  const maintenance12m = equipmentServices
    .filter((s) => ids.has(s.equipmentId) && s.kind !== 'install' && s.date >= cutoff)
    .reduce((sum, s) => sum + s.cost, 0)

  const open = equipmentFaults.filter((f) => ids.has(f.equipmentId) && f.status !== 'resolved')

  return {
    assets: list.length,
    units: onFloor.reduce((sum, e) => sum + e.quantity, 0),
    onFloor: onFloor.length,
    down: list.filter((e) => e.status === 'out-of-service').length,
    overdue: onFloor.filter((e) => isServiceOverdue(e, now)).length,
    openFaults: open.length,
    unsafeFaults: open.filter((f) => f.severity === 'unsafe').length,
    bookValue: onFloor.reduce((sum, e) => sum + bookValue(e, now), 0),
    replacementCost: onFloor.reduce((sum, e) => sum + replacementCost(e), 0),
    maintenance12m,
    bookableAssets: bookable.length,
    avgUtilization:
      bookable.length === 0
        ? 0
        : bookable.reduce((sum, e) => sum + utilizationTrailing(e, 14, now), 0) / bookable.length,
  }
}

/** Owner's work queue: what to act on, worst first. */
export function serviceQueue(now: Date = NOW): EquipmentRow[] {
  return equipment
    .filter((e) => isOnFloor(e) && (isServiceOverdue(e, now) || openFaultsFor(e.id).length > 0))
    .map(toRow)
    .sort((a, b) => {
      const sev = (r: EquipmentRow) => (r.worstSeverity ? SEVERITY_META[r.worstSeverity].rank : 0)
      return sev(b) - sev(a) || b.overdueDays - a.overdueDays
    })
}

export function equipmentAt(location: LocationId | 'all'): Equipment[] {
  return location === 'all' ? equipment : equipment.filter((e) => e.location === location)
}

export function memberName(id: string): string {
  return memberById.get(id)?.name ?? id
}

export const EQUIPMENT_CATEGORIES = [
  'cardio',
  'strength',
  'free-weights',
  'functional',
  'recovery',
  'studio',
] as const
