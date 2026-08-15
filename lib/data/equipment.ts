// Equipment inventory, fault log, service history and member reservations.
//
// Built the same way as every other entity here: one fixed seed, one RNG stream
// consumed once at module load, so the dataset is byte-identical on every run
// regardless of import order.
//
// The catalogue below is written out rather than generated, because an asset
// register is a list of real things — a random "Machine 7" would make the
// screens meaningless. The RNG only decides service dates, faults and
// reservations, which are the parts that genuinely vary.

import { NOW, addDays, isoDate, isoStamp, makeRng } from "../seed"
import { members } from "./members"
import { staff } from "./staff"
import type {
  Equipment,
  EquipmentCategory,
  EquipmentFault,
  EquipmentReservation,
  EquipmentService,
  LocationId,
} from "../types"

const EQUIPMENT_SEED = 0x3f17c0
const FAULT_SEED = 0x3f17c1
const SERVICE_SEED = 0x3f17c2
const RESERVATION_SEED = 0x3f17c3

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  cardio: "Cardio",
  strength: "Strength",
  "free-weights": "Free weights",
  functional: "Functional",
  recovery: "Recovery",
  studio: "Studio",
}

/** What a row in the catalogue specifies; everything else is derived or seeded. */
interface Spec {
  name: string
  category: EquipmentCategory
  make: string
  model: string
  zone: string
  quantity: number
  unitCost: number
  usefulLifeMonths: number
  serviceIntervalDays: number
  bookable?: boolean
  slotMinutes?: number
}

/**
 * The floor plan. Downtown is the flagship and carries the full range;
 * Riverside is a studio-led site with more mat and reformer work; North Loop is
 * the smallest and deliberately has gaps — a location with everything would
 * make the per-location report pointless.
 */
