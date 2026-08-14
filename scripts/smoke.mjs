/**
 * Read-only verification of a deployed FlexFit Studio.
 *
 *   BASE=https://flexfit-studio.amitynoidalibrary.workers.dev node scripts/smoke.mjs
 *
 * WHY THIS EXISTS SEPARATELY FROM test-api.mjs: that suite MUTATES. It issues
 * real refunds and records real check-ins, which is the only honest way to test
 * a ledger, but it means it can be run against a given database roughly once —
 * the second run finds the payment already refunded and fails five checks while
 * nothing is actually wrong. Pointing it at production after every deploy would
 * therefore turn a healthy pipeline red and, worse, write test rows into the
 * live data. So the deploy workflow runs THIS instead: every request below is a
 * read, so it is safe to run on every deploy, forever.
 *
 * It is not a shallow ping. Besides checking the site and API answer, it
 * re-checks the invariant this schema is most likely to break silently: the
 * materialised attendance heatmap must still agree with the check-in table it
 * summarises. That drift produces no error anywhere — the numbers just quietly
 * stop matching — so production is exactly where it is worth asserting.
 */

const BASE = (process.env.BASE ?? 'http://127.0.0.1:8789').replace(/\/$/, '')
const API = `${BASE}/api/trpc`

let passed = 0
const failures = []

function check(name, ok, detail = '') {
  if (ok) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failures.push(detail ? `${name} — ${detail}` : name)
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

/** tRPC query over GET, which is what the browser does for reads. */
async function query(procedure, input = {}) {
  const url = `${API}/${procedure}?input=${encodeURIComponent(JSON.stringify(input))}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${procedure} answered ${res.status}`)
  const body = await res.json()
  const data = body?.result?.data ?? body?.[0]?.result?.data
  if (data === undefined) throw new Error(`${procedure} returned no data`)
  return data
}

async function status(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: 'follow' })
  return { code: res.status, type: res.headers.get('content-type') ?? '' }
}

console.log(`smoke: ${BASE}\n`)

// ---------------------------------------------------------------- the site
const dashboard = await status('/dashboard')
check('a page is served', dashboard.code === 200, `HTTP ${dashboard.code}`)
check('and it is HTML', dashboard.type.includes('text/html'), dashboard.type)

// Detail routes are prerendered per record; this one exists in the seed.
const detail = await status('/members/m-0001')
check('a detail route is served', detail.code === 200, `HTTP ${detail.code}`)

const missing = await status('/definitely-not-a-route-9f3c')
check('an unknown path is a 404', missing.code === 404, `HTTP ${missing.code}`)

// ----------------------------------------------------------------- the API
const boot = await query('read.bootstrap')

const expected = [
  'locations',
  'plans',
  'staff',
  'companies',
  'members',
  'classes',
  'payments',
  'leads',
  'notifications',
  'dailyAttendance',
  'attendanceMatrix',
  'recentCheckIns',
  'settings',
]
const absent = expected.filter((k) => !(k in boot))
check('bootstrap carries every collection', absent.length === 0, `missing: ${absent.join(', ')}`)

// Non-empty rather than an exact count: the ledger legitimately grows.
for (const key of ['locations', 'plans', 'staff', 'members', 'classes', 'payments']) {
  check(`${key} is populated`, Array.isArray(boot[key]) && boot[key].length > 0, `${boot[key]?.length} rows`)
}

check(
  'settings are readable',
  boot.settings && typeof boot.settings === 'object' && Object.keys(boot.settings).length > 0,
)

// ------------------------------------------------- the invariant that drifts
check(
  'the heatmap is 7 x 24',
  boot.attendanceMatrix?.length === 7 && boot.attendanceMatrix[0]?.length === 24,
  `${boot.attendanceMatrix?.length} x ${boot.attendanceMatrix?.[0]?.length}`,
)

const heatTotal = boot.attendanceMatrix.flat().reduce((a, b) => a + b, 0)
const rows = (await query('read.checkInCount')).total
check(
  'the heatmap still agrees with the check-in table',
  heatTotal === rows,
  `heatmap ${heatTotal} vs rows ${rows}`,
)

// ------------------------------------------------------------------ verdict
console.log(`\nchecked: ${passed + failures.length}   passed: ${passed}   failed: ${failures.length}`)
if (failures.length) {
  console.log('\nFAILURES:')
  for (const f of failures) console.log(` - ${f}`)
  process.exit(1)
}
console.log('\nthe deployed site is serving and the data is consistent.')
