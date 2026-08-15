/**
 * Read-only real-browser pass, safe to point at production.
 *
 *     node scripts/test-live-readonly.mjs https://flexfit-studio.…workers.dev
 *
 * `test-buttons-ui.mjs` proves the buttons write, and it does that by writing:
 * payments, plan prices, a reassigned class, a renamed location. That is fine
 * against a reseedable local D1 and **must never be pointed at production**,
 * where several of those are not trivially reversible — a plan price change
 * moves the MRR reports, and a class reassignment moves a real trainer's
 * timetable.
 *
 * So this is the production-safe half: it opens every screen the change set
 * touched, proves the app actually reached the API (rather than quietly falling
 * back to the built-in sample data), and asserts that the newly-wired controls
 * are present and ENABLED — which is the observable difference between a button
 * that is wired and one that is not, without pressing it.
 *
 * It presses nothing that writes.
 */
import { chromium } from 'playwright'

const BASE = (process.argv[2] ?? 'http://127.0.0.1:8788').replace(/\/$/, '')

let pass = 0
let fail = 0
const failures = []
const consoleErrors = []

function check(label, ok, detail = '') {
  if (ok) {
    pass += 1
    console.log(`  ok   ${label}`)
  } else {
    fail += 1
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`)
    console.log(` FAIL  ${label}${detail ? `\n         ${detail}` : ''}`)
  }
}

function section(name) {
  console.log(`\n${name}\n${'-'.repeat(name.length)}`)
}

async function waitFor(fn, timeoutMs = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await fn()) return true
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })

/**
 * Open a screen and confirm the store is live.
 *
 * The offline banner is the honest signal that `/api/trpc` did not answer. If it
 * is showing, every write button is correctly disabled — so checking that a
 * button is enabled would be checking the wrong thing, and the run must say so
 * rather than quietly reporting disabled buttons as a product fault.
 */
async function open(path) {
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`${path}: ${m.text()}`)
  })
  page.on('pageerror', (e) => consoleErrors.push(`${path} pageerror: ${e.message}`))
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('h1', { timeout: 30000 })
  const offline = await waitFor(
    async () => (await page.locator('body').innerText().catch(() => '')).includes('Working from the built-in sample data'),
    3000,
  )
  check(`${path} reached the API`, !offline, offline ? 'offline banner is showing' : '')
  return page
}

/** A wired control is present AND enabled. Never clicked here. */
async function expectEnabled(page, label, re) {
  const btn = page.locator('button', { hasText: re }).first()
  const there = await waitFor(async () => (await btn.count()) > 0, 15000)
  if (!there) return check(label, false, 'button not found')
  const enabled = await waitFor(async () => await btn.isEnabled().catch(() => false), 15000)
  check(label, enabled, 'present but never became enabled')
}

try {
  section('The screens load against the live API')
  const dash = await open('/dashboard')
  // The attention queue's actions are the ones that now persist.
  await expectEnabled(dash, 'dashboard attention queue offers a live action', /Chase|Call|Review|Assign|Top up|Email|Fix|Open/)
  await dash.close()

  const members = await open('/members')
  await expectEnabled(members, 'members directory offers Add member', /^Add member$/)
  await members.close()

  const leads = await open('/leads')
  await expectEnabled(leads, 'leads board offers Add lead', /^Add lead$/)
  await leads.close()

  const notif = await open('/notifications')
  await expectEnabled(notif, 'notifications offers Mark all read', /^Mark all read$/)
  await notif.close()

  const invoices = await open('/billing')
  await expectEnabled(invoices, 'billing offers New invoice', /^New invoice$/)
  await expectEnabled(invoices, 'billing offers Export', /^Export$/)
  await invoices.close()

  const plans = await open('/billing/plans')
  check(
    'the plan builder renders its price field',
    (await plans.locator('#plan-price').count()) > 0,
  )
  await plans.close()

  const retention = await open('/retention')
  await expectEnabled(retention, 'retention queue offers Done', /^Done$/)
  await retention.close()

  const settings = await open('/settings')
  await expectEnabled(settings, 'settings offers Edit on a location', /^Edit$/)
  await settings.close()

  const trainers = await open('/trainers')
  await trainers.close()

  const schedule = await open('/schedule')
  await schedule.close()

  const equipment = await open('/equipment')
  await equipment.close()

  const reports = await open('/reports/revenue-by-plan')
  await expectEnabled(reports, 'a report offers a real CSV export', /^CSV$/)
  await reports.close()

  section('Data actually arrived')
  const page = await ctx.newPage()
  // Navigate first: a blank page has origin "null", so a fetch from it is not
  // same-origin and is refused. That cost a false failure here.
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' })
  const boot = await page.evaluate(async (base) => {
    const r = await fetch(`${base}/api/trpc/read.bootstrap`)
    const j = await r.json()
    return j.result.data
  }, BASE).catch(() => null)
  check('bootstrap is readable from the browser', boot !== null)
  if (boot) {
    check('member notes are served', Array.isArray(boot.memberNotes) && boot.memberNotes.length > 0, `${boot.memberNotes?.length}`)
    check('work items collection exists', Array.isArray(boot.workItems))
    check('class moves collection exists', Array.isArray(boot.classMoves))
    check('locations are served', Array.isArray(boot.locations) && boot.locations.length === 3)
    /**
     * The invariant the fix actually guarantees.
     *
     * NOT "nobody has a zero lifetime value" — a member whose only charge was
     * refunded legitimately nets to zero, and an assertion that flags them is
     * flagging correct data. What must hold for everyone is the formula:
     * value = base + the ledger. Under the old code it did not, because the
     * base did not exist and a partial replay overwrote the whole figure.
     *
     * `metrics.lifetimeValue` is what the browser sees; the base is internal, so
     * this reconstructs it from the payments the bootstrap also carries.
     */
    const netByMember = new Map()
    for (const p of boot.payments) {
      if (p.status === 'pending') continue
      netByMember.set(p.memberId, (netByMember.get(p.memberId) ?? 0) + p.amount)
    }
    // A member's value must be at least the money the ledger records against
    // them: less would mean the stored figure contradicts the payments on file.
    const below = boot.members.filter((m) => {
      const net = netByMember.get(m.id) ?? 0
      return net > 0 && m.metrics.lifetimeValue < net
    })
    check(
      'no lifetime value is below the money the ledger records',
      below.length === 0,
      below.slice(0, 3).map((m) => `${m.name}: ${m.metrics.lifetimeValue} < ${netByMember.get(m.id)}`).join(' | '),
    )
  }
  await page.close()

  section('Console')
  const real = consoleErrors.filter((e) => !/favicon/i.test(e))
  check('no console errors', real.length === 0, real.slice(0, 4).join(' | '))
} finally {
  await browser.close()
}

console.log(`\n=== summary ===\n`)
console.log(`checked: ${pass + fail}   passed: ${pass}   failed: ${fail}`)
if (fail > 0) {
  console.log('\nFAILURES:')
  for (const f of failures) console.log(` - ${f}`)
  process.exit(1)
}
console.log('ALL CHECKS PASSED — and nothing was written.')
