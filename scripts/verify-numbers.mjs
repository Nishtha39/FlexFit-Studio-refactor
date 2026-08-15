/**
 * Cross-screen number verification.
 *
 *     pnpm verify:numbers
 *
 * The question this answers is "does the same fact have the same value
 * everywhere in the product?" — which is not what a type check or a render test
 * can tell you. A dashboard KPI, a report row and a detail page can each be
 * individually correct code and still disagree, because each one re-derives the
 * number by its own route.
 *
 * The method is deliberately adversarial: every assertion computes the value a
 * SECOND time, from the raw entities, by a different path from the one the app
 * uses — and then demands they match. A check that just called the app's own
 * function and compared it to itself would pass no matter what the function did.
 * Where a formula is definitional (straight-line depreciation) the check
 * restates the definition in arithmetic rather than calling the implementation.
 *
 * No network, no database, no browser. It bundles the real modules with esbuild
 * — the same trick scripts/dump-seed.mjs uses — so it tests the code that ships
 * rather than a copy of it.
 */
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()

let pass = 0
let fail = 0
const failures = []

function check(label, actual, expected, tolerance = 0) {
  const ok =
    typeof actual === 'number' && typeof expected === 'number'
      ? Math.abs(actual - expected) <= tolerance
      : actual === expected
  if (ok) {
    pass += 1
  } else {
    fail += 1
    failures.push({ label, actual, expected })
  }
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${ok ? '' : `\n         got ${actual}, expected ${expected}`}`)
}

function section(name) {
  console.log(`\n${name}`)
  console.log('-'.repeat(name.length))
}

/** Bundle a TS module (with @/ aliases) and import it. */
async function load(entry, outName) {
  const tmp = mkdtempSync(path.join(tmpdir(), 'flexfit-verify-'))
  const outfile = path.join(tmp, `${outName}.mjs`)
  await build({
    entryPoints: [path.join(root, entry)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    alias: { '@': root },
    logLevel: 'warning',
  })
  return import(pathToFileURL(outfile).href)
}

const data = await load('lib/data/index.ts', 'data')
const equip = await load('components/equipment/equipment-data.ts', 'equipment')
const dash = await load('components/dashboard/dashboard-data.ts', 'dashboard')
const billing = await load('components/billing/billing-data.ts', 'billing')
const trainers = await load('components/trainers/trainers-data.ts', 'trainers')
const corporate = await load('components/corporate/corporate-data.ts', 'corporate')
const rules = await load('server/domain/equipment-rules.ts', 'rules')

const { members, payments, classes, staff, plans, companies, equipment, equipmentServices, equipmentReservations, equipmentFaults, NOW } =
  data

const DAY = 86_400_000
const isoDate = (d) => new Date(d).toISOString().slice(0, 10)

/* ========================================================================== */
section('Membership roll-ups — dashboard vs a direct count')
/* ========================================================================== */

// "On the books" is defined as active + trial + frozen. Recount it here rather
// than reusing activeMembers, so a change to that filter shows up as a failure.
const onBooks = members.filter((m) => ['active', 'trial', 'frozen'].includes(m.status))
check('activeMembers matches a direct status count', data.activeMembers.length, onBooks.length)

const mrrDirect = onBooks.reduce((s, m) => s + m.metrics.monthlyValue, 0)
check('dashboard MRR = sum of monthlyValue over members on the books', dash.mrr, mrrDirect)

const cancelled30 = members.filter(
  (m) => m.status === 'cancelled' && m.endDate && new Date(m.endDate).getTime() >= NOW.getTime() - 30 * DAY,
).length
check(
  'dashboard churn rate = cancelled-in-30d / on-books × 100',
  dash.churnRate,
  onBooks.length > 0 ? (cancelled30 / onBooks.length) * 100 : 0,
  1e-9,
)

const seatsDirect = classes.reduce((s, c) => s + c.capacity, 0)
const bookedDirect = classes.reduce((s, c) => s + c.roster.length, 0)
check('dashboard fill rate = booked seats / capacity × 100', dash.fillRate, (bookedDirect / seatsDirect) * 100, 1e-9)

// The KPI strip renders these; if a tile stopped reading the same variable the
// headline and the number underneath it would part company.
const kpi = (id) => dash.kpis.find((k) => k.id === id)
check('KPI tile "mrr" carries the MRR value', kpi('mrr').value, dash.mrr)
check('KPI tile "members" carries the on-books count', kpi('members').value, onBooks.length)
check('KPI tile "churn" carries the churn rate', kpi('churn').value, dash.churnRate, 1e-9)
check('KPI tile "fill" carries the fill rate', kpi('fill').value, dash.fillRate, 1e-9)

const outstandingDirect = payments
  .filter((p) => p.status === 'failed' || p.status === 'pending')
  .reduce((s, p) => s + p.amount, 0)
check('KPI tile "outstanding" = sum of failed + pending payments', kpi('outstanding').value, outstandingDirect)
check(
  'outstandingPayments list matches the same filter',
  data.outstandingPayments.length,
  payments.filter((p) => p.status === 'failed' || p.status === 'pending').length,
)

/* ========================================================================== */
section('Ledger — an invoice is only ever a replay of payment rows')
/* ========================================================================== */

const primaries = payments.filter((p) => p.reversalOf === null)
check('one invoice per non-reversal payment row', billing.invoices.length, primaries.length)

// Gross, refunds and net must reconcile by replay — that is the whole reason
// the ledger is append-only.
const gross = primaries.reduce((s, p) => s + p.amount, 0)
const refunds = payments.filter((p) => p.reversalOf !== null).reduce((s, p) => s + p.amount, 0)
const netDirect = payments.reduce((s, p) => s + p.amount, 0)
check('gross + refunds = net over the whole ledger', gross + refunds, netDirect)
check('every reversal row is negative', payments.filter((p) => p.reversalOf !== null && p.amount >= 0).length, 0)
check(
  'every reversal points at a row that exists',
  payments.filter((p) => p.reversalOf !== null && !payments.some((o) => o.id === p.reversalOf)).length,
  0,
)

// GST: the invoice splits an inclusive amount into net + tax. They must add back
// to the amount exactly, with no rounding drift.
const gstDrift = billing.invoices.filter((i) => i.netAmount + i.taxAmount !== i.amount)
check('every invoice: net + tax = amount (no rounding drift)', gstDrift.length, 0)

const badTax = billing.invoices.filter((i) => i.netAmount !== Math.round(i.amount / (1 + billing.GST_RATE)))
check(`every invoice: net = amount / (1 + ${billing.GST_RATE}) rounded`, badTax.length, 0)

check(
  'invoice totals equal the payment rows they came from',
  billing.invoices.reduce((s, i) => s + i.amount, 0),
  gross,
)

/* ========================================================================== */
section('Trainers — the roster header vs the rows beneath it')
/* ========================================================================== */

const activeTrainerLoads = trainers.trainerLoads.filter((l) => l.trainer.active)
check(
  'active trainer count matches staff.active on role=trainer',
  activeTrainerLoads.length,
  staff.filter((s) => s.role === 'trainer' && s.active).length,
)
check(
  'trainerLoads covers every trainer, active or departed',
  trainers.trainerLoads.length,
  staff.filter((s) => s.role === 'trainer').length,
)

// Contact hours: the header sums them, each row shows its own.
const hoursDirect =
  activeTrainerLoads.reduce(
    (s, l) => s + classes.filter((c) => c.trainerId === l.trainer.id).reduce((x, c) => x + c.durationMin, 0),
    0,
  ) / 60
check('weekly contact hours = sum of class minutes / 60', activeTrainerLoads.reduce((s, l) => s + l.hours, 0), hoursDirect, 1e-9)

for (const load of trainers.trainerLoads) {
  const own = classes.filter((c) => c.trainerId === load.trainer.id)
  check(
    `${load.trainer.name}: seats = sum of class capacity`,
    load.seats,
    own.reduce((s, c) => s + c.capacity, 0),
  )
  check(
    `${load.trainer.name}: clients = members assigned to them`,
    load.clients.length,
    members.filter((m) => m.assignedTrainerId === load.trainer.id).length,
  )
  check(
    `${load.trainer.name}: client value = sum of their clients' monthlyValue`,
    load.monthlyValue,
    members.filter((m) => m.assignedTrainerId === load.trainer.id).reduce((s, m) => s + m.metrics.monthlyValue, 0),
  )
}

