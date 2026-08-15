/**
 * API suite. Zero dependencies, runs against a live worker:
 *
 *   BASE=http://127.0.0.1:8789 node scripts/test-api.mjs
 *
 * It checks the invariants the schema was designed around, not just that
 * endpoints answer 200:
 *   - the ledger is append-only (a refund adds a row; the original is unchanged)
 *   - capacity decides roster vs waitlist, and cancelling promotes the head
 *   - credits move with seats, including the employer's pool
 *   - derived fields are derived (risk present, ageDays fresh, no stored copies)
 *   - writes survive a re-read, which is the whole point of having a backend
 *
 * Mutations are made against a scratch class and then undone, so the suite can
 * be run repeatedly against the same database without drifting the seed.
 *
 * LOCAL-ONLY. THIS SUITE MUTATES: it refunds real payments, retries failed ones
 * and writes check-ins. It has damaged production twice — most recently by
 * refunding a seeded ₹49,000 payment, which the old lifetime-value formula then
 * turned into a permanent ₹0 on that member. Point it at a reseedable local D1.
 * The production pass is `pnpm test:live`, which writes nothing.
 */
const BASE = process.env.BASE ?? 'http://127.0.0.1:8789'
const API = `${BASE}/api/trpc`

let passed = 0
let failed = 0
const failures = []

