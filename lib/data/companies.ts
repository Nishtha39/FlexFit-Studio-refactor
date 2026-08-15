import type { Company } from "../types"

// 3 corporate credit pools. employeeMemberIds is populated by members.ts
// (one-directional import: members -> companies) to avoid an import cycle.
// Acme is deliberately near-exhausted to drive the burn-rate warning UI.
// `let` + setCompanies(): ESM live bindings. See lib/data/hydrate.ts.
export let companies: Company[] = [
  {
    id: "co-northwind",
    name: "Northwind Analytics",
    contactName: "Grace Liu",
    contactEmail: "grace.liu@northwind.example",
    planId: "plan-corporate",
    poolCredits: 480,
    creditsUsed: 214,
    burnRatePerWeek: 22,
    employeeMemberIds: [],
    startDate: "2025-01-06",
    renewalDate: "2026-01-06",
  },
  {
    id: "co-acme",
    name: "Acme Logistics",
    contactName: "Devon Park",
    contactEmail: "devon.park@acme.example",
    planId: "plan-corporate",
    poolCredits: 300,
    creditsUsed: 277, // ~92% — near-exhausted
    burnRatePerWeek: 19,
    employeeMemberIds: [],
    startDate: "2025-09-01",
    renewalDate: "2026-09-01",
  },
  {
    id: "co-meridian",
    name: "Meridian Health",
    contactName: "Sana Iqbal",
    contactEmail: "sana.iqbal@meridian.example",
    planId: "plan-corporate",
    poolCredits: 600,
    creditsUsed: 118,
    burnRatePerWeek: 14,
    employeeMemberIds: [],
    startDate: "2026-03-15",
    renewalDate: "2027-03-15",
  },
]

export let companyById = new Map(companies.map((c) => [c.id, c]))

export function getCompany(id: string): Company | undefined {
  return companyById.get(id)
}

/** Fraction of the pool consumed (0..1). */
export function poolUtilization(c: Company): number {
  return c.poolCredits === 0 ? 0 : c.creditsUsed / c.poolCredits
}

/** Estimated weeks until the pool is exhausted at current burn rate. */
export function weeksToExhaustion(c: Company): number {
  const remaining = Math.max(0, c.poolCredits - c.creditsUsed)
  return c.burnRatePerWeek === 0 ? Infinity : remaining / c.burnRatePerWeek
}

export function setCompanies(next: Company[]): void {
  companies = next
  companyById = new Map(companies.map((c) => [c.id, c]))
}