// `active` is defined as "no departure date" — the trainer toggle writes both,
// and a row that disagrees is the exact bug that definition exists to prevent.
check(
  'no staff row is active AND carries a departure date',
  staff.filter((s) => s.active && s.activeTo !== null).length,
  0,
)
check(
  'no staff row is inactive with no departure date',
  staff.filter((s) => !s.active && s.activeTo === null).length,
  0,
)

/* ========================================================================== */
section('Corporate pools')
/* ========================================================================== */

for (const pool of corporate.pools) {
  const company = companies.find((c) => c.id === pool.company.id)
  check(
    `${company.name}: utilisation = creditsUsed / poolCredits × 100`,
    pool.utilization,
    (company.creditsUsed / company.poolCredits) * 100,
    1e-9,
  )
  check(
    `${company.name}: remaining = poolCredits − creditsUsed`,
    pool.remaining,
    company.poolCredits - company.creditsUsed,
  )
  check(
    `${company.name}: employees = members pointing at the company`,
    pool.employees.length,
    members.filter((m) => m.companyId === company.id).length,
  )
}

/* ========================================================================== */
section('Equipment — book value, service dates, spend')
/* ========================================================================== */

check('every asset has a unique id', new Set(equipment.map((e) => e.id)).size, equipment.length)
check('every asset has a unique asset tag', new Set(equipment.map((e) => e.assetTag)).size, equipment.length)

