// Schedule engine — pure occurrence maths for the week grid.
//
// The data engine stores classes as weekly TEMPLATES (dayOfWeek + startTime).
// The schedule screen operates on OCCURRENCES: a template projected onto a real
// date. Every booking, cancellation and reschedule in Batch 6 is addressed by
// occurrence key, never by class id — "cancel Spin" is meaningless, "cancel
// Spin on Thu 20 Aug" is actionable.
//
// Everything is computed in UTC against the fixed NOW from lib/seed so the
// server and the browser render the same grid.

import type { ClassType, GymClass, ID, LocationId } from '@/lib/types'
import { classes } from '@/lib/data/classes'
import { getStaff } from '@/lib/data/staff'
import { NOW, addDays, isoDate, startOfDay } from '@/lib/seed'

/* -------------------------------------------------------------------------- */
/* Grid geometry                                                              */
/* -------------------------------------------------------------------------- */

/** The timetable never runs outside these hours, so the grid doesn't either. */
export const GRID_START_HOUR = 6
export const GRID_END_HOUR = 21
export const GRID_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60

/** 1 minute = 0.9px. A 30-minute Mobility slot is still 27px — tappable. */
export const PX_PER_MIN = 0.9
export const GRID_HEIGHT = GRID_MINUTES * PX_PER_MIN
/** Drop resolution for drag-to-reschedule — quarter-hour snapping. */
export const SLOT_MIN = 15

/** Snap a raw minute value from a pointer position onto the slot grid. */
export function snapMinutes(raw: number): number {
  const snapped = Math.round(raw / SLOT_MIN) * SLOT_MIN
  return Math.max(GRID_START_HOUR * 60, Math.min(GRID_END_HOUR * 60 - SLOT_MIN, snapped))
}

export function minutesFromMidnight(startTime: string): number {
  const [h, m] = startTime.split(':').map(Number)
  return h * 60 + m
}

