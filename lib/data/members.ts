import type { LocationId, Member, MembershipStatus, RiskInput } from "../types"
import { addDays, addMonths, isoDate, makeRng, NOW } from "../seed"
import { computeRisk } from "../risk"
import { getPlan } from "./plans"
import { activeTrainers } from "./staff"
import { companies } from "./companies"

const rng = makeRng(0x5eed01)

const FIRST_NAMES = [
  "Aarav", "Isabella", "Mateo", "Yuki", "Omar", "Chloe", "Ravi", "Anaya", "Liam", "Fatima",
  "Noah", "Mei", "Diego", "Zara", "Ethan", "Priya", "Lucas", "Amara", "Hiroshi", "Sofia",
  "Elena", "Kofi", "Nadia", "Marcus", "Leila", "Andre", "Ingrid", "Tariq", "Bianca", "Sanjay",
  "Freya", "Malik", "Rosa", "Jin", "Camila", "Emeka", "Aisha", "Viktor", "Nina", "Rahul",
  "Grace", "Idris", "Lena", "Theo", "Maya", "Oscar", "Hana", "Sam", "Yara", "Dmitri",
]

const LAST_NAMES = [
  "Sharma", "Reyes", "Kim", "Okafor", "Novak", "Silva", "Chen", "Haddad", "Nguyen", "Patel",
  "Rossi", "Abebe", "Larsen", "Costa", "Ivanov", "Suzuki", "Mensah", "Kaur", "Duarte", "Petrov",
  "Adeyemi", "Fernandez", "Yilmaz", "Bakker", "Moreau", "Santos", "Wang", "Khan", "Olsen", "Bianchi",
  "Nakamura", "Diallo", "Kowalski", "Rahman", "Torres", "Andersson", "Mwangi", "Vargas", "Ferrari", "Sokolov",
]

const LOCATION_WEIGHTS: (readonly [LocationId, number])[] = [
  ["downtown", 5],
  ["riverside", 3],
  ["north-loop", 2],
]

type Archetype = "champion" | "steady" | "casual" | "slipping" | "dormant" | "new" | "churned"

const ARCHETYPE_WEIGHTS: (readonly [Archetype, number])[] = [
  ["champion", 18],
  ["steady", 26],
  ["casual", 20],
  ["slipping", 12],
  ["dormant", 8],
  ["new", 8],
  ["churned", 8],
]

// Non-corporate plans a member can hold, weighted toward the mid tiers.
const CONSUMER_PLAN_WEIGHTS: (readonly [string, number])[] = [
  ["plan-offpeak", 3],
  ["plan-standard", 5],
  ["plan-unlimited", 4],
  ["plan-unlimited-annual", 2],
  ["plan-dropin", 1],
]

// Corporate pool employee targets (sums to 76 corporate members).
const CORPORATE_TARGETS: Record<string, number> = {
  "co-northwind": 30,
  "co-acme": 24,
  "co-meridian": 22,
}
const corporateCount: Record<string, number> = { "co-northwind": 0, "co-acme": 0, "co-meridian": 0 }

interface Spec {
  status: MembershipStatus
  tenure: [number, number]
  daysSince: [number, number] | "null"
  last30: [number, number]
  prev30: [number, number]
  cancel: [number, number]
  failed: [number, number]
  freeze: [number, number]
}

const SPECS: Record<Archetype, Spec> = {
  champion: { status: "active", tenure: [6, 40], daysSince: [0, 3], last30: [14, 26], prev30: [13, 25], cancel: [0, 0.05], failed: [0, 0], freeze: [0, 0] },
  steady: { status: "active", tenure: [4, 36], daysSince: [1, 6], last30: [8, 14], prev30: [8, 15], cancel: [0, 0.1], failed: [0, 0], freeze: [0, 1] },
  casual: { status: "active", tenure: [3, 30], daysSince: [4, 12], last30: [3, 7], prev30: [4, 9], cancel: [0.05, 0.2], failed: [0, 0], freeze: [0, 1] },
  slipping: { status: "active", tenure: [5, 30], daysSince: [10, 20], last30: [1, 4], prev30: [6, 12], cancel: [0.15, 0.4], failed: [0, 1], freeze: [0, 2] },
  dormant: { status: "frozen", tenure: [6, 36], daysSince: [25, 70], last30: [0, 1], prev30: [2, 6], cancel: [0.1, 0.5], failed: [0, 2], freeze: [1, 3] },
  new: { status: "trial", tenure: [0, 2], daysSince: [0, 8], last30: [2, 8], prev30: [0, 3], cancel: [0, 0.2], failed: [0, 0], freeze: [0, 0] },
  churned: { status: "cancelled", tenure: [3, 30], daysSince: [30, 120], last30: [0, 0], prev30: [0, 2], cancel: [0.1, 0.5], failed: [0, 2], freeze: [0, 2] },
}

const MEMBER_COUNT = 380

function makeName(index: number) {
  const firstName = rng.pick(FIRST_NAMES)
  const lastName = rng.pick(LAST_NAMES)
  const name = `${firstName} ${lastName}`
  const initials = (firstName[0] + lastName[0]).toUpperCase()
  const email = `${firstName}.${lastName}${index}`.toLowerCase() + "@example.com"
  const phone = `+91 9${rng.int(1000, 9999)} ${rng.int(10000, 99999)}`
  return { firstName, lastName, name, initials, email, phone }
}

