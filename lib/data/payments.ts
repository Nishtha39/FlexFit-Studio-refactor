import type { Payment, PaymentMethod, PaymentStatus } from "../types"
import { addDays, isoStamp, makeRng, NOW } from "../seed"
import { members } from "./members"
import { getPlan } from "./plans"

const rng = makeRng(0x9a1d0c)

const METHODS: (readonly [PaymentMethod, number])[] = [
  ["card", 5],
  ["upi", 4],
  ["cash", 2],
  ["transfer", 1],
]

// Status mix across the 60 primary rows — mostly paid, with realistic tails.
const STATUS: (readonly [PaymentStatus, number])[] = [
  ["paid", 44],
  ["pending", 6],
  ["failed", 5],
  ["refunded", 5],
]

const MONTH_LABEL = "Aug 2026"

function build(): Payment[] {
  const out: Payment[] = []
  let invoiceSeq = 4800
  let idSeq = 0

  for (let i = 0; i < 60; i++) {
    const member = rng.pick(members)
    const plan = getPlan(member.planId)
    const amount = plan ? (plan.interval === "annual" ? plan.price : plan.price) : rng.int(2000, 5000)
    const method = rng.weighted(METHODS)
    const status = rng.weighted(STATUS)
    const date = isoStamp(addDays(NOW, -rng.int(0, 120)))
    const invoiceId = `INV-${invoiceSeq++}`

    const payment: Payment = {
      id: `pay-${(++idSeq).toString().padStart(4, "0")}`,
      invoiceId,
      memberId: member.id,
      planId: member.planId,
      amount,
      method,
      status,
      date,
      description: `${plan?.name ?? "Membership"} — ${MONTH_LABEL}`,
      reversalOf: null,
    }
    out.push(payment)

    // A refund is a paired reversal row: the original stays on record and a
    // negative row references it, so the ledger always reconciles.
    if (status === "refunded") {
      out.push({
        id: `pay-${(++idSeq).toString().padStart(4, "0")}`,
        invoiceId: `${invoiceId}-R`,
        memberId: member.id,
        planId: member.planId,
        amount: -amount,
        method,
        status: "refunded",
        date: isoStamp(addDays(new Date(date), rng.int(1, 10))),
        description: `Refund — ${plan?.name ?? "Membership"} (${MONTH_LABEL})`,
        reversalOf: payment.id,
      })
    }
  }

  out.sort((a, b) => (a.date < b.date ? 1 : -1)) // newest first
  return out
}

// `let` + setPayments(): ESM live bindings. Taking a payment appends a row to
// the ledger in D1 and then swaps this array, so the member's billing tab, the
// invoice list and the revenue chart all move together. See lib/data/hydrate.ts.
export let payments: Payment[] = build()

export let paymentById = new Map(payments.map((p) => [p.id, p]))

export function paymentsForMember(memberId: string): Payment[] {
  return payments.filter((p) => p.memberId === memberId)
}

/** Failed + pending rows that need follow-up (dunning queue seed). */
export let outstandingPayments = payments.filter((p) => p.status === "failed" || p.status === "pending")

export function setPayments(next: Payment[]): void {
  payments = next
  paymentById = new Map(payments.map((p) => [p.id, p]))
  outstandingPayments = payments.filter((p) => p.status === "failed" || p.status === "pending")
}
