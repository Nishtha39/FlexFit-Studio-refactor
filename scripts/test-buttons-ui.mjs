/**
 * Real-browser proof that the buttons write.
 *
 *     node scripts/test-buttons-ui.mjs [baseUrl]
 *
 * The reported defect was "lots of buttons which are not working". They were not
 * throwing and they were not disabled — they popped a green toast over a change
 * that never reached the database. Every render test and every accessibility
 * check passes against that, which is exactly why this suite is shaped the way
 * it is:
 *
 *   read the database → press the real button in a real browser → read the
 *   database again and assert the row moved.
 *
 * A toast is never accepted as evidence. Where a toast IS asserted it is only
 * ever alongside the row it claims to describe.
 *
 * THIS SUITE MUTATES. It takes payments, writes notes, resolves queue rows and
 * reassigns trainers. Point it at a local, reseedable D1 — never production.
 *
 * Habits carried over from test-equipment-ui.mjs, all learned the hard way:
 *   - never a fixed `sleep()`; wait for the condition, or a slow round trip
 *     false-flags a bug that is not there;
 *   - a Playwright click can land before React hydrates and Playwright is
 *     perfectly happy — visible, enabled, and completely inert — so anything
 *     that must take effect is retried until the effect is observable;
 *   - `innerText` applies CSS `text-transform`, so uppercase headers read
 *     "S.NO" while the source says "S.no". Match case-insensitively.
 */
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://127.0.0.1:8788'

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

