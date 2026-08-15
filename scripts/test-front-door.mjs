/**
 * The public front door actually works.
 *
 *     node scripts/test-front-door.mjs [baseUrl]
 *
 * Written because it shipped broken: the marketing page went live at the site
 * root linking to /login and /signup while both screens sat under /v2/, so
 * every primary call to action on the front page answered 404. Nothing caught
 * it — the routes all built, all rendered, and all returned 200 at the URLs
 * they happened to occupy. A route existing is not the same as the button
 * reaching it.
 *
 * So this suite does not check that pages exist. It opens the landing page,
 * collects every internal link the page actually offers, and requires each to
 * resolve — then presses the two buttons a visitor presses and asserts where
 * they land. Read-only: safe against production.
 *
 * Runs at both widths on purpose. Below `sm` the header collapses "Sign in"
 * into the hamburger menu, so a naive visible-link check reports a bug that is
 * not there; the menu is opened before the link is called missing.
 */

import { chromium } from 'playwright'

const BASE = process.argv[2] || 'http://localhost:8791'
let pass = 0, fail = 0
const ok = (m) => { console.log(`  ok   ${m}`); pass++ }
const bad = (m) => { console.log(`  FAIL ${m}`); fail++ }

const browser = await chromium.launch({ channel: 'chrome' })

for (const vp of [{ n: 'desktop', width: 1440, height: 950 }, { n: 'phone', width: 390, height: 844 }]) {
  console.log(`\n${vp.n} — ${BASE}`)
  console.log('-'.repeat(46))
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })

  // Every internal link the landing page offers must resolve.
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(1500)

  const hrefs = await page.evaluate(() =>
    [...new Set([...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')))])
  for (const h of hrefs) {
    const res = await page.request.get(BASE + h)
    res.status() === 200 ? ok(`link ${h} → 200`) : bad(`link ${h} → ${res.status()}`)
  }

  // Actually press the buttons a user presses.
  for (const [label, expect] of [[/sign in/i, '/login'], [/start free trial|get started/i, '/signup']]) {
    const p = await ctx.newPage()
    await p.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 })
    await p.waitForTimeout(1200)
    let link = p.locator('a:visible').filter({ hasText: label }).first()
    // Below sm the header collapses "Sign in" into the hamburger menu, so a
    // missing visible link is only a failure once the menu has been opened.
    if ((await link.count()) === 0) {
      const burger = p.locator('button[aria-label="Open menu"]')
      if ((await burger.count()) > 0) {
        await burger.click()
        await p.waitForTimeout(400)
        link = p.locator('a:visible').filter({ hasText: label }).first()
      }
    }
    const count = await link.count()
    if (count === 0) { bad(`no "${label}" link found`); await p.close(); continue }
    await link.click()
    await p.waitForURL(`**${expect}`, { timeout: 15000 }).catch(() => {})
    const url = new URL(p.url()).pathname
    const h1 = await p.locator('h1').first().innerText().catch(() => '(none)')
    const is404 = (await p.content()).includes('This page could not be found')
    url === expect && !is404
      ? ok(`click "${label.source}" → ${url} ("${h1.replace(/\n/g, ' ').slice(0, 40)}")`)
      : bad(`click "${label.source}" → ${url}${is404 ? ' (404 page)' : ''}`)
    await p.close()
  }
  await ctx.close()
}

await browser.close()
console.log('\n' + '='.repeat(46))
console.log(`${pass} passed, ${fail} failed`)
console.log('='.repeat(46))
process.exit(fail === 0 ? 0 : 1)
