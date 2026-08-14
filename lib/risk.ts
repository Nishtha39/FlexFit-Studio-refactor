// Churn-risk scoring. Pure functions only — no data imports, so members.ts can
// call this without creating a cycle. The score is additive from named factors,
// which lets the UI render an honest "78 → its causes" contribution breakdown.

import type { RiskBand, RiskFactor, RiskInput, RiskResult } from "./types"

export function bandForScore(score: number): RiskBand {
  if (score >= 70) return "high"
  if (score >= 40) return "medium"
  return "low"
}

export const RISK_BAND_META: Record<RiskBand, { label: string; range: string }> = {
  low: { label: "Low", range: "0–39" },
  medium: { label: "Watch", range: "40–69" },
  high: { label: "High", range: "70–100" },
}

/**
 * Compute a 0–100 churn-risk score and the factors that produced it.
 * Only factors that actually contributed (points > 0) are returned, sorted
 * by impact, so the breakdown always reconciles to the total.
 */
export function computeRisk(input: RiskInput): RiskResult {
  const factors: RiskFactor[] = []

  // 1. Inactivity — the single strongest churn signal.
  if (input.daysSinceLastVisit === null) {
    factors.push({
      key: "inactivity",
      label: "No recorded visits",
      points: 34,
      detail: "Member has never checked in",
    })
  } else {
    const d = input.daysSinceLastVisit
    let pts = 0
    let detail = ""
    if (d >= 28) {
      pts = 34
      detail = `${d} days since last visit`
    } else if (d >= 21) {
      pts = 28
      detail = `${d} days since last visit`
    } else if (d >= 14) {
      pts = 20
      detail = `${d} days since last visit`
    } else if (d >= 7) {
      pts = 9
      detail = `${d} days since last visit`
    }
    if (pts > 0) factors.push({ key: "inactivity", label: "Extended inactivity", points: pts, detail })
  }

  // 2. Falling attendance vs the prior month.
  if (input.visitsPrev30 > 0) {
    const drop = (input.visitsPrev30 - input.visitsLast30) / input.visitsPrev30
    if (drop > 0.25) {
      const pts = Math.min(20, Math.round(drop * 24))
      factors.push({
        key: "frequency-drop",
        label: "Attendance declining",
        points: pts,
        detail: `Down from ${input.visitsPrev30} to ${input.visitsLast30} visits/mo`,
      })
    }
  }

  // 3. Under-using a limited plan (paying for more than they use).
  if (input.planVisitsPerMonth !== null && input.planVisitsPerMonth > 0) {
    const utilization = input.visitsLast30 / input.planVisitsPerMonth
    if (utilization < 0.4) {
      const pts = utilization < 0.2 ? 14 : 9
      factors.push({
        key: "low-utilization",
        label: "Low plan utilization",
        points: pts,
        detail: `Used ${input.visitsLast30} of ${input.planVisitsPerMonth} monthly visits`,
      })
    }
  }

  // 4. Billing friction.
  if (input.failedPayments > 0) {
    const pts = Math.min(20, input.failedPayments * 9)
    factors.push({
      key: "billing",
      label: "Billing issues",
      points: pts,
      detail: `${input.failedPayments} failed payment${input.failedPayments > 1 ? "s" : ""} on record`,
    })
  }

  // 5. Frequent cancellations.
  if (input.cancelRate > 0.3) {
    const pts = Math.min(12, Math.round((input.cancelRate - 0.3) * 40) + 5)
    factors.push({
      key: "cancellations",
      label: "High cancellation rate",
      points: pts,
      detail: `${Math.round(input.cancelRate * 100)}% of bookings cancelled`,
    })
  }

  // 6. Early tenure — new members haven't built the habit yet.
  if (input.status !== "cancelled" && input.status !== "expired" && input.tenureMonths < 3) {
    const pts = input.tenureMonths < 1 ? 9 : 6
    factors.push({
      key: "tenure",
      label: "Early tenure",
      points: pts,
      detail: `Only ${input.tenureMonths} month${input.tenureMonths === 1 ? "" : "s"} in`,
    })
  }

  // 7. Repeated freezes.
  if (input.freezeCount > 0) {
    const pts = Math.min(10, input.freezeCount * 5)
    factors.push({
      key: "freezes",
      label: "Membership freezes",
      points: pts,
      detail: `Frozen ${input.freezeCount} time${input.freezeCount > 1 ? "s" : ""}`,
    })
  }

  const rawScore = factors.reduce((s, f) => s + f.points, 0)
  const score = Math.max(0, Math.min(100, rawScore))
  factors.sort((a, b) => b.points - a.points)

  return { score, band: bandForScore(score), factors }
}
