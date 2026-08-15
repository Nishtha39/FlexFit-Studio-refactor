import type { AppNotification } from "../types"
import { addDays, isoStamp, makeRng, NOW } from "../seed"
import { members } from "./members"
import { companies } from "./companies"
import { classes } from "./classes"
import { outstandingPayments } from "./payments"

const rng = makeRng(0x0011ce)

// Notifications are derived from the real generated data so deep-links resolve.
function build(): AppNotification[] {
  const out: AppNotification[] = []
  let seq = 0
  const at = (daysAgo: number, hour: number) => {
    const d = new Date(addDays(NOW, -daysAgo))
    d.setUTCHours(hour, rng.int(0, 59), 0, 0)
    return isoStamp(d)
  }
  const push = (n: Omit<AppNotification, "id">) => out.push({ id: `ntf-${(++seq).toString().padStart(3, "0")}`, ...n })

  // High-risk members entering the danger band.
  const highRisk = members.filter((m) => m.risk.band === "high" && m.status !== "cancelled" && m.status !== "expired")
  for (const m of rng.sample(highRisk, 3)) {
    push({
      kind: "retention",
      severity: "warning",
      title: "Member entered high risk",
      body: `${m.name} is now at risk ${m.risk.score}. ${m.risk.factors[0]?.detail ?? "Multiple factors"}.`,
      timestamp: at(rng.int(0, 2), rng.int(8, 18)),
      read: false,
      entity: { type: "member", id: m.id },
    })
  }

  // Failed / pending payments.
  for (const p of outstandingPayments.slice(0, 3)) {
    push({
      kind: "payment",
      severity: p.status === "failed" ? "critical" : "info",
      title: p.status === "failed" ? "Payment failed" : "Payment pending",
      body: `${p.invoiceId} · ₹${Math.abs(p.amount).toLocaleString("en-IN")} via ${p.method.toUpperCase()}.`,
      timestamp: at(rng.int(0, 4), rng.int(8, 18)),
      read: rng.bool(0.3),
      entity: { type: "payment", id: p.id },
    })
  }

  // Corporate pool near exhaustion.
  const acme = companies.find((c) => c.id === "co-acme")
  if (acme) {
    push({
      kind: "corporate",
      severity: "warning",
      title: "Corporate pool nearly exhausted",
      body: `${acme.name} has used ${Math.round((acme.creditsUsed / acme.poolCredits) * 100)}% of its credit pool.`,
      timestamp: at(1, 10),
      read: false,
      entity: { type: "company", id: acme.id },
    })
  }

  // A full class with a growing waitlist.
  const full = classes.find((c) => c.roster.length >= c.capacity && c.waitlist.length > 0)
  if (full) {
    push({
      kind: "class",
      severity: "info",
      title: "Class waitlist growing",
      body: `${full.name} is full with ${full.waitlist.length} on the waitlist. Consider adding a session.`,
      timestamp: at(2, 12),
      read: true,
      entity: { type: "class", id: full.id },
    })
  }

  // System note.
  push({
    kind: "system",
    severity: "info",
    title: "Weekly report ready",
    body: "Your retention and revenue summary for last week is available.",
    timestamp: at(3, 7),
    read: true,
    entity: null,
  })

  out.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
  return out
}

// `let` + setNotifications(): ESM live bindings, so marking one read updates the
// badge everywhere. See lib/data/hydrate.ts.
export let notifications: AppNotification[] = build()

export let unreadCount = notifications.filter((n) => !n.read).length

export function setNotifications(next: AppNotification[]): void {
  notifications = next
  unreadCount = notifications.filter((n) => !n.read).length
}
