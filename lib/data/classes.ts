import type { ClassType, GymClass, LocationId } from "../types"
import { makeRng } from "../seed"
import { activeMembers } from "./members"
import { activeTrainers } from "./staff"

const rng = makeRng(0xc1a55)

const TYPES: ClassType[] = ["Strength", "HIIT", "Yoga", "Spin", "Pilates", "Boxing", "Mobility", "CrossFit"]

const CAPACITY: Record<ClassType, number> = {
  Strength: 14,
  HIIT: 24,
  Yoga: 18,
  Spin: 20,
  Pilates: 12,
  Boxing: 16,
  Mobility: 16,
  CrossFit: 15,
}

const DURATION: Record<ClassType, number> = {
  Strength: 60,
  HIIT: 45,
  Yoga: 60,
  Spin: 45,
  Pilates: 50,
  Boxing: 45,
  Mobility: 30,
  CrossFit: 60,
}

const NAME_PREFIX: Record<ClassType, string[]> = {
  Strength: ["Barbell", "Powerlift", "Iron"],
  HIIT: ["Power", "Metcon", "Ignite"],
  Yoga: ["Vinyasa", "Sunrise", "Restorative"],
  Spin: ["Rhythm", "Endurance", "Sprint"],
  Pilates: ["Core", "Reformer", "Mat"],
  Boxing: ["Fight", "Combat", "Southpaw"],
  Mobility: ["Flow", "Recovery", "Unlock"],
  CrossFit: ["WOD", "Grinder", "Engine"],
}

const START_TIMES = ["06:30", "07:30", "09:00", "12:15", "17:30", "18:30", "19:30"]

const memberPool = activeMembers.map((m) => m.id)

function trainerForType(type: ClassType) {
  const matches = activeTrainers.filter((t) => t.specialties.some((s) => s === type))
  return matches.length > 0 ? rng.pick(matches) : rng.pick(activeTrainers)
}

function build(): GymClass[] {
  const out: GymClass[] = []

  for (let i = 0; i < 42; i++) {
    const type = TYPES[i % TYPES.length]
    const trainer = trainerForType(type)
    const location: LocationId = rng.pick(trainer.locations)
    const capacity = CAPACITY[type]
    const dayOfWeek = rng.int(1, 6) // Mon–Sat
    const startTime = rng.pick(START_TIMES)

    // Default fill: 30–90% of capacity.
    const fill = Math.round(capacity * rng.float(0.3, 0.9))
    const roster = rng.sample(memberPool, Math.min(fill, memberPool.length))

    out.push({
      id: `cl-${(i + 1).toString().padStart(3, "0")}`,
      name: `${rng.pick(NAME_PREFIX[type])} ${type}`,
      type,
      trainerId: trainer.id,
      location,
      dayOfWeek,
      startTime,
      durationMin: DURATION[type],
      capacity,
      roster,
      waitlist: [],
    })
  }

  // --- Guaranteed edge cases the UI must handle ---

  // Two fully-booked classes with active waitlists.
  const full1 = out[3] // an HIIT class
  full1.roster = rng.sample(memberPool, full1.capacity)
  full1.waitlist = rng.sample(
    memberPool.filter((id) => !full1.roster.includes(id)),
    6,
  )

  const full2 = out[9] // a HIIT/Strength class
  full2.roster = rng.sample(memberPool, full2.capacity)
  full2.waitlist = rng.sample(
    memberPool.filter((id) => !full2.roster.includes(id)),
    3,
  )

  // One near-empty class: exactly 3 booked out of 20 capacity.
  const sparse = out[6] // a Mobility slot — force to Spin capacity for the 3/20 story
  sparse.type = "Spin"
  sparse.name = "Endurance Spin"
  sparse.capacity = 20
  sparse.durationMin = DURATION.Spin
  sparse.roster = rng.sample(memberPool, 3)
  sparse.waitlist = []

  return out
}

export const classes: GymClass[] = build()

export const classById = new Map(classes.map((c) => [c.id, c]))

export function getClass(id: string): GymClass | undefined {
  return classById.get(id)
}

export function classesForDay(day: number): GymClass[] {
  return classes.filter((c) => c.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime))
}

export function isFull(c: GymClass): boolean {
  return c.roster.length >= c.capacity
}
