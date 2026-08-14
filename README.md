# FlexFit Studio

Gym-operations software: members and profiles, retention and cohorts, class
schedule, check-in and kiosk, leads pipeline, trainers, corporate credit pools,
billing and dunning, a payments ledger, notifications, 12 reports, a member
portal, settings, a ⌘K command palette and a role switcher.

**Live:** https://flexfit-studio.amitynoidalibrary.workers.dev

## Shape of the thing

One Cloudflare Worker serves both halves, and the split between them is the
main design decision in the repository:

| | |
| --- | --- |
| **UI** | Next.js 16 + React 19 + Tailwind v4, built with `output: 'export'` to 481 static HTML pages |
| **API** | tRPC 11 on a Worker (`worker/index.ts`), mounted at `/api/trpc` |
| **Data** | Cloudflare D1 (SQLite) through Drizzle ORM |

Static assets are matched **before** the Worker runs, so a page load costs no
Worker CPU. That is not a micro-optimisation — an SSR deploy of the same app
returned 503 under Next's link prefetching, because App Router prefetches every
visible link and each one became a server render. Exporting the pages made
24 out of 24 concurrent requests succeed where the SSR build managed 18 of 28.

`AppRouter` crosses into the browser as a **type only**, so renaming a procedure
breaks the build rather than production, and no server code, Drizzle or D1
driver reaches the client bundle.

## Running it

Node 20+ and pnpm.

```bash
pnpm install
pnpm dev              # http://localhost:3000 — UI against the seeded fixtures
```

Against a real local database:

```bash
pnpm db:local         # apply migrations to the local D1
pnpm seed:local       # load server/db/seed.sql
pnpm preview          # next build && wrangler dev — the Worker, as Cloudflare runs it
```

Deploying needs a Cloudflare account with a D1 database whose id is set in
`wrangler.jsonc`:

```bash
pnpm db:remote && pnpm seed:remote
pnpm deploy           # next build && wrangler deploy
```

## Layout

```
app/               24 routes — (app)/ is the shell-wrapped back office, kiosk/ stands alone
components/        80 components in 20 feature folders, plus components/ui primitives
lib/data/          seeded fixtures the screens currently render from
lib/               formatting, risk scoring, shared types, the typed API client
server/trpc/       routers: read, ops, booking, crm, billing
server/domain/     booking rules, ledger rules, metrics, mappers
server/db/         Drizzle schema, migrations, seed
worker/index.ts    the Worker: tRPC in front, static assets behind
scripts/           seed pipeline and the API test suite
```

## Decisions worth knowing before changing anything

**Payments are append-only.** A refund adds a row; it never edits one. Reversals
carry `reversalOf`, and gross, refunds and net all reconcile by replaying the
ledger. Editing a payment in place would make history unreproducible.

**There is no `invoices` table.** An invoice is a derivation over `payments`.
Dunning, pool health and reports are derivations too, which is why
`read.bootstrap` returns whole entities rather than pre-chewed answers.

**Three fields are absent because they are derived, not stored:** a member's
risk (stale the moment someone checks in), a lead's age in days (wrong by the
next morning), and a company's employee list (`members.company_id` already
says it).

**Class rosters are rows, not a JSON array.** A JSON array cannot express
"insert only if the class is under capacity" atomically; the composite primary
key on `class_seats` makes double-booking impossible at the storage layer.

**The attendance heatmap is materialised** — 168 rows rather than a `GROUP BY`
over 37,410 check-ins, because D1 bills rows *scanned* and the aggregate would
spend the free daily read budget in roughly a hundred page loads. It follows
that any write path touching check-ins must keep the two in step: a kiosk
double-tap is deduplicated by a deterministic id, and the aggregate is bumped
**only when a row was really inserted**. `scripts/test-api.mjs` compares the
heatmap total against `COUNT(*)` on every run, because that drift is otherwise
invisible.

**Unlimited plans store `consumesCredit: null`.** Test it with
`typeof === 'number'`, never for truthiness — `0` is a real value, and
truthiness would let a member with no credits book forever.

**The clock is `NOW` from `lib/seed.ts`, never `new Date()`.** The dataset is
positioned relative to a fixed instant; using the wall clock makes the seeded
world drift out from under the tests.

## Tests

```bash
node scripts/test-api.mjs        # 54 checks against the API
```

They run against a deployed Worker. Pace them — a route that only passes when
probed alone is not passing.

## Status

The API is live and covered. The screens still render the client-side fixtures
in `lib/data/`, so **actions in the UI do not yet persist**; the wiring plan
lives with the project notes.