const FLOOR: Record<LocationId, Spec[]> = {
  downtown: [
    { name: "Treadmill", category: "cardio", make: "Technogym", model: "Skillrun", zone: "Cardio deck", quantity: 8, unitCost: 425000, usefulLifeMonths: 84, serviceIntervalDays: 90 },
    { name: "Assault bike", category: "cardio", make: "Assault", model: "AirBike Elite", zone: "Cardio deck", quantity: 4, unitCost: 78000, usefulLifeMonths: 72, serviceIntervalDays: 120 },
    { name: "Rowing ergometer", category: "cardio", make: "Concept2", model: "RowErg PM5", zone: "Cardio deck", quantity: 6, unitCost: 92000, usefulLifeMonths: 96, serviceIntervalDays: 120 },
    { name: "Spin bike", category: "cardio", make: "Keiser", model: "M3i", zone: "Studio A", quantity: 22, unitCost: 145000, usefulLifeMonths: 84, serviceIntervalDays: 60 },
    { name: "Stair climber", category: "cardio", make: "StairMaster", model: "8G Gauntlet", zone: "Cardio deck", quantity: 2, unitCost: 310000, usefulLifeMonths: 84, serviceIntervalDays: 90 },
    { name: "Power rack", category: "strength", make: "Rogue", model: "RML-490C", zone: "Rig 1", quantity: 6, unitCost: 165000, usefulLifeMonths: 180, serviceIntervalDays: 180 },
    { name: "Cable crossover", category: "strength", make: "Life Fitness", model: "Signature Dual", zone: "Strength floor", quantity: 2, unitCost: 385000, usefulLifeMonths: 120, serviceIntervalDays: 90 },
    { name: "Leg press", category: "strength", make: "Hammer Strength", model: "Linear Leg Press", zone: "Strength floor", quantity: 2, unitCost: 295000, usefulLifeMonths: 144, serviceIntervalDays: 120 },
    { name: "Lat pulldown", category: "strength", make: "Life Fitness", model: "Optima Series", zone: "Strength floor", quantity: 3, unitCost: 180000, usefulLifeMonths: 120, serviceIntervalDays: 120 },
    { name: "Olympic barbell", category: "free-weights", make: "Eleiko", model: "IWF Training", zone: "Rig 1", quantity: 12, unitCost: 62000, usefulLifeMonths: 240, serviceIntervalDays: 365 },
    { name: "Dumbbell set 2.5–50kg", category: "free-weights", make: "Iron Grip", model: "Urethane Pro", zone: "Strength floor", quantity: 1, unitCost: 640000, usefulLifeMonths: 240, serviceIntervalDays: 365 },
    { name: "Bumper plate set", category: "free-weights", make: "Eleiko", model: "Sport Training", zone: "Rig 1", quantity: 8, unitCost: 88000, usefulLifeMonths: 240, serviceIntervalDays: 365 },
    { name: "Kettlebell rack", category: "free-weights", make: "Rogue", model: "Kettlebell 4–48kg", zone: "Functional zone", quantity: 2, unitCost: 145000, usefulLifeMonths: 240, serviceIntervalDays: 365 },
    { name: "Sled lane", category: "functional", make: "Rogue", model: "Dog Sled 1.2", zone: "Turf lane", quantity: 2, unitCost: 54000, usefulLifeMonths: 180, serviceIntervalDays: 180, bookable: true, slotMinutes: 30 },
    { name: "Battle ropes", category: "functional", make: "Onnit", model: "50ft Poly Dacron", zone: "Functional zone", quantity: 4, unitCost: 12000, usefulLifeMonths: 60, serviceIntervalDays: 365 },
    { name: "Boxing bag", category: "functional", make: "Fairtex", model: "Heavy Bag HB6", zone: "Boxing corner", quantity: 6, unitCost: 26000, usefulLifeMonths: 72, serviceIntervalDays: 180 },
    { name: "Squash court", category: "functional", make: "ASB", model: "GlassCourt", zone: "Court 1", quantity: 1, unitCost: 1850000, usefulLifeMonths: 300, serviceIntervalDays: 180, bookable: true, slotMinutes: 45 },
    { name: "Infrared sauna", category: "recovery", make: "Clearlight", model: "Sanctuary 2", zone: "Recovery suite", quantity: 2, unitCost: 480000, usefulLifeMonths: 120, serviceIntervalDays: 90, bookable: true, slotMinutes: 30 },
    { name: "Compression boots", category: "recovery", make: "Normatec", model: "Elite Legs", zone: "Recovery suite", quantity: 4, unitCost: 95000, usefulLifeMonths: 60, serviceIntervalDays: 180, bookable: true, slotMinutes: 30 },
    { name: "Massage gun station", category: "recovery", make: "Theragun", model: "PRO Plus", zone: "Recovery suite", quantity: 3, unitCost: 58000, usefulLifeMonths: 48, serviceIntervalDays: 365 },
    { name: "Yoga mat wall", category: "studio", make: "Manduka", model: "PRO 6mm", zone: "Studio B", quantity: 30, unitCost: 8500, usefulLifeMonths: 36, serviceIntervalDays: 365 },
    { name: "Pilates reformer", category: "studio", make: "Balanced Body", model: "Allegro 2", zone: "Studio B", quantity: 6, unitCost: 520000, usefulLifeMonths: 144, serviceIntervalDays: 90, bookable: true, slotMinutes: 45 },
  ],
  riverside: [
    { name: "Treadmill", category: "cardio", make: "Technogym", model: "MyRun", zone: "Cardio deck", quantity: 5, unitCost: 340000, usefulLifeMonths: 84, serviceIntervalDays: 90 },
    { name: "Rowing ergometer", category: "cardio", make: "Concept2", model: "RowErg PM5", zone: "Cardio deck", quantity: 4, unitCost: 92000, usefulLifeMonths: 96, serviceIntervalDays: 120 },
    { name: "Spin bike", category: "cardio", make: "Keiser", model: "M3i", zone: "Studio A", quantity: 18, unitCost: 145000, usefulLifeMonths: 84, serviceIntervalDays: 60 },
    { name: "Power rack", category: "strength", make: "Rogue", model: "RML-390F", zone: "Rig 1", quantity: 4, unitCost: 132000, usefulLifeMonths: 180, serviceIntervalDays: 180 },
    { name: "Cable crossover", category: "strength", make: "Life Fitness", model: "Optima Dual", zone: "Strength floor", quantity: 1, unitCost: 310000, usefulLifeMonths: 120, serviceIntervalDays: 90 },
    { name: "Smith machine", category: "strength", make: "Matrix", model: "Magnum MG-A78", zone: "Strength floor", quantity: 1, unitCost: 275000, usefulLifeMonths: 144, serviceIntervalDays: 120 },
    { name: "Dumbbell set 2.5–40kg", category: "free-weights", make: "Iron Grip", model: "Urethane Pro", zone: "Strength floor", quantity: 1, unitCost: 480000, usefulLifeMonths: 240, serviceIntervalDays: 365 },
    { name: "Olympic barbell", category: "free-weights", make: "Rogue", model: "Ohio Bar", zone: "Rig 1", quantity: 8, unitCost: 38000, usefulLifeMonths: 240, serviceIntervalDays: 365 },
    { name: "Kettlebell rack", category: "free-weights", make: "Rogue", model: "Kettlebell 4–40kg", zone: "Functional zone", quantity: 1, unitCost: 118000, usefulLifeMonths: 240, serviceIntervalDays: 365 },
    { name: "Boxing bag", category: "functional", make: "Fairtex", model: "Heavy Bag HB6", zone: "Boxing corner", quantity: 4, unitCost: 26000, usefulLifeMonths: 72, serviceIntervalDays: 180 },
    { name: "TRX frame", category: "functional", make: "TRX", model: "S-Frame", zone: "Functional zone", quantity: 2, unitCost: 165000, usefulLifeMonths: 180, serviceIntervalDays: 180 },
    { name: "Pilates reformer", category: "studio", make: "Balanced Body", model: "Allegro 2", zone: "Studio B", quantity: 8, unitCost: 520000, usefulLifeMonths: 144, serviceIntervalDays: 90, bookable: true, slotMinutes: 45 },
    { name: "Yoga mat wall", category: "studio", make: "Manduka", model: "PRO 6mm", zone: "Studio B", quantity: 24, unitCost: 8500, usefulLifeMonths: 36, serviceIntervalDays: 365 },
    { name: "Infrared sauna", category: "recovery", make: "Clearlight", model: "Sanctuary Y", zone: "Recovery suite", quantity: 1, unitCost: 385000, usefulLifeMonths: 120, serviceIntervalDays: 90, bookable: true, slotMinutes: 30 },
    { name: "Compression boots", category: "recovery", make: "Normatec", model: "Elite Legs", zone: "Recovery suite", quantity: 2, unitCost: 95000, usefulLifeMonths: 60, serviceIntervalDays: 180, bookable: true, slotMinutes: 30 },
  ],
  "north-loop": [
    { name: "Treadmill", category: "cardio", make: "Precor", model: "TRM 445", zone: "Cardio deck", quantity: 4, unitCost: 285000, usefulLifeMonths: 84, serviceIntervalDays: 90 },
    { name: "Assault bike", category: "cardio", make: "Assault", model: "AirBike Classic", zone: "Cardio deck", quantity: 3, unitCost: 62000, usefulLifeMonths: 72, serviceIntervalDays: 120 },
    { name: "Rowing ergometer", category: "cardio", make: "Concept2", model: "RowErg PM5", zone: "Cardio deck", quantity: 3, unitCost: 92000, usefulLifeMonths: 96, serviceIntervalDays: 120 },
    { name: "Power rack", category: "strength", make: "Rogue", model: "RML-390F", zone: "Rig 1", quantity: 3, unitCost: 132000, usefulLifeMonths: 180, serviceIntervalDays: 180 },
    { name: "Lat pulldown", category: "strength", make: "Matrix", model: "Aura G3", zone: "Strength floor", quantity: 1, unitCost: 152000, usefulLifeMonths: 120, serviceIntervalDays: 120 },
    { name: "Dumbbell set 2.5–35kg", category: "free-weights", make: "Iron Grip", model: "Rubber Hex", zone: "Strength floor", quantity: 1, unitCost: 310000, usefulLifeMonths: 240, serviceIntervalDays: 365 },
    { name: "Olympic barbell", category: "free-weights", make: "Rogue", model: "Ohio Bar", zone: "Rig 1", quantity: 5, unitCost: 38000, usefulLifeMonths: 240, serviceIntervalDays: 365 },
    { name: "Kettlebell rack", category: "free-weights", make: "Rogue", model: "Kettlebell 4–32kg", zone: "Functional zone", quantity: 1, unitCost: 92000, usefulLifeMonths: 240, serviceIntervalDays: 365 },
    { name: "Battle ropes", category: "functional", make: "Onnit", model: "40ft Poly Dacron", zone: "Functional zone", quantity: 2, unitCost: 9500, usefulLifeMonths: 60, serviceIntervalDays: 365 },
    { name: "Sled lane", category: "functional", make: "Rogue", model: "Dog Sled 1.2", zone: "Turf lane", quantity: 1, unitCost: 54000, usefulLifeMonths: 180, serviceIntervalDays: 180, bookable: true, slotMinutes: 30 },
    { name: "Yoga mat wall", category: "studio", make: "Manduka", model: "PRO 6mm", zone: "Studio A", quantity: 18, unitCost: 8500, usefulLifeMonths: 36, serviceIntervalDays: 365 },
    { name: "Compression boots", category: "recovery", make: "Normatec", model: "Elite Legs", zone: "Recovery suite", quantity: 2, unitCost: 95000, usefulLifeMonths: 60, serviceIntervalDays: 180, bookable: true, slotMinutes: 30 },
  ],
}