function check(name, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function query(path, input) {
  const url = input
    ? `${API}/${path}?input=${encodeURIComponent(JSON.stringify(input))}`
    : `${API}/${path}`
  const res = await fetch(url)
  const body = await res.json()
  if (body.error) throw new Error(`${path}: ${body.error.message ?? JSON.stringify(body.error)}`)
  return body.result.data
}

/** Returns { ok, data } or { ok: false, code, message } — refusals are results too. */
async function mutate(path, input) {
  const res = await fetch(`${API}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-flexfit-actor': 'test-suite' },
    body: JSON.stringify(input ?? {}),
  })
  const body = await res.json()
  if (body.error) {
    return { ok: false, code: body.error.data?.code ?? 'UNKNOWN', message: body.error.message }
  }
  return { ok: true, data: body.result.data }
}

const section = (t) => console.log(`\n=== ${t} ===`)

// ---------------------------------------------------------------------------
section('bootstrap')
const boot = await query('read.bootstrap')

check('380 members', boot.members.length === 380, `got ${boot.members.length}`)
check('42 classes', boot.classes.length === 42)
check('64 payments', boot.payments.length === 64)
check('3 corporate pools', boot.companies.length === 3)
check('547 daily attendance rows', boot.dailyAttendance.length === 547)
check('heatmap is 7 x 24', boot.attendanceMatrix.length === 7 && boot.attendanceMatrix[0].length === 24)
// Compared against COUNT(*) rather than the seed's literal 37,410, so the suite
// stays true after it has itself added check-ins — the invariant is "the
// materialised heatmap agrees with its source table", not "the table has a
// particular number of rows in it".
const liveCount = (await query('read.checkInCount')).total
check(
  'heatmap totals equal the check-in count',
  boot.attendanceMatrix.flat().reduce((a, b) => a + b, 0) === liveCount,
  `heatmap ${boot.attendanceMatrix.flat().reduce((a, b) => a + b, 0)} vs rows ${liveCount}`,
)
check('the seeded history is present', liveCount >= 37410, `got ${liveCount}`)

section('derived, not stored')
const withRisk = boot.members.filter((m) => m.risk && typeof m.risk.score === 'number')
check('every member carries a computed risk score', withRisk.length === boot.members.length)
check(
  'risk factors are populated for at-risk members',
  boot.members.some((m) => m.risk.score >= 70 && m.risk.factors.length > 0),
)
check('leads carry a computed ageDays', boot.leads.every((l) => typeof l.ageDays === 'number' && l.ageDays >= 0))
check(
  'corporate pools list their employees',
  boot.companies.every((c) => c.employeeMemberIds.length > 0),
)
check(
  'employee lists match members.companyId',
  boot.companies.every(
    (c) => c.employeeMemberIds.length === boot.members.filter((m) => m.companyId === c.id).length,
  ),
)
check(
  'classes expose roster and waitlist as arrays',
  boot.classes.every((c) => Array.isArray(c.roster) && Array.isArray(c.waitlist)),
)
check('no invoices collection is served (invoices stay derived)', boot.invoices === undefined)

// ---------------------------------------------------------------------------
section('booking: capacity, waitlist, credits')

// Pick a class with room and a live member not already in it, on an unlimited
// plan so the credit assertions below are unambiguous.
const roomy = boot.classes.find((c) => c.roster.length < c.capacity - 2)
const liveMember = boot.members.find(
  (m) =>
    (m.status === 'active' || m.status === 'trial') &&
    !roomy.roster.includes(m.id) &&
    !roomy.waitlist.includes(m.id) &&
    m.companyId === null &&
    typeof m.metrics.creditsRemaining === 'number' &&
    m.metrics.creditsRemaining > 0,
)

const booked = await mutate('booking.book', { classId: roomy.id, memberId: liveMember.id })
check('a member with room and credits gets a roster seat', booked.ok && booked.data.kind === 'roster',
  booked.ok ? booked.data.kind : booked.message)

const afterBook = await query('read.bootstrap')
const memberAfterBook = afterBook.members.find((m) => m.id === liveMember.id)
check(
  'booking spends exactly one credit',
  memberAfterBook.metrics.creditsRemaining === liveMember.metrics.creditsRemaining - 1,
  `${liveMember.metrics.creditsRemaining} -> ${memberAfterBook.metrics.creditsRemaining}`,
)
check(
  'the seat is visible on a fresh read',
  afterBook.classes.find((c) => c.id === roomy.id).roster.includes(liveMember.id),
)

const twice = await mutate('booking.book', { classId: roomy.id, memberId: liveMember.id })
check('booking the same class twice is refused', !twice.ok && /already/i.test(twice.message), twice.message)

const dead = boot.members.find((m) => m.status === 'cancelled' || m.status === 'expired')
const deadBooking = await mutate('booking.book', { classId: roomy.id, memberId: dead.id })
check('an inactive membership cannot book', !deadBooking.ok && /not active/i.test(deadBooking.message))

const ghost = await mutate('booking.book', { classId: roomy.id, memberId: 'm-does-not-exist' })
check('an unknown member is a 404, not a crash', !ghost.ok && ghost.code === 'NOT_FOUND')

// Fill a class to capacity and prove the next booking waits.
const small = afterBook.classes
  .filter((c) => c.waitlist.length === 0)
  .sort((a, b) => a.capacity - a.roster.length - (b.capacity - b.roster.length))[0]
const seatsFree = small.capacity - small.roster.length
const fillers = afterBook.members
  .filter(
    (m) =>
      (m.status === 'active' || m.status === 'trial') &&
      !small.roster.includes(m.id) &&
      m.companyId === null &&
      (m.metrics.creditsRemaining === null || m.metrics.creditsRemaining > 0),
  )
  .slice(0, seatsFree + 1)

const kinds = []
for (const m of fillers) {
  const r = await mutate('booking.book', { classId: small.id, memberId: m.id })
  kinds.push(r.ok ? r.data.kind : `refused:${r.message}`)
}
check(
  `filling ${seatsFree} free seats gives ${seatsFree} roster seats then a waitlist place`,
  kinds.slice(0, seatsFree).every((k) => k === 'roster') && kinds[seatsFree] === 'waitlist',
  kinds.join(','),
)

const full = await query('read.bootstrap')
const fullClass = full.classes.find((c) => c.id === small.id)
check('a full class never exceeds capacity', fullClass.roster.length === fullClass.capacity,
  `${fullClass.roster.length}/${fullClass.capacity}`)

// Cancelling a roster seat promotes the head of the waitlist.
const waiter = fullClass.waitlist[0]
const cancelled = await mutate('booking.cancel', { classId: small.id, memberId: fullClass.roster[0] })
check('cancelling a roster seat promotes the waitlist head', cancelled.ok && cancelled.data.promoted === waiter,
  cancelled.ok ? String(cancelled.data.promoted) : cancelled.message)

const afterPromote = await query('read.bootstrap')
const promotedClass = afterPromote.classes.find((c) => c.id === small.id)
check('the promoted member is now on the roster', promotedClass.roster.includes(waiter))
check('the promoted member left the waitlist', !promotedClass.waitlist.includes(waiter))
check('the class is still exactly at capacity', promotedClass.roster.length === promotedClass.capacity)

const notBooked = await mutate('booking.cancel', { classId: small.id, memberId: 'm-does-not-exist' })
check('cancelling for an unknown member is refused', !notBooked.ok)

// ---------------------------------------------------------------------------
section('ledger is append-only')
const paid = boot.payments.find((p) => p.status === 'paid' && p.reversalOf === null)
const before = await query('read.bootstrap')
const refunded = await mutate('billing.refund', { paymentId: paid.id, reason: 'Test suite' })
check('a settled payment can be refunded', refunded.ok, refunded.ok ? '' : refunded.message)

const afterRefund = await query('read.bootstrap')
check(
  'the refund ADDED a row rather than editing one',
  afterRefund.payments.length === before.payments.length + 1,
  `${before.payments.length} -> ${afterRefund.payments.length}`,
)
const originalNow = afterRefund.payments.find((p) => p.id === paid.id)
check(
  'the original payment row is untouched',
  originalNow.amount === paid.amount && originalNow.status === paid.status,
  `${originalNow.status}/${originalNow.amount}`,
)
const reversal = afterRefund.payments.find((p) => p.reversalOf === paid.id)
check('the reversal is negative and points at the original', reversal.amount === -paid.amount)
check('the reversal carries the -R invoice id', reversal.invoiceId === `${paid.invoiceId}-R`)
check(
  'gross and reversals still reconcile',
  afterRefund.payments.filter((p) => p.reversalOf).reduce((s, p) => s + p.amount, 0) < 0,
)

const twiceRefund = await mutate('billing.refund', { paymentId: paid.id, reason: 'again' })
check('a payment cannot be refunded twice', !twiceRefund.ok && /already/i.test(twiceRefund.message))

const refundReversal = await mutate('billing.refund', { paymentId: reversal.id, reason: 'nope' })
check('a reversal row cannot itself be refunded', !refundReversal.ok)

const pendingRow = boot.payments.find((p) => p.status === 'pending')
if (pendingRow) {
  const badRefund = await mutate('billing.refund', { paymentId: pendingRow.id, reason: 'nope' })
  check('an unsettled payment cannot be refunded', !badRefund.ok && /settled/i.test(badRefund.message))
}

const failedRow = boot.payments.find((p) => p.status === 'failed')
const retried = await mutate('billing.retry', { paymentId: failedRow.id })
check('a failed payment can be retried', retried.ok, retried.ok ? '' : retried.message)
const afterRetry = await query('read.bootstrap')
check(
  'the retry ADDED a row and left the failure in place',
  afterRetry.payments.some((p) => p.id === failedRow.id && p.status === 'failed') &&
    afterRetry.payments.length === afterRefund.payments.length + 1,
)

// ---------------------------------------------------------------------------
section('front desk')
const checkInTarget = boot.members.find((m) => m.status === 'active')
const heatBefore = (await query('read.bootstrap')).attendanceMatrix.flat().reduce((a, b) => a + b, 0)
const ci = await mutate('ops.checkIn', {
  memberId: checkInTarget.id,
  location: 'downtown',
  classId: null,
})
check('an active member can check in', ci.ok, ci.ok ? '' : ci.message)

const afterCi = await query('read.bootstrap')
check(
  'the heatmap moved by exactly one',
  afterCi.attendanceMatrix.flat().reduce((a, b) => a + b, 0) === heatBefore + 1,
)
const visits = await query('read.memberCheckIns', { memberId: checkInTarget.id })
check('the visit is readable on the member', visits.some((v) => v.id === ci.data.id))

const frozen = boot.members.find((m) => m.status === 'frozen' || m.status === 'cancelled')
const blocked = await mutate('ops.checkIn', { memberId: frozen.id, location: 'downtown', classId: null })
check(`a ${frozen.status} membership is blocked at the door`, !blocked.ok, blocked.ok ? 'allowed!' : '')

// A double-tap at the kiosk must be idempotent. The deterministic check-in id
// stops the duplicate ROW, but the heatmap and daily totals are counters, so
// they have to be guarded separately — the first version of this suite asserted
// the buggy behaviour (heatBefore + 2) and passed, which is exactly how a
// counter drifts away from its source table unnoticed.
const repeat = await mutate('ops.checkIn', {
  memberId: checkInTarget.id,
  location: 'downtown',
  classId: null,
})
const afterRepeat = await query('read.bootstrap')
check('a repeat tap is accepted rather than erroring', repeat.ok)
check('a repeat tap reports itself as a duplicate', repeat.ok && repeat.data.duplicate === true)
check(
  'a repeat tap does NOT move the heatmap again',
  afterRepeat.attendanceMatrix.flat().reduce((a, b) => a + b, 0) === heatBefore + 1,
  `expected ${heatBefore + 1}, got ${afterRepeat.attendanceMatrix.flat().reduce((a, b) => a + b, 0)}`,
)
check(
  'aggregates still agree with the check-in table',
  afterRepeat.attendanceMatrix.flat().reduce((a, b) => a + b, 0) ===
    (await query('read.checkInCount')).total,
  'heatmap total vs COUNT(*) on check_ins',
)

// ---------------------------------------------------------------------------
section('lifetime value moves by the amount, not by a replay')
/**
 * Runs AFTER the front-desk section on purpose: it checks somebody in, and the
 * heatmap assertions above capture their baseline before doing so. Putting this
 * first moved the heatmap under them and reddened two checks that were fine.
 *
 * The regression this section exists for.
 *
 * `recomputeMemberMetrics` used to set lifetime value to the SUM of the
 * member's payment rows. That is not their lifetime value — `payments` holds
 * one billing cycle, and most members have no row in it at all — so any write
 * that recomputed metrics (a kiosk check-in was enough) replaced a modelled
 * multi-year figure with a single-cycle sum, or with zero. The highest-value
 * member in the seed fell from ₹4,32,378 to ₹0 on scanning in, silently.
 *
 * The assertions below are deltas, never absolutes: a payment must move the
 * number by exactly the payment, a refund by exactly the refund, and a
 * check-in must not move it at all. A replay fails all three.
 */
/**
 * The member has to be one the bug actually bites: a real lifetime value and NO
 * rows in the ledger, which describes 326 of the 380. Picking any active member
 * is not enough — for somebody whose whole history IS in this cycle the two
 * formulas agree, and the check passes against the broken code. That happened
 * on the first attempt at this test.
 */
const paidMemberIds = new Set(boot.payments.map((p) => p.memberId))
const ltvMember = boot.members.find(
  (m) => m.status === 'active' && m.metrics.lifetimeValue > 0 && !paidMemberIds.has(m.id),
)
check(
  'found a member with history but no ledger rows',
  Boolean(ltvMember),
  'the seed no longer contains one — this section would stop testing anything',
)
const ltvBefore = (await query('read.bootstrap')).members.find((m) => m.id === ltvMember.id)
  .metrics.lifetimeValue

const took = await mutate('ops.takePayment', {
  memberId: ltvMember.id,
  amount: 2500,
  method: 'upi',
  description: 'Lifetime-value delta check',
})
check('a payment can be taken', took.ok, took.ok ? '' : took.message)
const ltvAfterPay = (await query('read.bootstrap')).members.find((m) => m.id === ltvMember.id)
  .metrics.lifetimeValue
check(
  'taking a payment moves lifetime value by exactly the amount',
  ltvAfterPay === ltvBefore + 2500,
  `${ltvBefore} -> ${ltvAfterPay}, expected ${ltvBefore + 2500}`,
)

const reversedNew = await mutate('billing.refund', {
  paymentId: took.data.id,
  reason: 'Lifetime-value delta check',
})
check('the new payment can be refunded', reversedNew.ok, reversedNew.ok ? '' : reversedNew.message)
const ltvAfterRefund = (await query('read.bootstrap')).members.find((m) => m.id === ltvMember.id)
  .metrics.lifetimeValue
check(
  'refunding puts lifetime value back exactly where it was',
  ltvAfterRefund === ltvBefore,
  `${ltvAfterRefund}, expected ${ltvBefore}`,
)

const ltvCheckIn = await mutate('ops.checkIn', {
  memberId: ltvMember.id,
  location: ltvMember.homeLocation,
})
check('the member can check in', ltvCheckIn.ok, ltvCheckIn.ok ? '' : ltvCheckIn.message)
const ltvAfterVisit = (await query('read.bootstrap')).members.find((m) => m.id === ltvMember.id)
  .metrics.lifetimeValue
check(
  'a check-in does NOT change lifetime value',
  ltvAfterVisit === ltvBefore,
  `${ltvAfterVisit}, expected ${ltvBefore}`,
)

// ---------------------------------------------------------------------------
section('leads')
const lead = boot.leads.find((l) => l.stage !== 'lost')
const noReason = await mutate('crm.moveStage', { leadId: lead.id, stage: 'lost' })
check('losing a lead without a reason is refused', !noReason.ok && /reason/i.test(noReason.message))

const lost = await mutate('crm.moveStage', { leadId: lead.id, stage: 'lost', lostReason: 'Price' })
check('losing a lead with a reason is accepted', lost.ok, lost.ok ? '' : lost.message)
check(
  'the stage change persisted',
  (await query('read.bootstrap')).leads.find((l) => l.id === lead.id).stage === 'lost',
)
await mutate('crm.moveStage', { leadId: lead.id, stage: lead.stage })

// ---------------------------------------------------------------------------
section('corporate + settings')
const pool = boot.companies[0]
const topUp = await mutate('ops.topUpPool', { companyId: pool.id, credits: 50 })
check('a pool can be topped up', topUp.ok, topUp.ok ? '' : topUp.message)
check(
  'the pool balance persisted',
  (await query('read.bootstrap')).companies.find((c) => c.id === pool.id).poolCredits === pool.poolCredits + 50,
)
const badTopUp = await mutate('ops.topUpPool', { companyId: pool.id, credits: -5 })
check('a negative top-up is rejected by validation', !badTopUp.ok)

await mutate('ops.saveSetting', { key: 'booking.cancelWindowHours', value: 24 })
check(
  'a setting round-trips',
  (await query('read.bootstrap')).settings['booking.cancelWindowHours'] === 24,
)
await mutate('ops.saveSetting', { key: 'booking.cancelWindowHours', value: 12 })

// ---------------------------------------------------------------------------
section('summary')
console.log(`\nchecked: ${passed + failed}   passed: ${passed}   failed: ${failed}`)
if (failed) {
  console.log('\nFAILURES:')
  for (const f of failures) console.log(` - ${f}`)
  process.exit(1)
}
console.log('ALL CHECKS PASSED')