async function api(path, body) {
  const res = await fetch(`${BASE}/api/trpc/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  return json.result.data
}

const bootstrap = () => api('read.bootstrap')

/**
 * Click a profile tab.
 *
 * Scoped to `[role="tab"]` on purpose. Matching a bare `button, a` by label
 * picks up the SIDEBAR NAV LINK of the same name first — clicking "Billing"
 * navigated to /billing instead of switching tab, and the failure then looked
 * like the tab was broken. The nav and the tab strip share several words.
 */
async function openTab(page, label) {
  const tab = page.locator(`[role="tab"]`, { hasText: new RegExp(`^${label}`) }).first()
  return clickUntil(tab, async () => (await tab.getAttribute('aria-selected')) === 'true')
}

/** Wait for a condition on freshly-read page text. Never a fixed sleep. */
async function waitForText(page, re, timeoutMs = 15000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const t = await page.locator('body').innerText().catch(() => '')
    if (re.test(t)) return t
    await page.waitForTimeout(250)
  }
  return null
}

/** Poll the API until a predicate holds — proof the write actually landed. */
async function waitForDb(read, predicate, timeoutMs = 15000) {
  const started = Date.now()
  let last
  while (Date.now() - started < timeoutMs) {
    last = await read()
    if (predicate(last)) return last
    await new Promise((r) => setTimeout(r, 400))
  }
  return null
}

/**
 * Click a button once it is actually pressable.
 *
 * Every write button in this app is disabled until the store reports `live`,
 * which is correct — but it means a click fired the moment the markup appears
 * hits a disabled button and Playwright reports it as "waiting for locator",
 * i.e. exactly as if the button did not exist. That cost a false failure on the
 * Settings dialog, so submit buttons go through here.
 */
async function pressWhenReady(locator, timeoutMs = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if ((await locator.count()) > 0 && (await locator.isEnabled().catch(() => false))) {
      await locator.click({ timeout: 5000 })
      return true
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

/**
 * Click something that must take effect, retrying until it does.
 * `done()` is the observable consequence, not the click itself.
 */
async function clickUntil(locator, done, attempts = 12) {
  for (let i = 0; i < attempts; i++) {
    await locator.click({ timeout: 4000 }).catch(() => {})
    for (let j = 0; j < 12; j++) {
      if (await done()) return true
      await new Promise((r) => setTimeout(r, 250))
    }
  }
  return false
}

/** Open a page and wait until the store reports it reached the API. */
async function open(ctx, path) {
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`${path}: ${m.text()}`)
  })
  page.on('pageerror', (e) => consoleErrors.push(`${path} pageerror: ${e.message}`))
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('h1', { timeout: 25000 })
  // The offline banner is the store saying it could not reach /api/trpc. If it
  // is showing, every write button is correctly disabled and nothing below
  // would be a fair test.
  const offline = await waitForText(page, /Working from the built-in sample data/, 2500)
  if (offline) throw new Error(`${path}: the app could not reach the API — every write is disabled`)
  return page
}

const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })

try {
  /* ===================================================================== */
  section('Notes tab — a note survives because it is a row')
  /* ===================================================================== */
  {
    const before = await bootstrap()
    const member = before.members.find((m) => m.status === 'active')
    const notesBefore = before.memberNotes.filter((n) => n.memberId === member.id).length

    const page = await open(ctx, `/members/${member.id}`)
    await openTab(page, 'Notes')
    check('the notes tab opens a composer', (await page.locator('#note-body').count()) > 0)

    const body = `Automated check ${Date.now()} — cleared for spin only until the physio signs off.`
    await page.locator('#note-body').fill(body)
    await pressWhenReady(page.locator('button', { hasText: /^Save note$/ }).first())

    const after = await waitForDb(
      bootstrap,
      (b) => b.memberNotes.filter((n) => n.memberId === member.id).length === notesBefore + 1,
    )
    check('Save note WRITES a row to member_notes', after !== null, `expected ${notesBefore + 1}`)
    check(
      'the stored note carries the text that was typed',
      Boolean(after?.memberNotes.some((n) => n.body === body)),
    )
    check('the new note is on screen', Boolean(await waitForText(page, /Automated check/)))

    // Reload: the whole point. The old build lost the note here.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await openTab(page, 'Notes')
    await waitForText(page, /Automated check/)
    check('the note is still there after a reload', /Automated check/.test(await page.locator('body').innerText()))

    // Pin it, and prove the flag moved rather than a chip appearing locally.
    const noteId = after?.memberNotes.find((n) => n.body === body)?.id
    await page.locator('button[aria-label="Pin note to check-in"]').first().click().catch(() => {})
    const pinned = await waitForDb(bootstrap, (b) => b.memberNotes.find((n) => n.id === noteId)?.pinned === true)
    check('Pin WRITES pinned=true', pinned !== null)

    await page.close()
  }

  /* ===================================================================== */
  section('Billing tab — take payment appends to the ledger')
  /* ===================================================================== */
  {
    const before = await bootstrap()
    const member = before.members.find((m) => m.status === 'active')
    const paymentsBefore = before.payments.filter((p) => p.memberId === member.id).length
    const ltvBefore = before.members.find((m) => m.id === member.id).metrics.lifetimeValue

    const page = await open(ctx, `/members/${member.id}`)
    await openTab(page, 'Billing')
    check(
      'the billing tab shows payment history',
      Boolean(await waitForText(page, /payment history/i)),
    )

    await clickUntil(
      page.locator('button', { hasText: /^Take payment$/ }).first(),
      async () => (await page.locator('#pay-amount').count()) > 0,
    )
    check('Take payment opens the dialog', (await page.locator('#pay-amount').count()) > 0)

    await page.locator('#pay-amount').fill('1234')
    await pressWhenReady(page.locator('button', { hasText: /^Take ₹/ }).first())

    const after = await waitForDb(
      bootstrap,
      (b) => b.payments.filter((p) => p.memberId === member.id).length === paymentsBefore + 1,
    )
    check('Take payment APPENDS a payment row', after !== null, `expected ${paymentsBefore + 1}`)
    check(
      'the amount stored is the amount typed',
      Boolean(after?.payments.some((p) => p.memberId === member.id && p.amount === 1234)),
    )
    // The bug this whole change set is about: a toast over a stat that did not
    // move. Lifetime value is recomputed server-side, so it must have changed.
    const ltvAfter = after?.members.find((m) => m.id === member.id).metrics.lifetimeValue
    check('lifetime value moved with the payment', ltvAfter === ltvBefore + 1234, `${ltvBefore} → ${ltvAfter}`)

    await page.close()
  }

  /* ===================================================================== */
  section('Notifications — mark all read is stored')
  /* ===================================================================== */
  {
    const before = await bootstrap()
    const unreadBefore = before.notifications.filter((n) => !n.read).length
    check('there are unread notifications to clear', unreadBefore > 0, `unread=${unreadBefore}`)

    const page = await open(ctx, '/notifications')
    const btn = page.locator('button', { hasText: /^Mark all read$/ }).first()
    await clickUntil(btn, async () => {
      const b = await bootstrap()
      return b.notifications.every((n) => n.read)
    })

    const after = await waitForDb(bootstrap, (b) => b.notifications.every((n) => n.read))
    check('Mark all read WRITES read=true on every row', after !== null)
    check('the button disables once nothing is unread', await btn.isDisabled().catch(() => false))

    await page.close()
  }

  /* ===================================================================== */
  section('Corporate — top up moves the pool')
  /* ===================================================================== */
  {
    const before = await bootstrap()
    const company = before.companies[0]
    const creditsBefore = company.poolCredits

    const page = await open(ctx, `/corporate/${company.id}`)
    await clickUntil(
      page.locator('button', { hasText: /^Top up pool$/ }).first(),
      async () => (await page.locator('button', { hasText: /^Add credits$/ }).count()) > 0,
    )
    check('Top up pool opens the confirm dialog', (await page.locator('button', { hasText: /^Add credits$/ }).count()) > 0)

    await pressWhenReady(page.locator('button', { hasText: /^Add credits$/ }).first())
    const after = await waitForDb(
      bootstrap,
      (b) => b.companies.find((c) => c.id === company.id).poolCredits > creditsBefore,
    )
    check('Add credits WRITES a bigger pool', after !== null, `was ${creditsBefore}`)

    await page.close()
  }

  /* ===================================================================== */
  section('Plans — publish stores the price')
  /* ===================================================================== */
  {
    const page = await open(ctx, '/billing/plans')
    const priceInput = page.locator('#plan-price')
    await priceInput.waitFor({ timeout: 15000 })

    const planId = (await page.locator('body').innerText()).match(/plan-[a-z0-9-]+/)?.[0]
    check('the builder names the plan it is editing', Boolean(planId), planId ?? 'none found')

    const before = await bootstrap()
    const planBefore = before.plans.find((p) => p.id === planId)
    const newPrice = planBefore.price + 111

    await priceInput.fill(String(newPrice))
    await clickUntil(
      page.locator('button', { hasText: /^Publish changes$/ }).first(),
      async () => (await page.locator('button', { hasText: /^Publish plan$/ }).count()) > 0,
    )
    await pressWhenReady(page.locator('button', { hasText: /^Publish plan$/ }).first())

    const after = await waitForDb(bootstrap, (b) => b.plans.find((p) => p.id === planId)?.price === newPrice)
    check('Publish WRITES the new price', after !== null, `expected ${newPrice}`)
    // The builder edits perks and interval too; dropping them on save would be
    // a silent partial write, which is the same class of defect.
    check(
      'publishing did not blank the perks',
      (after?.plans.find((p) => p.id === planId)?.perks ?? []).length === planBefore.perks.length,
    )

    await page.close()
  }

  /* ===================================================================== */
  section('Retention queue — Done survives a reload')
  /* ===================================================================== */
  {
    const before = await bootstrap()
    const itemsBefore = before.workItems.length

    const page = await open(ctx, '/retention')
    const firstName = await page
      .locator('table tbody tr')
      .first()
      .locator('td')
      .nth(1)
      .innerText()
      .catch(() => '')

    await clickUntil(
      page.locator('table tbody tr').first().locator('button', { hasText: /^Done$/ }),
      async () => (await bootstrap()).workItems.length > itemsBefore,
    )

    const after = await waitForDb(bootstrap, (b) => b.workItems.length > itemsBefore)
    check('Done WRITES a work_items row', after !== null, `was ${itemsBefore}`)
    const item = after?.workItems.find((w) => w.queue === 'retention')
    check('the row is stored as done', item?.status === 'done', item?.status ?? 'none')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('table tbody tr', { timeout: 20000 }).catch(() => {})
    const stillGone = await waitForDb(
      async () => await page.locator('table tbody tr').first().locator('td').nth(1).innerText().catch(() => ''),
      (t) => t.trim() !== firstName.trim(),
      12000,
    )
    check('the completed row does not come back on reload', stillGone !== null, `top row still "${firstName}"`)

    await page.close()
  }

  /* ===================================================================== */
  section('Trainers — assign a class writes the trainer')
  /* ===================================================================== */
  {
    const before = await bootstrap()
    const trainer = before.staff.find((s) => s.active && s.role === 'trainer')

    const page = await open(ctx, `/trainers/${trainer.id}`)
    await clickUntil(
      page.locator('button', { hasText: /^Assign a class$/ }).first(),
      async () => (await page.locator('button', { hasText: /^Assign$/ }).count()) > 0,
    )
    const options = await page.locator('button', { hasText: /^Assign$/ }).count()
    check('the assign dialog lists classes', options > 0, `options=${options}`)

    const enabled = page.locator('button:not([disabled])', { hasText: /^Assign$/ }).first()
    if (await enabled.count()) {
      const classesBefore = before.classes.filter((c) => c.trainerId === trainer.id).length
      await enabled.click()
      const after = await waitForDb(
        bootstrap,
        (b) => b.classes.filter((c) => c.trainerId === trainer.id).length === classesBefore + 1,
      )
      check('Assign WRITES the class over to this trainer', after !== null, `was ${classesBefore}`)
    } else {
      check('every listed class is blocked with a stated reason', /clashes with|does not work at/i.test(await page.locator('body').innerText()))
    }

    await page.close()
  }

  /* ===================================================================== */
  section('Settings — a renamed location is stored')
  /* ===================================================================== */
  {
    const before = await bootstrap()
    const site = before.locations[0]
    const newName = `${site.name} ${Date.now() % 1000}`

    const page = await open(ctx, '/settings')
    await clickUntil(
      page.locator('button', { hasText: /^Edit$/ }).first(),
      async () => (await page.locator('#loc-name').count()) > 0,
    )
    check('Edit opens the location dialog', (await page.locator('#loc-name').count()) > 0)

    await page.locator('#loc-name').fill(newName)
    const pressed = await pressWhenReady(page.locator('button', { hasText: /^Save location$/ }).first())
    check('Save location becomes pressable', pressed)

    const after = await waitForDb(bootstrap, (b) => b.locations.find((l) => l.id === site.id)?.name === newName)
    check('Save location WRITES the new name', after !== null, `expected "${newName}"`)
    check('the id was not changed', Boolean(after?.locations.find((l) => l.id === site.id)))

    await page.close()
  }

  /* ===================================================================== */
  section('Offline honesty — no write button claims success without an API')
  /* ===================================================================== */
  {
    const page = await ctx.newPage()
    // Fail every tRPC call: the store must go offline and disable the writes
    // rather than showing a green toast over nothing.
    await page.route('**/api/trpc/**', (route) => route.abort())
    await page.goto(`${BASE}/notifications`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('h1', { timeout: 25000 })

    check(
      'the app says out loud that it cannot save',
      Boolean(await waitForText(page, /Working from the built-in sample data/, 20000)),
    )
    const markAll = page.locator('button', { hasText: /^Mark all read$/ }).first()
    check('Mark all read is disabled with no connection', await markAll.isDisabled().catch(() => true))
    await page.close()
  }

  /* ===================================================================== */
  section('Console')
  /* ===================================================================== */
  // Aborting every request on purpose produces its own network errors; they are
  // the test working, not the app failing.
  const realErrors = consoleErrors.filter((e) => !/Failed to fetch|net::ERR_FAILED|TRPCClientError/i.test(e))
  check('no unexpected console errors', realErrors.length === 0, realErrors.slice(0, 4).join(' | '))
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
console.log('ALL CHECKS PASSED')
