/**
 * SANDBOX FIXTURE — do not copy into FlexFit-Studio-refactor.
 *
 * The repo's `lib/data/classes.ts` exports `classes`, `classById`, `getClass`,
 * `classesForDay` and `isFull` from a generated week. Same names, same shapes,
 * so `app/(app)/schedule/[id]/page.tsx` needs no edit when it lands there.
 */

import type { GymClass, ClassType } from '@/lib/v2/types'

interface Seed {
  name: string
  type: ClassType
  trainerId: string
  dayOfWeek: number
  startTime: string
  durationMin: number
  capacity: number
  /** How many roster spots to fill; > capacity spills into the waitlist. */
  booked: number
}

const seeds: Seed[] = [
  { name: 'Sunrise Strength', type: 'Strength', trainerId: 's-01', dayOfWeek: 1, startTime: '06:30', durationMin: 60, capacity: 12, booked: 12 },
  { name: 'Metcon Engine', type: 'HIIT', trainerId: 's-02', dayOfWeek: 1, startTime: '18:00', durationMin: 45, capacity: 16, booked: 19 },
  { name: 'Slow Flow Yoga', type: 'Yoga', trainerId: 's-03', dayOfWeek: 2, startTime: '07:30', durationMin: 60, capacity: 14, booked: 9 },
  { name: 'Threshold Spin', type: 'Spin', trainerId: 's-04', dayOfWeek: 3, startTime: '19:00', durationMin: 45, capacity: 20, booked: 20 },
  { name: 'Reformer Pilates', type: 'Pilates', trainerId: 's-03', dayOfWeek: 4, startTime: '08:00', durationMin: 50, capacity: 8, booked: 6 },
  { name: 'Boxing Fundamentals', type: 'Boxing', trainerId: 's-02', dayOfWeek: 5, startTime: '18:30', durationMin: 60, capacity: 14, booked: 11 },
  { name: 'Mobility Reset', type: 'Mobility', trainerId: 's-01', dayOfWeek: 6, startTime: '09:00', durationMin: 40, capacity: 18, booked: 7 },
  { name: 'Saturday CrossFit', type: 'CrossFit', trainerId: 's-04', dayOfWeek: 6, startTime: '10:30', durationMin: 60, capacity: 15, booked: 17 },
]

function build(): GymClass[] {
  const POOL = 26 // must match the member fixture length

  return seeds.map((s, i) => {
    // A deterministic permutation of the member pool: step 5 is coprime with 26,
    // so this visits every id exactly once. Slicing it means a member can never
    // land on the roster and the waitlist of the same class. Random picks would
    // also break SSR, since the server and client would disagree.
    const seq = Array.from(
      { length: POOL },
      (_, k) => `m-${String(((i * 5 + k * 5) % POOL) + 1).padStart(2, '0')}`,
    )

    const rosterCount = Math.min(s.booked, s.capacity)
    const waitCount = Math.max(0, s.booked - s.capacity)
    return {
      id: `c-${String(i + 1).padStart(2, '0')}`,
      name: s.name,
      type: s.type,
      trainerId: s.trainerId,
      location: 'indiranagar',
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      durationMin: s.durationMin,
      capacity: s.capacity,
      roster: seq.slice(0, rosterCount),
      waitlist: seq.slice(rosterCount, rosterCount + waitCount),
    }
  })
}

export let classes: GymClass[] = build()

export let classById = new Map(classes.map((c) => [c.id, c]))

export function getClass(id: string): GymClass | undefined {
  return classById.get(id)
}

export function classesForDay(day: number): GymClass[] {
  return classes.filter((c) => c.dayOfWeek === day)
}

export function isFull(c: GymClass): boolean {
  return c.roster.length >= c.capacity
}
