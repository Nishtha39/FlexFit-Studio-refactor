import type { Plan } from "../types"

// 6 plans, including two unlimited tiers and a corporate-only pooled plan.
// Prices are INR/month equivalents (per-visit for the drop-in).
// `let` + setPlans(): ESM live bindings. See lib/data/hydrate.ts.
export let plans: Plan[] = [
  {
    id: "plan-dropin",
    name: "Day Pass",
    description: "Single-visit drop-in. No commitment.",
    interval: "per-visit",
    price: 600,
    visitsPerMonth: 1,
    corporateOnly: false,
    active: true,
    perks: ["Full floor access", "1 group class"],
  },
  {
    id: "plan-offpeak",
    name: "Off-Peak 8",
    description: "8 visits per month, weekdays before 4pm.",
    interval: "monthly",
    price: 2200,
    visitsPerMonth: 8,
    corporateOnly: false,
    active: true,
    perks: ["8 visits / month", "Off-peak hours", "2 group classes / week"],
  },
  {
    id: "plan-standard",
    name: "Standard",
    description: "12 visits per month, any hour.",
    interval: "monthly",
    price: 3400,
    visitsPerMonth: 12,
    corporateOnly: false,
    active: true,
    perks: ["12 visits / month", "All hours", "4 group classes / week", "1 guest pass / month"],
  },
  {
    id: "plan-unlimited",
    name: "Unlimited Monthly",
    description: "Unlimited access, billed monthly.",
    interval: "monthly",
    price: 4900,
    visitsPerMonth: null,
    corporateOnly: false,
    active: true,
    perks: ["Unlimited visits", "All classes", "2 guest passes / month", "Locker included"],
  },
  {
    id: "plan-unlimited-annual",
    name: "Unlimited Annual",
    description: "Unlimited access, billed yearly — two months free.",
    interval: "annual",
    price: 49000,
    visitsPerMonth: null,
    corporateOnly: false,
    active: true,
    perks: ["Unlimited visits", "All classes", "4 guest passes / month", "Locker + towel service", "Free InBody scans"],
  },
  {
    id: "plan-corporate",
    name: "Corporate Flex",
    description: "Shared credit pool for company employees.",
    interval: "monthly",
    price: 3000,
    visitsPerMonth: null,
    corporateOnly: true,
    active: true,
    perks: ["Pooled credits", "Any employee", "Consolidated invoicing", "Quarterly usage report"],
  },
]

export let planById = new Map(plans.map((p) => [p.id, p]))

export function getPlan(id: string): Plan | undefined {
  return planById.get(id)
}

export function setPlans(next: Plan[]): void {
  plans = next
  planById = new Map(plans.map((p) => [p.id, p]))
}