const estate = equip.summarize(equipment)
check(
  'estate asset count = register length',
  estate.assets,
  equipment.length,
)
check(
  'estate unit count = sum of quantity over non-retired assets',
  estate.units,
  equipment.filter((e) => e.status !== 'retired').reduce((s, e) => s + e.quantity, 0),
)
check(
  'estate replacement cost = sum of unitCost × quantity',
  estate.replacementCost,
  equipment.filter((e) => e.status !== 'retired').reduce((s, e) => s + e.unitCost * e.quantity, 0),
)

// Straight-line depreciation, restated as arithmetic rather than by calling the
// implementation — otherwise this would be comparing a function to itself.
let bookMismatch = 0
for (const e of equipment) {
  const ageM = Math.max(0, Math.floor((NOW.getTime() - new Date(e.purchaseDate).getTime()) / DAY / 30.44))
  const remaining = Math.max(0, 1 - ageM / Math.max(1, e.usefulLifeMonths))
  const expected = Math.round(e.unitCost * e.quantity * remaining)
  if (equip.bookValue(e) !== expected) bookMismatch += 1
}
check('book value = cost × max(0, 1 − age/life), every asset', bookMismatch, 0)
check(
  'no asset is worth more than it cost',
  equipment.filter((e) => equip.bookValue(e) > e.unitCost * e.quantity).length,
  0,
)
check('no asset has a negative book value', equipment.filter((e) => equip.bookValue(e) < 0).length, 0)
check(
  'estate book value = sum of per-asset book values',
  estate.bookValue,
  equipment.filter((e) => e.status !== 'retired').reduce((s, e) => s + equip.bookValue(e), 0),
)

// Next service = last service (or purchase) + interval.
let serviceMismatch = 0
for (const e of equipment) {
  const from = new Date(`${e.lastServiceDate ?? e.purchaseDate}T00:00:00.000Z`).getTime()
  if (equip.nextServiceDate(e) !== isoDate(from + e.serviceIntervalDays * DAY)) serviceMismatch += 1
}
check('next service date = last service + interval, every asset', serviceMismatch, 0)

check(
  'overdue count matches assets whose next service is in the past',
  estate.overdue,
  equipment.filter((e) => e.status !== 'retired' && equip.nextServiceDate(e) < isoDate(NOW)).length,
)

// Nothing can have been serviced before it existed.
check(
  'no asset was serviced before it was purchased',
  equipment.filter((e) => e.lastServiceDate && e.lastServiceDate < e.purchaseDate).length,
  0,
)
check(
  'no service record predates its asset',
  equipmentServices.filter((s) => {
    const e = equipment.find((x) => x.id === s.equipmentId)
    return e && s.date < e.purchaseDate
  }).length,
  0,
)

// Lifetime spend includes the install row; maintenance excludes it. Both are
// plain sums, which is the property that makes the split safe.
let spendMismatch = 0
for (const e of equipment) {
  const own = equipmentServices.filter((s) => s.equipmentId === e.id)
  if (equip.lifetimeSpend(e) !== own.reduce((s, r) => s + r.cost, 0)) spendMismatch += 1
  if (
    equip.maintenanceSpend(e) !==
    own.filter((r) => r.kind !== 'install').reduce((s, r) => s + r.cost, 0)
  )
    spendMismatch += 1
}
check('lifetime spend and maintenance spend are plain sums of the service log', spendMismatch, 0)
check(
  'every asset has exactly one install row carrying its purchase cost',
  equipment.filter((e) => {
    const installs = equipmentServices.filter((s) => s.equipmentId === e.id && s.kind === 'install')
    return installs.length !== 1 || installs[0].cost !== e.unitCost * e.quantity
  }).length,
  0,
)
check(
  'estate 12-month maintenance excludes install rows',
  estate.maintenance12m,
  equipmentServices
    .filter((s) => s.kind !== 'install' && s.date >= isoDate(NOW.getTime() - 365 * DAY))
    .reduce((s, r) => s + r.cost, 0),
)