function monthlyValueFor(planId: string, visitsLast30: number): number {
  const plan = getPlan(planId)
  if (!plan) return 0
  if (plan.interval === "per-visit") return plan.price * Math.max(1, visitsLast30)
  if (plan.interval === "annual") return Math.round(plan.price / 12)
  return plan.price
}

function tryAssignCorporate(): string | null {
  const eligible = Object.keys(CORPORATE_TARGETS).filter((id) => corporateCount[id] < CORPORATE_TARGETS[id])
  if (eligible.length === 0) return null
  const id = rng.pick(eligible)
  corporateCount[id]++
  return id
}

function build(): Member[] {
  const out: Member[] = []

  for (let i = 0; i < MEMBER_COUNT; i++) {
    const archetype = rng.weighted(ARCHETYPE_WEIGHTS)
    const spec = SPECS[archetype]

    const tenureMonths = rng.int(spec.tenure[0], spec.tenure[1])
    const joined = addMonths(NOW, -tenureMonths)

    // Corporate assignment: ~offered to active/steady-ish members with capacity.
    let companyId: string | null = null
    let planId: string
    const wantsCorporate = archetype !== "churned" && archetype !== "new" && rng.bool(0.26)
    if (wantsCorporate) {
      companyId = tryAssignCorporate()
    }
    if (companyId) {
      planId = "plan-corporate"
    } else {
      planId = rng.weighted(CONSUMER_PLAN_WEIGHTS)
    }
    const plan = getPlan(planId)!

    const visitsLast30 = rng.int(spec.last30[0], spec.last30[1])
    const visitsPrev30 = rng.int(spec.prev30[0], spec.prev30[1])

    let daysSinceLastVisit: number | null
    let lastVisit: string | null
    if (spec.daysSince === "null") {
      daysSinceLastVisit = null
      lastVisit = null
    } else {
      daysSinceLastVisit = rng.int(spec.daysSince[0], spec.daysSince[1])
      lastVisit = isoDate(addDays(NOW, -daysSinceLastVisit))
    }

    const cancelRate = Number(rng.float(spec.cancel[0], spec.cancel[1]).toFixed(2))
    const failedPayments = rng.int(spec.failed[0], spec.failed[1])
    const freezeCount = rng.int(spec.freeze[0], spec.freeze[1])

    // Status refinement per archetype.
    let status = spec.status
    if (archetype === "new") status = rng.bool(0.55) ? "trial" : "active"
    if (archetype === "dormant") status = rng.bool(0.5) ? "frozen" : "active"
    if (archetype === "churned") status = rng.bool(0.5) ? "cancelled" : "expired"

    const endDate = status === "cancelled" || status === "expired" ? isoDate(addDays(NOW, -rng.int(3, 120))) : null

    const planVisitsPerMonth = plan.visitsPerMonth
    const creditsRemaining =
      companyId !== null
        ? null
        : planVisitsPerMonth !== null
          ? Math.max(0, planVisitsPerMonth - visitsLast30)
          : null

    const monthlyValue = monthlyValueFor(planId, visitsLast30)
    const ltvFactor = rng.float(0.85, 1.15)
    const lifetimeValue = Math.round(monthlyValue * Math.max(1, tenureMonths) * ltvFactor)

    const riskInput: RiskInput = {
      status,
      daysSinceLastVisit,
      visitsLast30,
      visitsPrev30,
      planVisitsPerMonth,
      tenureMonths,
      failedPayments,
      cancelRate,
      freezeCount,
    }
    const risk = computeRisk(riskInput)

    const homeLocation = rng.weighted(LOCATION_WEIGHTS)
    const hasTrainer = (archetype === "champion" || archetype === "steady" || archetype === "slipping") && rng.bool(0.5)
    const assignedTrainerId = hasTrainer ? rng.pick(activeTrainers).id : null

    const tags: string[] = []
    if (companyId) tags.push("corporate")
    if (plan.interval === "annual") tags.push("annual")
    if (status === "trial") tags.push("trial")
    if (risk.band === "high") tags.push("at-risk")
    if (lifetimeValue >= 90000) tags.push("vip")
    if (archetype === "champion") tags.push("power-user")

    const nm = makeName(i)

    out.push({
      id: `m-${(i + 1).toString().padStart(4, "0")}`,
      firstName: nm.firstName,
      lastName: nm.lastName,
      name: nm.name,
      initials: nm.initials,
      email: nm.email,
      phone: nm.phone,
      status,
      planId,
      homeLocation,
      assignedTrainerId,
      companyId,
      joinedDate: isoDate(joined),
      endDate,
      tags,
      metrics: {
        tenureMonths,
        lastVisit,
        daysSinceLastVisit,
        visitsLast30,
        visitsPrev30,
        avgVisitsPerWeek: Number((visitsLast30 / 4.33).toFixed(1)),
        planVisitsPerMonth,
        creditsRemaining,
        freezeCount,
        cancelRate,
        failedPayments,
        lifetimeValue,
        monthlyValue,
      },
      risk,
    })

    if (companyId) {
      const co = companies.find((c) => c.id === companyId)
      if (co) co.employeeMemberIds.push(out[out.length - 1].id)
    }
  }

  return out
}

export const members: Member[] = build()

export const memberById = new Map(members.map((m) => [m.id, m]))

export function getMember(id: string): Member | undefined {
  return memberById.get(id)
}

export const activeMembers = members.filter((m) => m.status === "active" || m.status === "trial" || m.status === "frozen")
