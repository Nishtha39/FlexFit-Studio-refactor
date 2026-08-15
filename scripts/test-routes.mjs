/**
 * Every route, opened in a real browser, asserting it renders without a
 * runtime or hydration error.
 *
 * This exists because a hydration mismatch is invisible to the other suites.
 * `test-buttons-ui.mjs` watches the console, but only on the handful of
 * screens whose buttons it presses — a React #418 on /notifications (a
 * relative-time formatter reading the wall clock instead of the dataset's
 * fixed instant) sat there unseen because no suite opened that page.
 *
 * READ-ONLY: it navigates and watches. It presses nothing and writes nothing,
 * so unlike test-api / test-buttons / test-ui it is safe against production.
 *
 *   node scripts/test-routes.mjs [baseUrl]
 */

import { chromium } from 'playwright'

const BASE = (process.argv[2] ?? 'http://127.0.0.1:8789').replace(/\/$/, '')

/** Every page a user can reach, including one instance of each detail route. */
const ROUTES = [
  '/dashboard',
  '/members',
  '/members/m-0001',
  '/retention',
  '/schedule',
  '/check-in',
  '/leads',
  '/trainers',
  '/trainers/staff-t1',
  '/corporate',
  '/corporate/co-001',
  '/billing',
  '/billing/dunning',
  '/billing/plans',
  '/payments',
  '/notifications',
  '/reports',
  '/portal',
  '/settings',
  '/equipment',
  '/my-schedule',
  '/kiosk',
]

/** Noise that says nothing about the app's own correctness. */
const IGNORE = /favicon|net::ERR_|Failed to load resource/i

const browser = await chromium.launch({ channel: 'chrome' })
let failed = 0

for (const route of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const errors = []

  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.split('\n')[0]}`))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const text = m.text()
    if (IGNORE.test(text)) return
    errors.push(`console: ${text.slice(0, 160)}`)
  })

  let status = 0
  try {
    const res = await page.goto(`${BASE}${route}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })
    status = res?.status() ?? 0
    // Hydration errors surface after the client bundle runs, not on load.
    await page.waitForTimeout(2200)
  } catch (e) {
    errors.push(`nav: ${e.message.split('\n')[0]}`)
  }

  const ok = status === 200 && errors.length === 0
  if (!ok) failed++
  const detail = errors.length ? `\n        ${errors.join('\n        ')}` : ''
  console.log(`${ok ? ' ok ' : 'FAIL'}  ${route}  [${status}]${detail}`)

  await ctx.close()
}

await browser.close()

console.log(`\n${ROUTES.length - failed}/${ROUTES.length} routes render clean`)
process.exit(failed ? 1 : 0)
