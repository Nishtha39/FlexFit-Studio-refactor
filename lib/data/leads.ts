import type { Lead, LeadSource, LeadStage } from "../types"
import { addDays, isoDate, makeRng, NOW } from "../seed"
import { staff } from "./staff"

const rng = makeRng(0x1ead55)

const FIRST = ["Owen", "Mira", "Jonas", "Tara", "Felix", "Nova", "Ravi", "Elsa", "Kai", "Lucia", "Sami", "Bea", "Ari", "Wren", "Zane", "Ivy"]
const LAST = ["Bright", "Vance", "Holt", "Frost", "Lane", "Cross", "Reed", "Quinn", "Vaughn", "Marsh", "Blake", "Kade", "Sol", "Pike", "Rune", "Ash"]

const SOURCES: (readonly [LeadSource, number])[] = [
  ["website", 4],
  ["instagram", 3],
  ["referral", 3],
  ["walk-in", 3],
  ["google", 2],
  ["corporate", 1],
]

// Stage → typical age window (days) so aging chips have a believable spread.
const STAGES: { stage: LeadStage; count: number; age: [number, number] }[] = [
  { stage: "new", count: 7, age: [0, 4] },
  { stage: "contacted", count: 6, age: [1, 9] },
  { stage: "tour-booked", count: 4, age: [2, 12] },
  { stage: "trial", count: 4, age: [3, 16] },
  { stage: "won", count: 3, age: [5, 40] },
  { stage: "lost", count: 3, age: [8, 60] },
]

const INTEREST = ["plan-standard", "plan-unlimited", "plan-offpeak", "plan-unlimited-annual", null]
const salesOwners = staff.filter((s) => s.role === "manager" || s.role === "front-desk" || s.role === "owner")

function build(): Lead[] {
  const out: Lead[] = []
  let seq = 0

  for (const group of STAGES) {
    for (let i = 0; i < group.count; i++) {
      const first = rng.pick(FIRST)
      const last = rng.pick(LAST)
      const ageDays = rng.int(group.age[0], group.age[1])
      const estValue = rng.pick([2200, 3400, 4900, 4083, 3000])
      out.push({
        id: `lead-${(++seq).toString().padStart(3, "0")}`,
        name: `${first} ${last}`,
        email: `${first}.${last}${seq}`.toLowerCase() + "@example.com",
        phone: `+91 9${rng.int(1000, 9999)} ${rng.int(10000, 99999)}`,
        source: rng.weighted(SOURCES),
        stage: group.stage,
        ownerId: rng.pick(salesOwners).id,
        createdDate: isoDate(addDays(NOW, -ageDays)),
        ageDays,
        estValue,
        interestedPlanId: rng.pick(INTEREST),
        note: "",
      })
    }
  }
  return out
}

// `let` + setLeads(): ESM live bindings. See lib/data/hydrate.ts.
export let leads: Lead[] = build()

export let leadById = new Map(leads.map((l) => [l.id, l]))

export function leadsByStage(stage: LeadStage): Lead[] {
  return leads.filter((l) => l.stage === stage)
}

/** Open leads sitting past a staleness threshold — surfaced as aging chips. */
export function staleLeads(thresholdDays = 7): Lead[] {
  const open: LeadStage[] = ["new", "contacted", "tour-booked", "trial"]
  return leads.filter((l) => open.includes(l.stage) && l.ageDays >= thresholdDays)
}

export function setLeads(next: Lead[]): void {
  leads = next
  leadById = new Map(leads.map((l) => [l.id, l]))
}
