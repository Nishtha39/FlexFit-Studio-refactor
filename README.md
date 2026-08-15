# FlexFit Studio

Gym-operations software: members and profiles, retention and cohorts, class
schedule, check-in and kiosk, leads pipeline, trainers, **equipment (asset
register, maintenance, fault log and member reservations)**, corporate credit
pools, billing and dunning, a payments ledger, notifications, 12 reports, a
member portal, settings, a ⌘K command palette and a role switcher.

Actions write to the database for real: freezing a member, taking a payment,
activating a trainer, saving a setting, reporting a fault and reserving
equipment all persist and survive a reload. **Outbound email really sends**, via
Resend — see *Email* below.

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
pnpm db:local             # migrations: core tables
pnpm db:local:equipment   # migrations: equipment tables
pnpm seed:local           # load server/db/seed.sql
pnpm equipment:local      # load server/db/seed-equipment.sql
pnpm attendance:local     # reconcile daily totals with the check-in rows
pnpm preview              # next build && wrangler dev — the Worker, as Cloudflare runs it
```

`pnpm dev` alone cannot reach `/api/trpc`, so the app runs off the built-in seed
and says so in a banner; write buttons refuse rather than pretending. Use
`pnpm preview` to exercise anything that saves.

## Checking it

```bash
pnpm verify:numbers   # 85 checks — does the same fact have the same value everywhere?
pnpm test:api         # 54 checks — MUTATES, point it at a local D1 you can reseed
pnpm smoke            # 14 read-only checks, safe against production
pnpm test:ui          # 38 checks in a real browser (Playwright)
```

`verify:numbers` is the unusual one: every assertion re-derives the value a
second time from the raw entities by a different route and demands the two
match. It exists because a dashboard KPI, a report row and a detail page can
each be individually correct and still disagree — which is exactly what it found
on its first run (a "Visits · 30 days" tile reading 4,721 above a heatmap built
from 2,703 rows).

`test:ui` writes one payment row per run and does not remove it, so like
`test:api` it belongs against a local database.

## Email

Sending is off until a key is bound, and the UI states that plainly rather than
failing silently:

```bash
npx wrangler secret put RESEND_API_KEY   # from resend.com/api-keys — free tier, no card
npx wrangler secret put EMAIL_FROM       # "FlexFit Studio <hello@yourdomain.com>"
```

`EMAIL_FROM` must be on a domain verified in Resend. Until one is, Resend's
shared sender delivers only to the account owner — enough to prove the pipeline,
which is what **Settings → Email → Send a test** is for. A key can be valid while
the sender domain is not, and that only fails at send time, so a test send is the
only honest check.

## Deploying

**Pushing to `main` deploys.** `.github/workflows/deploy.yml` builds the site,
ships the Worker, waits out the rollout window and then runs the 54-check API
suite against the live URL — so a merged backend change is visible on the
deployed site without anyone running wrangler, and "the deploy went green" means
the API actually answered rather than that the upload succeeded.

**A schema change must reach D1 before the code that needs it**, or every
request 500s on a missing table for the whole rollout:

```bash
pnpm db:remote:equipment && pnpm equipment:remote && pnpm attendance:remote
pnpm deploy
```

The workflow deliberately blocks any push touching `server/db/migrations/` for
that reason; re-run it from the Actions tab with *"Schema change already
applied"* ticked once the migration is in.

It needs two repository secrets (Settings → Secrets and variables → Actions):

| Secret | What |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | a token created from the **Edit Cloudflare Workers** template |
| `CLOUDFLARE_ACCOUNT_ID` | the account the Worker lives in |

**A schema change is the one thing the pipeline will not do for you.** Deploying
code before its migration reaches the database means every request 500s on a
missing column for the whole rollout, and it presents as a broken deploy rather
than a missing migration. So a push that touches `server/db/migrations/` is
stopped by a guard step. Apply it first, then re-run the workflow from the
Actions tab with *"Schema change already applied"* ticked:

```bash
pnpm db:remote        # apply migrations to the remote D1
pnpm seed:remote      # only when seeding a fresh database
```

Deploying by hand, if you need to:

```bash
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
BASE=https://flexfit-studio...workers.dev pnpm smoke      # 14 read-only checks
BASE=http://127.0.0.1:8789            pnpm test:api       # 54 checks — MUTATES
```

**`test:api` writes.** It issues real refunds and records real check-ins, which
is the only honest way to test an append-only ledger, but it means a given
database survives roughly one run: the second finds the payment already refunded
and fails five checks while nothing is actually wrong. **Point it at a local D1
you can reseed, never at production.**

`smoke` is the one that is safe to run anywhere, any number of times, and it is
what the deploy workflow runs against the live site. It is not a ping — besides
checking the site and API answer, it re-asserts the invariant most likely to
break silently: the materialised heatmap must still agree with the check-in
table it summarises. Nothing errors when those drift apart; the numbers just
stop matching.

Pace probes against production — a route that only passes when probed alone is
not passing.

## Status

The API is live and covered. The screens still render the client-side fixtures
in `lib/data/`, so **actions in the UI do not yet persist**; the wiring plan
lives with the project notes.
