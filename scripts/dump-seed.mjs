/**
 * Dumps the deterministic seed dataset to JSON so it can be loaded into D1.
 *
 * The data modules are TypeScript with `@/` path aliases, so they are bundled
 * with the esbuild that already ships inside wrangler's dependency tree — no new
 * dependency, and no second copy of the generators to drift from the originals.
 * Running the real modules is the point: whatever the UI showed before the
 * backend existed is exactly what lands in the database.
 */
import { build } from 'esbuild'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const tmp = mkdtempSync(path.join(tmpdir(), 'flexfit-seed-'))
const entry = path.join(tmp, 'entry.mjs')

await build({
  entryPoints: [path.join(root, 'lib/data/index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: entry,
  alias: { '@': root },
  logLevel: 'warning',
})

const d = await import(pathToFileURL(entry).href)

const out = {
  locations: d.locations,
  plans: d.plans,
  staff: d.staff,
  companies: d.companies,
  members: d.members,
  classes: d.classes,
  checkIns: d.checkIns,
  dailyAttendance: d.dailyAttendance,
  payments: d.payments,
  leads: d.leads,
  notifications: d.notifications,
}

mkdirSync(path.join(root, 'server/db'), { recursive: true })
const dest = path.join(root, 'server/db/seed-data.json')
writeFileSync(dest, JSON.stringify(out))

for (const [k, v] of Object.entries(out)) {
  console.log(String(v.length).padStart(7), k)
}
console.log('\nwrote', dest)
