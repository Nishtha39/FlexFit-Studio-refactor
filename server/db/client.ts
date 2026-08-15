import type { D1Database } from '@cloudflare/workers-types'
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from './schema'

/**
 * The static-asset binding, typed structurally against the DOM `Request`/
 * `Response` rather than imported from `@cloudflare/workers-types`.
 *
 * Both halves of this repo share one tsconfig, which is compiled with `lib: dom`
 * for React. Cloudflare's own `Fetcher` returns its `Response`, whose
 * `ReadableStream` is a different (incompatible) type from the DOM one, so
 * importing it makes every `env.ASSETS.fetch()` call fail to type-check. The
 * Worker only ever calls `.fetch`, so declaring exactly that is both sufficient
 * and accurate.
 */
export interface AssetFetcher {
  fetch(request: Request): Promise<Response>
}

/**
 * Worker bindings, as declared in wrangler.jsonc.
 *
 * The email variables are optional and are SECRETS, not config — they are set
 * with `wrangler secret put` and never appear in wrangler.jsonc. When they are
 * absent the app still runs; the mail procedures refuse with a message naming
 * what is missing rather than pretending to send. See server/email/send.ts.
 */
export interface Env {
  DB: D1Database
  ASSETS: AssetFetcher
  /** Resend API key. Without it, no mail is sent and the UI says so. */
  RESEND_API_KEY?: string
  /** "FlexFit Studio <hello@yourdomain.com>" — must be a Resend-verified domain. */
  EMAIL_FROM?: string
  EMAIL_REPLY_TO?: string
}

export type Db = DrizzleD1Database<typeof schema>

/**
 * A D1 binding only exists inside a request, so the client is built per request
 * rather than at module scope. Drizzle's D1 driver is a thin wrapper over the
 * binding — there is no pool to reuse and nothing is saved by caching it.
 */
export function getDb(env: Env): Db {
  return drizzle(env.DB, { schema })
}

export { schema }