/* ========================================================================== */
section('Equipment status vs its fault log')
/* ========================================================================== */

// The invariant the router maintains: status is a function of the open faults.
let statusMismatch = 0
const offending = []
for (const e of equipment) {
  const open = equipmentFaults.filter((f) => f.equipmentId === e.id && f.status !== 'resolved')
  const expected = rules.statusForFaults(e.status, open.map((f) => f.severity))
  if (expected !== e.status) {
    statusMismatch += 1
    offending.push(`${e.assetTag} is ${e.status}, faults imply ${expected}`)
  }
}
check(
  `status agrees with the open fault log for every asset${offending.length ? ` (${offending[0]})` : ''}`,
  statusMismatch,
  0,
)
check(
  'no unsafe fault is open on an asset that is still on the floor',
  equipment.filter(
    (e) =>
      e.status !== 'out-of-service' &&
      e.status !== 'retired' &&
      equipmentFaults.some((f) => f.equipmentId === e.id && f.status !== 'resolved' && f.severity === 'unsafe'),
  ).length,
  0,
)
check(
  'every resolved fault has a resolution note and a timestamp',
  equipmentFaults.filter((f) => f.status === 'resolved' && (!f.resolvedAt || !f.resolutionNote)).length,
  0,
)
check(
  'no open fault carries a resolution',
  equipmentFaults.filter((f) => f.status !== 'resolved' && (f.resolvedAt || f.resolutionNote)).length,
  0,
)

/* ========================================================================== */
section('Equipment reservations — the clash rule')
/* ========================================================================== */

check(
  'no reservation exists against a non-bookable asset',
  equipmentReservations.filter((r) => {
    const e = equipment.find((x) => x.id === r.equipmentId)
    return e && !e.bookable
  }).length,
  0,
)

// The one that matters: at no instant may more live reservations overlap than
// the asset has units. Checked by sweeping every minute boundary rather than by
// reusing unitsFreeAt, so a bug in the overlap test cannot hide itself.
let overbooked = 0
let firstOverbook = ''
const byAssetDate = new Map()
for (const r of equipmentReservations) {
  if (r.status === 'cancelled') continue
  const key = `${r.equipmentId}|${r.date}`
  const list = byAssetDate.get(key) ?? []
  list.push(r)
  byAssetDate.set(key, list)
}
for (const [key, list] of byAssetDate) {
  const asset = equipment.find((e) => e.id === key.split('|')[0])
  if (!asset) continue
  const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  for (const probe of list) {
    const at = toMin(probe.startTime)
    const concurrent = list.filter((r) => {
      const s = toMin(r.startTime)
      return s <= at && at < s + r.durationMin
    }).length
    if (concurrent > asset.quantity) {
      overbooked += 1
      if (!firstOverbook) firstOverbook = `${asset.assetTag} on ${key.split('|')[1]} at ${probe.startTime}`
    }
  }
}
check(
  `no slot holds more reservations than the asset has units${firstOverbook ? ` (${firstOverbook})` : ''}`,
  overbooked,
  0,
)

// Every reservation lands on the asset's own slot grid, or the grid the member
// is shown stops describing what is bookable.
check(
  'every reservation starts on the asset slot grid inside opening hours',
  equipmentReservations.filter((r) => {
    const e = equipment.find((x) => x.id === r.equipmentId)
    if (!e) return false
    const start = Number(r.startTime.slice(0, 2)) * 60 + Number(r.startTime.slice(3, 5))
    return (
      (start - rules.DAY_OPENS_MIN) % e.slotMinutes !== 0 ||
      start < rules.DAY_OPENS_MIN ||
      start + r.durationMin > rules.DAY_CLOSES_MIN
    )
  }).length,
  0,
)

// The overlap primitive itself, on the case that a start-time comparison gets
// wrong: a 45-minute booking at 18:00 must block a slot starting at 18:30.
check(
  'overlap: 18:00+45min clashes with 18:30+45min',
  rules.overlaps({ start: 1080, end: 1125 }, { start: 1110, end: 1155 }),
  true,
)
check(
  'overlap: 18:00+30min does NOT clash with 18:30+30min (half-open)',
  rules.overlaps({ start: 1080, end: 1110 }, { start: 1110, end: 1140 }),
  false,
)