const LOCATION_PREFIX: Record<LocationId, string> = {
  downtown: "DT",
  riverside: "RV",
  "north-loop": "NL",
}

function buildEquipment(): Equipment[] {
  const rng = makeRng(EQUIPMENT_SEED)
  const out: Equipment[] = []
  let n = 0

  for (const location of Object.keys(FLOOR) as LocationId[]) {
    let tagSeq = 0
    for (const spec of FLOOR[location]) {
      n += 1
      tagSeq += 1

      // Bought somewhere in the last 1–6 years, older kit skewing to the
      // flagship because that is the site that opened first.
      const ageDays = rng.int(location === "downtown" ? 400 : 120, 2100)
      const purchaseDate = isoDate(addDays(NOW, -ageDays))

      // Last service is inside the interval most of the time; the tail is what
      // populates the "overdue" queue the owner screen exists to show.
      const interval = spec.serviceIntervalDays
      const overdue = rng.bool(0.18)
      const sinceService = overdue
        ? rng.int(interval + 1, interval + 75)
        : rng.int(1, interval)
      // Nothing can have been serviced before it was bought.
      const lastServiceDate =
        sinceService >= ageDays ? null : isoDate(addDays(NOW, -sinceService))

      const status: Equipment["status"] = rng.weighted([
        ["in-service", 84],
        ["needs-service", 9],
        ["out-of-service", 5],
        ["retired", 2],
      ])

      out.push({
        id: `eq-${String(n).padStart(3, "0")}`,
        name: spec.name,
        category: spec.category,
        make: spec.make,
        model: spec.model,
        assetTag: `${LOCATION_PREFIX[location]}-${String(tagSeq).padStart(3, "0")}`,
        location,
        zone: spec.zone,
        quantity: spec.quantity,
        // An overdue asset is flagged, not silently left "in service" — the
        // status column and the derived due-date must agree or the screen lies.
        status: status === "in-service" && overdue ? "needs-service" : status,
        purchaseDate,
        unitCost: spec.unitCost,
        usefulLifeMonths: spec.usefulLifeMonths,
        serviceIntervalDays: interval,
        lastServiceDate,
        bookable: spec.bookable ?? false,
        slotMinutes: spec.slotMinutes ?? 30,
        notes: "",
      })
    }
  }
  return out
}

