'use client'

/**
 * The typed API client.
 *
 * `AppRouter` is imported as a TYPE ONLY — `import type` is erased at compile
 * time, so none of the server code, Drizzle, or the D1 driver reaches the
 * browser bundle. What survives is the shape: rename a procedure or change an
 * input and this file's callers stop compiling, which is the point of putting
 * tRPC in front of the database rather than hand-rolled `fetch` calls.
 *
 * Same origin by design. The site is a static export served by the same Worker
 * that answers `/api/trpc`, so there is no base URL to configure, no CORS, and
 * nothing to keep in step between environments.
 */
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '@/server/trpc/routers/_app'

/** Where the Worker mounts the router. Must match `API_PREFIX` in worker/index.ts. */
const ENDPOINT = '/api/trpc'

export const api = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: ENDPOINT,
      /**
       * The role switcher is a UI control, not a session — the app has no
       * authentication. This header is recorded on the audit trail so events say
       * who did something, and is deliberately NOT trusted for authorisation.
       */
      headers() {
        return { 'x-flexfit-actor': currentActor }
      },
    }),
  ],
})

let currentActor = 'system'

/** Called by the role switcher so events carry the acting role. */
export function setActor(actor: string): void {
  currentActor = actor
}

export type Bootstrap = Awaited<ReturnType<typeof api.read.bootstrap.query>>
