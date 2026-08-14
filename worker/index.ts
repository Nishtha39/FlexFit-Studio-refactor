/**
 * The Worker. It does two jobs and keeps them apart:
 *
 *   /api/trpc/*  → the tRPC API over D1
 *   everything else → the statically exported Next app
 *
 * Static assets are matched by the runtime BEFORE this handler runs (that is the
 * default when `assets.binding` is configured), so a page load costs no Worker
 * CPU at all. Only API calls and unmatched paths reach this code. That split is
 * deliberate: an earlier revision server-rendered every page through a Worker
 * and returned 503 on roughly one request in twelve under Next's link
 * prefetching, because free-plan CPU limits are per request and SSR is not free.
 */
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import type { Env } from '../server/db/client'
import { appRouter } from '../server/trpc/routers/_app'
import { createContext } from '../server/trpc/init'

const API_PREFIX = '/api/trpc'

/**
 * Detail routes whose ids are enumerated at BUILD time by generateStaticParams.
 * A record created after the build — a new lead, a new member — has no exported
 * HTML file, so the asset lookup misses and the request lands here. These pages
 * fetch their own data client-side, which means any one of the exported shells
 * renders the right thing once the id in the URL is read. Serving a sibling
 * shell keeps the URL intact instead of 404ing on a record that genuinely exists.
 */
const CLIENT_ROUTED_PREFIXES = ['/members/', '/trainers/', '/corporate/', '/reports/', '/billing/invoices/']

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith(API_PREFIX)) {
      return fetchRequestHandler({
        endpoint: API_PREFIX,
        req: request,
        router: appRouter,
        createContext: () => createContext(env, request),
        onError({ error, path }) {
          // Surfaced in `wrangler tail`. Client-fault codes are expected traffic
          // (a refused booking is a real answer), so only server faults are logged.
          if (error.code === 'INTERNAL_SERVER_ERROR') {
            console.error(`tRPC ${path ?? '<no-path>'} failed:`, error.message)
          }
        },
      })
    }

    // Not an API call: hand it back to the asset server, which will have already
    // failed to match it. Fall back to the section's shell, then to 404.html.
    const prefix = CLIENT_ROUTED_PREFIXES.find((p) => url.pathname.startsWith(p))
    if (prefix) {
      const shell = await env.ASSETS.fetch(new Request(new URL(prefix.slice(0, -1), url), request))
      if (shell.status === 200) {
        // 200, not the shell's own status: the record may well exist, and the
        // page is about to fetch it. A hard 404 here would be a guess.
        return new Response(shell.body, {
          status: 200,
          headers: shell.headers,
        })
      }
    }

    const notFound = await env.ASSETS.fetch(new Request(new URL('/404.html', url), request))
    return new Response(notFound.body, { status: 404, headers: notFound.headers })
  },
}
