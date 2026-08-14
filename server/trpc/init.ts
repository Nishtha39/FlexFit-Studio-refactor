/**
 * tRPC wiring. The router is the API's only public surface — there are no REST
 * handlers to keep in step with it, and the client imports `AppRouter` as a
 * type, so a renamed procedure or a changed input is a compile error in the UI
 * rather than a 404 in production.
 */
import { initTRPC, TRPCError } from '@trpc/server'
import type { Db, Env } from '../db/client'
import { getDb } from '../db/client'
import { events } from '../db/schema'
import { isoStamp, NOW } from '../../lib/seed'

export interface Context {
  db: Db
  env: Env
  /**
   * Who is acting. The app has no authentication — the role switcher is a UI
   * control, not a session — so this is the client's claim and is recorded for
   * the audit trail only. It is deliberately NOT used to authorise anything;
   * see README-BACKEND.md for what that would take.
   */
  actor: string
}

export function createContext(env: Env, req: Request): Context {
  return {
    db: getDb(env),
    env,
    actor: req.headers.get('x-flexfit-actor') ?? 'system',
  }
}

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

/**
 * Every mutation writes an event. Staff actions like "called this member" or
 * "paused access" change nothing an entity can hold on its own, and the dunning
 * ladder reads them back to work out which rung an invoice is on — which is
 * why that rung never had to become a column.
 */
export async function recordEvent(
  ctx: Context,
  e: { kind: string; entityType: string; entityId: string; summary: string; payload?: Record<string, unknown> },
): Promise<void> {
  await ctx.db.insert(events).values({
    at: isoStamp(NOW),
    kind: e.kind,
    entityType: e.entityType,
    entityId: e.entityId,
    actor: ctx.actor,
    summary: e.summary,
    payload: e.payload ?? null,
  })
}

/** Refusals become typed tRPC errors so the UI can show the real reason. */
export function refuse(code: TRPCError['code'], message: string): never {
  throw new TRPCError({ code, message })
}