check(
  'utilisation never exceeds 100% on any asset/date',
  [...byAssetDate.keys()].filter((key) => {
    const [id, date] = key.split('|')
    const asset = equipment.find((e) => e.id === id)
    return asset && equip.utilizationOn(asset, date) > 100
  }).length,
  0,
)

/* ========================================================================== */
section('Plans and referential integrity')
/* ========================================================================== */

check(
  'every member points at a plan that exists',
  members.filter((m) => !plans.some((p) => p.id === m.planId)).length,
  0,
)
check(
  'every member with a trainer points at a real staff row',
  members.filter((m) => m.assignedTrainerId && !staff.some((s) => s.id === m.assignedTrainerId)).length,
  0,
)
check(
  'every payment points at a member that exists',
  payments.filter((p) => !members.some((m) => m.id === p.memberId)).length,
  0,
)
check(
  'every reservation points at a member that exists',
  equipmentReservations.filter((r) => !members.some((m) => m.id === r.memberId)).length,
  0,
)
check(
  'every fault points at an asset that exists',
  equipmentFaults.filter((f) => !equipment.some((e) => e.id === f.equipmentId)).length,
  0,
)

// Unlimited plans carry null, not 0 — the difference decides whether a member on
// zero credits can keep booking.
check(
  'unlimited plans carry null visitsPerMonth, never 0',
  plans.filter((p) => p.visitsPerMonth === 0).length,
  0,
)
check(
  'no member on a capped plan has negative credits',
  members.filter((m) => m.metrics.creditsRemaining !== null && m.metrics.creditsRemaining < 0).length,
  0,
)

/* ========================================================================== */
section('Attendance aggregates vs the check-in rows')
/* ========================================================================== */

const matrix = data.hourWeekdayMatrix()
const matrixTotal = matrix.flat().reduce((s, n) => s + n, 0)
check('heatmap total = number of check-ins', matrixTotal, data.checkIns.length)
check('dashboard heatmap is the same matrix', dash.heatmap.flat().reduce((s, n) => s + n, 0), matrixTotal)

/**
 * THE ONE THAT CAUGHT A REAL BUG.
 *
 * `dailyAttendance` and `checkIns` used to be two independent generators, and
 * nothing compared them: the dashboard's "Visits · 30 days" tile read 4,721 off
 * the daily series while the heatmap immediately beneath it summed 2,703 actual
 * check-in rows. Same screen, same claimed fact, 75% apart.
 *
 * The daily series is now counted from the events over the window they share.
 * The older tail is still modelled — there are no rows back there to count —
 * so the comparison is scoped to the window where both exist, which is also the
 * only window any screen sums them over.
 */
const seam = isoDate(NOW.getTime() - 364 * DAY)
const dailyRecent = data.dailyAttendance.filter((d) => d.date >= seam).reduce((s, d) => s + d.count, 0)
const checkInsRecent = data.checkIns.filter((c) => c.date >= seam).length
check('daily attendance = counted check-ins over the window they share', dailyRecent, checkInsRecent)

// The user-visible version of the same invariant: the KPI tile and the rows.
// The tile sums the LAST 30 ENTRIES of the series, which is the 30 days ending
// today inclusive — so the window is NOW-29..NOW, not NOW-30..NOW. Getting that
// boundary wrong here would make a correct tile look broken by exactly one day.
const last30 = isoDate(NOW.getTime() - 29 * DAY)
check(
  'dashboard "Visits · 30 days" tile = actual check-ins in those 30 days',
  kpi('attendance').value,
  data.checkIns.filter((c) => c.date >= last30).length,
)
check(
  'attendance 30d + prev 30d never exceeds the whole series',
  dash.attendance30 + dash.attendancePrev30 <= data.dailyAttendance.reduce((s, d) => s + d.count, 0),
  true,
)
check('no day in the counted window has a negative count', data.dailyAttendance.filter((d) => d.count < 0).length, 0)

/* ========================================================================== */

console.log(`\n${'='.repeat(60)}`)
console.log(`${pass} passed, ${fail} failed`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  · ${f.label}\n      got ${f.actual}, expected ${f.expected}`)
}
console.log('='.repeat(60))
process.exit(fail > 0 ? 1 : 0)