export function toStartTime(minutes: number): string {
  const clamped = Math.max(GRID_START_HOUR * 60, Math.min(GRID_END_HOUR * 60 - 15, minutes))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

/** Pixel offset of a time inside the grid body. */
export function offsetFor(startTime: string): number {
  return (minutesFromMidnight(startTime) - GRID_START_HOUR * 60) * PX_PER_MIN
}

export const HOURS: number[] = Array.from(
  { length: GRID_END_HOUR - GRID_START_HOUR + 1 },
  (_, i) => GRID_START_HOUR + i,
)

/** "6am" / "12pm" / "7pm" — gutter labels, no minutes. */
export function hourLabel(hour: number): string {
  const suffix = hour < 12 ? 'am' : 'pm'
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h}${suffix}`
}

/* -------------------------------------------------------------------------- */
/* Slot labels                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Timetable labels are read in UTC on purpose.
 *
 * The data engine stores studio-local slots ("18:30") in UTC date fields, and
 * the grid positions every block from those same UTC minutes. Formatting the
 * label through the app's display timezone would shift the text off the
 * gridline it sits on — a 6:30pm block drawn at 18:30 but labelled midnight.
 * These three formatters keep the label, the position and the roster in
 * agreement, and they are the only time formatters the schedule uses.
 */
const slotTimeFmt = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'UTC',
})
const slotDateFmt = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

/** "6:30pm" — accepts a Date or a raw "HH:MM" slot string. */
export function slotClock(value: Date | string): string {
  const date =
    typeof value === 'string' ? occurrenceStart('2026-01-01', value) : value
  return slotTimeFmt.format(date).replace(/[\s\u202f\u00a0]/g, '').toLowerCase()
}

/** "Thu 13 Aug" */
export function slotDate(value: Date): string {
  return slotDateFmt.format(value)
}

/** "6:30pm, Thu 13 Aug" — the deadline form used in forfeit warnings. */
export function slotStamp(value: Date): string {
  return `${slotClock(value)}, ${slotDate(value)}`
}

/* -------------------------------------------------------------------------- */
/* Weeks                                                                      */
/* -------------------------------------------------------------------------- */

/** Monday 00:00 UTC of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date)
  const shift = (d.getUTCDay() + 6) % 7 // Mon = 0
  return addDays(d, -shift)
}

export const THIS_WEEK = startOfWeek(NOW)

export function weekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

/** Column index 0..6 (Mon..Sun) for a template's dayOfWeek (0 = Sunday). */
export function dayIndexFor(dayOfWeek: number): number {
  return (dayOfWeek + 6) % 7
}

/** Offset in whole weeks from the current week — drives "This week" labelling. */
export function weekOffset(weekStart: Date): number {
  return Math.round((weekStart.getTime() - THIS_WEEK.getTime()) / (7 * 86_400_000))
}

/* -------------------------------------------------------------------------- */
/* Occurrences                                                                */
/* -------------------------------------------------------------------------- */

export type OccurrenceState = 'past' | 'live' | 'upcoming'

export interface Occurrence {
  /** `${classId}@${YYYY-MM-DD}` — stable across renders and moves. */
  key: string
  classId: ID
  gymClass: GymClass
  /** Slot after any session moves have been applied. */
  isoDate: string
  startTime: string
  /** Where the template originally sat, when this occurrence has been moved. */
  originalIsoDate: string
  originalStartTime: string
  moved: boolean
  start: Date
  end: Date
  dayIndex: number
  startMin: number
  endMin: number
  durationMin: number
  state: OccurrenceState
  trainerName: string
}

export function occurrenceKey(classId: ID, iso: string): string {
  return `${classId}@${iso}`
}

export function occurrenceStart(iso: string, startTime: string): Date {
  return new Date(`${iso}T${startTime}:00.000Z`)
}

/* -------------------------------------------------------------------------- */
/* Session moves (drag-to-reschedule)                                         */
/* -------------------------------------------------------------------------- */

export type RecurrenceScope = 'one' | 'following' | 'all'

export interface ClassMove {
  id: string
  classId: ID
  scope: RecurrenceScope
  /** The occurrence date the move was performed from. */
  fromIso: string
  /** Target slot. */
  toIso: string
  toStartTime: string
}

/** Does this move govern the given template date? */
function moveApplies(move: ClassMove, iso: string): boolean {
  if (move.scope === 'all') return true
  if (move.scope === 'one') return iso === move.fromIso
  return iso >= move.fromIso
}

/**
 * Resolve a template date to its actual slot. Later moves win, so dragging the
 * same class twice behaves the way the staffer expects.
 */
function resolveSlot(
  gymClass: GymClass,
  iso: string,
  moves: ClassMove[],
): { iso: string; startTime: string } {
  let slot = { iso, startTime: gymClass.startTime }
  for (const move of moves) {
    if (move.classId !== gymClass.id) continue
    if (!moveApplies(move, iso)) continue
    // A "one" move carries its own date; recurring moves keep the weekday
    // shift relative to the template.
    if (move.scope === 'one') {
      slot = { iso: move.toIso, startTime: move.toStartTime }
    } else {
      const dayShift = Math.round(
        (occurrenceStart(move.toIso, '00:00').getTime() -
          occurrenceStart(move.fromIso, '00:00').getTime()) /
          86_400_000,
      )
      const shifted = addDays(occurrenceStart(iso, '00:00'), dayShift)
      slot = { iso: isoDate(shifted), startTime: move.toStartTime }
    }
  }
  return slot
}

export function buildOccurrence(
  gymClass: GymClass,
  templateIso: string,
  moves: ClassMove[] = [],
  now: Date = NOW,
): Occurrence {
  const slot = resolveSlot(gymClass, templateIso, moves)
  const start = occurrenceStart(slot.iso, slot.startTime)
  const end = new Date(start.getTime() + gymClass.durationMin * 60_000)
  const startMin = minutesFromMidnight(slot.startTime)
  const state: OccurrenceState =
    now.getTime() >= end.getTime() ? 'past' : now.getTime() >= start.getTime() ? 'live' : 'upcoming'

  return {
    key: occurrenceKey(gymClass.id, templateIso),
    classId: gymClass.id,
    gymClass,
    isoDate: slot.iso,
    startTime: slot.startTime,
    originalIsoDate: templateIso,
    originalStartTime: gymClass.startTime,
    moved: slot.iso !== templateIso || slot.startTime !== gymClass.startTime,
    start,
    end,
    dayIndex: (start.getUTCDay() + 6) % 7,
    startMin,
    endMin: startMin + gymClass.durationMin,
    durationMin: gymClass.durationMin,
    state,
    trainerName: getStaff(gymClass.trainerId)?.name ?? 'Unassigned',
  }
}

export interface ScheduleFilters {
  locations: LocationId[]
  types: ClassType[]
  trainerId: ID | null
  /** Hide anything already finished — on by default for front desk. */
  hidePast: boolean
}

export const EMPTY_FILTERS: ScheduleFilters = {
  locations: [],
  types: [],
  trainerId: null,
  hidePast: false,
}

export function matchesFilters(c: GymClass, f: ScheduleFilters): boolean {
  if (f.locations.length > 0 && !f.locations.includes(c.location)) return false
  if (f.types.length > 0 && !f.types.includes(c.type)) return false
  if (f.trainerId && c.trainerId !== f.trainerId) return false
  return true
}

/**
 * Every occurrence visible in the displayed week. Moves can push an occurrence
 * in from the previous week or out into the next one, so templates from the
 * neighbouring weeks are projected too and then filtered by resolved date.
 */
export function weekOccurrences(
  weekStart: Date,
  filters: ScheduleFilters = EMPTY_FILTERS,
  moves: ClassMove[] = [],
): Occurrence[] {
  const from = isoDate(weekStart)
  const to = isoDate(addDays(weekStart, 6))
  const out: Occurrence[] = []

  for (let w = -1; w <= 1; w++) {
    const base = addDays(weekStart, w * 7)
    for (const c of classes) {
      if (!matchesFilters(c, filters)) continue
      const templateDate = addDays(base, dayIndexFor(c.dayOfWeek))
      const occ = buildOccurrence(c, isoDate(templateDate), moves)
      if (occ.isoDate < from || occ.isoDate > to) continue
      if (filters.hidePast && occ.state === 'past') continue
      out.push(occ)
    }
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime())
}

export function occurrencesOnDay(occurrences: Occurrence[], iso: string): Occurrence[] {
  return occurrences.filter((o) => o.isoDate === iso)
}

/**
 * Overlap groups within a day column. Two 6:30 classes in different studios are
 * a real timetable, not a bug — the grid has to show both side by side.
 */
export function layoutDay(occurrences: Occurrence[]): Map<string, { lane: number; lanes: number }> {
  const sorted = [...occurrences].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const layout = new Map<string, { lane: number; lanes: number }>()
  let cluster: Occurrence[] = []
  let clusterEnd = -1

  const flush = () => {
    if (cluster.length === 0) return
    const laneEnds: number[] = []
    const assigned: { occ: Occurrence; lane: number }[] = []
    for (const occ of cluster) {
      let lane = laneEnds.findIndex((end) => end <= occ.startMin)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(occ.endMin)
      } else {
        laneEnds[lane] = occ.endMin
      }
      assigned.push({ occ, lane })
    }
    for (const { occ, lane } of assigned) {
      layout.set(occ.key, { lane, lanes: laneEnds.length })
    }
    cluster = []
    clusterEnd = -1
  }

  for (const occ of sorted) {
    if (cluster.length > 0 && occ.startMin >= clusterEnd) flush()
    cluster.push(occ)
    clusterEnd = Math.max(clusterEnd, occ.endMin)
  }
  flush()

  return layout
}

/* -------------------------------------------------------------------------- */
/* Conflicts                                                                  */
/* -------------------------------------------------------------------------- */

export interface Conflict {
  kind: 'trainer' | 'window'
  label: string
  detail: string
}

/** What breaks if `occ` moves to `toIso` / `toStartTime`. */
export function conflictsForMove(
  occ: Occurrence,
  toIso: string,
  toStartTime: string,
  all: Occurrence[],
): Conflict[] {
  const start = minutesFromMidnight(toStartTime)
  const end = start + occ.durationMin
  const out: Conflict[] = []

  if (end > GRID_END_HOUR * 60) {
    out.push({
      kind: 'window',
      label: 'Runs past closing',
      detail: `The studio closes at ${hourLabel(GRID_END_HOUR)} and this ${occ.durationMin}-minute class would still be running.`,
    })
  }

  const clash = all.find(
    (other) =>
      other.key !== occ.key &&
      other.isoDate === toIso &&
      other.gymClass.trainerId === occ.gymClass.trainerId &&
      start < other.endMin &&
      end > other.startMin,
  )
  if (clash) {
    out.push({
      kind: 'trainer',
      label: `${occ.trainerName} is already teaching`,
      detail: `${clash.gymClass.name} overlaps this slot. One of the two needs a different trainer.`,
    })
  }

  return out
}

/* -------------------------------------------------------------------------- */
/* Pressure                                                                   */
/* -------------------------------------------------------------------------- */

export type Pressure = 'full' | 'tight' | 'healthy' | 'sparse'

export function pressureFor(filled: number, capacity: number): Pressure {
  if (filled >= capacity) return 'full'
  if (filled / capacity >= 0.8) return 'tight'
  if (filled / capacity <= 0.25) return 'sparse'
  return 'healthy'
}

export const PRESSURE_META: Record<Pressure, { tone: 'danger' | 'warn' | 'good' | 'neutral'; label: string }> = {
  full: { tone: 'danger', label: 'Full' },
  tight: { tone: 'warn', label: 'Nearly full' },
  healthy: { tone: 'good', label: 'Space' },
  sparse: { tone: 'neutral', label: 'Under-booked' },
}

export const CLASS_TYPES: ClassType[] = [
  'Strength',
  'HIIT',
  'Yoga',
  'Spin',
  'Pilates',
  'Boxing',
  'Mobility',
  'CrossFit',
]
