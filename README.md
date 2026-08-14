# FlexFit Studio — UI

Gym-operations front office: members and profiles, retention and cohorts, class
schedule, check-in and kiosk, leads pipeline, trainers, corporate credit pools,
billing and dunning, a payments ledger, notifications, 12 reports, a member
portal, settings, a ⌘K command palette and a role switcher.

**Live:** https://flexfit-studio.amitynoidalibrary.workers.dev

## What is in this repository

The **interface only** — 24 routes, 80 components, and the design system they
share. Every screen derives its content at module load from the seeded fixtures
in [`lib/data/`](lib/data/), so the whole app runs, navigates and renders with
nothing behind it: no server, no database, no API key, no `.env`.

## What is deliberately not in this repository

The backend. It is a Cloudflare Worker (D1 + Drizzle + tRPC) and it is **not
published here** — it is reachable only as the deployed service:

| | |
| --- | --- |
| API | `https://flexfit-studio.amitynoidalibrary.workers.dev/api/trpc` |
| App | https://flexfit-studio.amitynoidalibrary.workers.dev |

So the tRPC router, the schema and migrations, the seed pipeline, the Worker
entry point and the `wrangler` configuration are absent by design. Nothing in
this tree imports them: the one file that referenced the API was type-only and
has been left out, which is why `pnpm build` here succeeds on its own.

## Running it

Node 20+ and pnpm.

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

```bash
pnpm build          # static export -> out/
pnpm typecheck      # tsc --noEmit
```

`next.config.mjs` sets `output: 'export'`, so a build produces plain HTML that
any static host will serve. That is not a limitation of this repo — it is how
the live site is deployed, because a static page costs no Worker CPU and
survived concurrent load that server rendering did not.

## Layout

```
app/            24 routes — (app)/ is the shell-wrapped back office, kiosk/ stands alone
components/     80 components in 20 feature folders + components/ui primitives
lib/data/       seeded fixtures every screen reads from
lib/            formatting, risk scoring, shared types
app/globals.css design tokens
```

## Design notes

Light-only and deliberately dense — this is a back office someone sits in all
day, not a landing page. One saturated accent (plate blue) is reserved for
primary actions and the current selection, so nothing else competes with it.
Status colours are a separate desaturated family and are **never used alone** —
always with a border and a label, so the state survives a monochrome screen or a
colour-blind reader.