let equipmentBase: Equipment[] = buildEquipment()

const FAULT_SUMMARIES: Record<EquipmentCategory, string[]> = {
  cardio: [
    "Belt slipping under load above 12 km/h",
    "Console loses power mid-session",
    "Heart-rate grips reading zero",
    "Loud bearing noise on the flywheel",
  ],
  strength: [
    "Cable frayed near the top pulley",
    "Weight stack pin sticking",
    "Seat adjustment lever will not lock",
    "Pulley bearing grinding through the range",
  ],
  "free-weights": [
    "Knurling worn smooth on two bars",
    "Sleeve spin seized on one barbell",
    "Rubber coating split on the 22.5kg pair",
    "Rack upright loose at the floor plate",
  ],
  functional: [
    "Turf lifting at the seam",
    "Bag chain link deformed",
    "Sled runner gouging the turf",
    "Anchor point bolt backed out",
  ],
  recovery: [
    "Boot bladder not holding pressure",
    "Heater cutting out after 10 minutes",
    "Control panel unresponsive",
    "Door seal perished",
  ],
  studio: [
    "Reformer footbar catch worn",
    "Spring tension uneven left to right",
    "Mat backing delaminating",
    "Carriage rolling rough on the rails",
  ],
}

function buildFaults(): EquipmentFault[] {
  const rng = makeRng(FAULT_SEED)
  const reporters = [
    ...staff.filter((s) => s.active && (s.role === "trainer" || s.role === "front-desk")),
    ...members.slice(0, 40),
  ]
  const out: EquipmentFault[] = []
  let n = 0

  for (const eq of equipmentBase) {
    if (eq.status === "retired") continue

    // Anything not in service has an open fault explaining why. That is the
    // invariant the owner screen relies on: a down machine with no fault would
    // be a status nobody can account for.
    const needsOpen = eq.status === "out-of-service" || eq.status === "needs-service"
    const historic = rng.int(0, 2)
    const count = historic + (needsOpen ? 1 : 0)

    for (let i = 0; i < count; i++) {
      n += 1
      const isOpen = needsOpen && i === count - 1
      const daysAgo = isOpen ? rng.int(1, 21) : rng.int(30, 420)
      const reportedAt = addDays(NOW, -daysAgo)
      const reporter = rng.pick(reporters)
      // An out-of-service asset MUST carry an unsafe open fault. `statusForFaults`
      // in server/domain/equipment-rules.ts derives status from the open faults,
      // and only `unsafe` takes a machine off the floor — so seeding a
      // down machine with a merely "major" fault produces a row whose status
      // contradicts its own fault log. scripts/verify-numbers.mjs asserts this.
      const severity: EquipmentFault["severity"] = isOpen
        ? eq.status === "out-of-service"
          ? "unsafe"
          : rng.weighted([["minor", 55], ["major", 45]])
        : rng.weighted([["minor", 60], ["major", 32], ["unsafe", 8]])

      const resolvedDays = rng.int(1, 14)
      out.push({
        id: `fault-${String(n).padStart(4, "0")}`,
        equipmentId: eq.id,
        reportedBy: reporter.id,
        reporterName: reporter.name,
        reportedAt: isoStamp(reportedAt),
        severity,
        summary: rng.pick(FAULT_SUMMARIES[eq.category]),
        status: isOpen ? (rng.bool(0.45) ? "acknowledged" : "open") : "resolved",
        resolvedAt: isOpen ? null : isoStamp(addDays(reportedAt, resolvedDays)),
        resolutionNote: isOpen
          ? null
          : rng.pick([
              "Part replaced under warranty",
              "Serviced on site by the vendor",
              "Adjusted and re-tested",
              "Consumable swapped from stock",
            ]),
      })
    }
  }
  return out.sort((a, b) => b.reportedAt.localeCompare(a.reportedAt))
}

const VENDORS = [
  "Technogym India Service",
  "FitCare Maintenance",
  "Nikhil Sports Engineering",
  "In-house team",
  "Precor Authorised Service",
]

function buildServices(): EquipmentService[] {
  const rng = makeRng(SERVICE_SEED)
  const out: EquipmentService[] = []
  let n = 0

  for (const eq of equipmentBase) {
    // The install row carries the purchase cost, so "lifetime spend" on an asset
    // is a plain sum over this table rather than a special case bolted onto it.
    n += 1
    out.push({
      id: `svc-${String(n).padStart(4, "0")}`,
      equipmentId: eq.id,
      date: eq.purchaseDate,
      kind: "install",
      vendor: "Supplier commissioning",
      cost: eq.unitCost * eq.quantity,
      note: `${eq.quantity} × ${eq.make} ${eq.model} commissioned`,
    })

    if (!eq.lastServiceDate) continue

    // Walk back from the last service at roughly the service interval.
    const last = new Date(`${eq.lastServiceDate}T00:00:00.000Z`)
    const spans = rng.int(1, 5)
    for (let i = 0; i < spans; i++) {
      const date = addDays(last, -i * eq.serviceIntervalDays - rng.int(0, 12))
      if (date <= new Date(`${eq.purchaseDate}T00:00:00.000Z`)) break
      n += 1
      const kind: EquipmentService["kind"] = rng.weighted([
        ["routine", 70],
        ["repair", 20],
        ["inspection", 10],
      ])
      const cost =
        kind === "repair"
          ? Math.round(eq.unitCost * rng.float(0.03, 0.14))
          : Math.round(eq.unitCost * rng.float(0.005, 0.03))
      out.push({
        id: `svc-${String(n).padStart(4, "0")}`,
        equipmentId: eq.id,
        date: isoDate(date),
        kind,
        vendor: rng.pick(VENDORS),
        cost,
        note:
          kind === "repair"
            ? "Fault rectified, part replaced"
            : kind === "inspection"
              ? "Safety inspection passed"
              : "Scheduled service completed",
      })
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

function buildReservations(): EquipmentReservation[] {
  const rng = makeRng(RESERVATION_SEED)
  const bookable = equipmentBase.filter((e) => e.bookable && e.status !== "retired")
  const eligible = members.filter((m) => m.status === "active" || m.status === "trial")
  const out: EquipmentReservation[] = []
  let n = 0

  // Two weeks back and two weeks forward: the member screen needs something to
  // show as upcoming, and the owner's utilisation number needs history.
  for (let dayOffset = -14; dayOffset <= 14; dayOffset++) {
    const date = isoDate(addDays(NOW, dayOffset))
    for (const eq of bookable) {
      const slots = Math.floor((22 * 60 - 6 * 60) / eq.slotMinutes)
      // Recovery and courts fill; sleds barely get booked. That spread is what
      // makes the utilisation column worth reading.
      const demand = eq.category === "recovery" ? 0.3 : eq.category === "studio" ? 0.22 : 0.12
      const taken = new Set<number>()
      const wanted = Math.round(slots * demand * rng.float(0.5, 1.4))

      for (let i = 0; i < wanted; i++) {
        const slot = rng.int(0, slots - 1)
        // One unit, one slot: a clash is the thing reservations exist to stop,
        // so the seed must not contain any.
        if (taken.has(slot)) continue
        taken.add(slot)

        const minutes = 6 * 60 + slot * eq.slotMinutes
        const startTime = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
        n += 1
        out.push({
          id: `res-${String(n).padStart(5, "0")}`,
          equipmentId: eq.id,
          memberId: rng.pick(eligible).id,
          date,
          startTime,
          durationMin: eq.slotMinutes,
          status:
            dayOffset < 0
              ? rng.weighted([["completed", 88], ["cancelled", 12]])
              : rng.weighted([["booked", 94], ["cancelled", 6]]),
          createdAt: isoStamp(addDays(NOW, dayOffset - rng.int(1, 6))),
        })
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
}

// `let` + rebuild(): these are ESM live bindings, so when the store hydrates
// from the database every importer sees the new arrays without a single call
// site changing. See lib/data/hydrate.ts.
export let equipment: Equipment[] = equipmentBase
export let equipmentById = new Map(equipment.map((e) => [e.id, e]))
export let equipmentFaults: EquipmentFault[] = buildFaults()
export let equipmentServices: EquipmentService[] = buildServices()
export let equipmentReservations: EquipmentReservation[] = buildReservations()

/** Replaces the seeded inventory with the database's copy. */
export function setEquipmentData(next: {
  equipment: Equipment[]
  faults: EquipmentFault[]
  services: EquipmentService[]
  reservations: EquipmentReservation[]
}): void {
  equipmentBase = next.equipment
  equipment = next.equipment
  equipmentById = new Map(equipment.map((e) => [e.id, e]))
  equipmentFaults = next.faults
  equipmentServices = next.services
  equipmentReservations = next.reservations
}

export function getEquipment(id: string): Equipment | undefined {
  return equipmentById.get(id)
}
