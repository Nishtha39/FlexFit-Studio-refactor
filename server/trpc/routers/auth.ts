/**
 * Authentication: sign up, sign in, sign out, and "who am I".
 *
 * Sessions are bearer tokens sent in `x-flexfit-session`, not cookies. The site
 * is a static export served by the same Worker, so a cookie would work — but the
 * tRPC fetch adapter has no first-class way to set one per procedure, and a
 * token the client stores explicitly is easier to reason about than a header
 * some middleware is presumed to attach. The trade-off is that XSS can read the
 * token; the mitigation is that it expires and can be revoked server-side.
 *
 * Note what this router does NOT do: it does not gate the other routers. The
 * existing procedures still trust `x-flexfit-actor` for their audit trail, as
 * they always have. Turning that claim into an enforced permission is a
 * separate change touching every procedure, and doing it halfway — some
 * procedures guarded, some not — reads as secure while being anything but.
 */
import { and, eq, gt } from 'drizzle-orm'
import { z } from 'zod'

import { isoStamp, NOW } from '../../../lib/seed'
import { hashPassword, randomId, verifyPassword } from '../../auth/password'
import { accounts, sessions } from '../../db/schema'
import { publicProcedure, refuse, router, type Context } from '../init'

/** Matches AuthRole in lib/types.ts and the four roles in the app shell. */
const roleSchema = z.enum(['owner', 'front_desk', 'trainer', 'member'])

/**
 * Where each role goes once signed in. The same landing screens the role
 * switcher uses, so an authenticated owner sees exactly what the demo owner saw.
 */
const LANDING: Record<z.infer<typeof roleSchema>, string> = {
  owner: '/dashboard',
  front_desk: '/check-in',
  trainer: '/my-schedule',
  member: '/portal',
}

const SESSION_DAYS = 30

/**
 * A password rule that rejects what actually gets broken — length — rather than
 * demanding a symbol and a capital, which pushes people towards Password1! and
 * buys nothing. Twelve characters with no composition rule is the NIST guidance.
 */
const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters — length matters more than symbols.')
  .max(200)

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('That email address looks incomplete.'))

export interface SessionUser {
  id: string
  email: string
  name: string
  role: z.infer<typeof roleSchema>
  landing: string
}

/**
 * The accounts tables ship in migration 0005, which has to be applied to D1 by
 * hand before this code runs against it (the deploy workflow deliberately
 * blocks pushes that touch server/db/migrations/).
 *
 * Until then D1 answers "no such table". Without this, that surfaces as a 500
 * and the sign-in screen shows a blank failure; with it, the UI can say plainly
 * that accounts are not switched on yet. Every other screen is unaffected
 * either way, because nothing outside this router touches these tables.
 */
function isMissingTable(error: unknown): boolean {
  return /no such table/i.test(error instanceof Error ? error.message : String(error))
}

async function guard<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (isMissingTable(error)) {
      return refuse(
        'PRECONDITION_FAILED',
        'Accounts are not set up on this database yet. Apply migration 0005_accounts.sql to D1.',
      )
    }
    throw error
  }
}

/** Reads the bearer token off the request and resolves it to a live session. */
export async function currentUser(ctx: Context): Promise<SessionUser | null> {
  const token = ctx.sessionToken
  if (!token) return null

  const rows = await ctx.db
    .select({
      id: accounts.id,
      email: accounts.email,
      name: accounts.name,
      role: accounts.role,
    })
    .from(sessions)
    .innerJoin(accounts, eq(sessions.accountId, accounts.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, isoStamp(NOW))))
    .limit(1)

  const row = rows[0]
  if (!row) return null
  return { ...row, landing: LANDING[row.role] }
}

async function issueSession(ctx: Context, accountId: string): Promise<string> {
  const token = randomId()
  const expires = new Date(NOW.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await ctx.db.insert(sessions).values({
    token,
    accountId,
    createdAt: isoStamp(NOW),
    expiresAt: isoStamp(expires),
  })
  return token
}

export const authRouter = router({
  /**
   * Create an account.
   *
   * The role is taken from the form. That is right for this product — a gym
   * signs its own staff up, and there is no directory to check them against —
   * but it does mean anyone can claim `owner`. Making that safe needs an invite
   * flow, which is a product decision rather than a missing line of code.
   */
  signUp: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(1, 'Enter your name.').max(120),
        email: emailSchema,
        password: passwordSchema,
        role: roleSchema,
        gym: z.string().trim().max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      guard(async () => {
        const existing = await ctx.db
          .select({ id: accounts.id })
          .from(accounts)
          .where(eq(accounts.email, input.email))
          .limit(1)

        if (existing.length > 0) {
          refuse('CONFLICT', 'An account with that email already exists. Sign in instead.')
        }

        const id = randomId(16)
        const { hash, salt } = await hashPassword(input.password)

        await ctx.db.insert(accounts).values({
          id,
          email: input.email,
          name: input.name,
          role: input.role,
          passwordHash: hash,
          passwordSalt: salt,
          gym: input.gym ?? null,
          createdAt: isoStamp(NOW),
        })

        const token = await issueSession(ctx, id)
        return {
          token,
          user: {
            id,
            email: input.email,
            name: input.name,
            role: input.role,
            landing: LANDING[input.role],
          } satisfies SessionUser,
        }
      }),
    ),

  /**
   * Sign in.
   *
   * One message for both "no such account" and "wrong password". Saying which
   * turns the form into a way to test whether an address is registered.
   */
  signIn: publicProcedure
    .input(z.object({ email: emailSchema, password: z.string().min(1, 'Enter your password.') }))
    .mutation(async ({ ctx, input }) =>
      guard(async () => {
        const rows = await ctx.db
          .select({
            id: accounts.id,
            email: accounts.email,
            name: accounts.name,
            role: accounts.role,
            passwordHash: accounts.passwordHash,
            passwordSalt: accounts.passwordSalt,
          })
          .from(accounts)
          .where(eq(accounts.email, input.email))
          .limit(1)

        const account = rows[0]
        const ok =
          account !== undefined &&
          (await verifyPassword(input.password, {
            hash: account.passwordHash,
            salt: account.passwordSalt,
          }))

        if (!account || !ok) {
          refuse('UNAUTHORIZED', 'That email and password do not match an account.')
        }

        const token = await issueSession(ctx, account.id)
        return {
          token,
          user: {
            id: account.id,
            email: account.email,
            name: account.name,
            role: account.role,
            landing: LANDING[account.role],
          } satisfies SessionUser,
        }
      }),
    ),

  /** Drops the row, so the token stops working everywhere, not just this tab. */
  signOut: publicProcedure.mutation(async ({ ctx }) =>
    guard(async () => {
      if (ctx.sessionToken) {
        await ctx.db.delete(sessions).where(eq(sessions.token, ctx.sessionToken))
      }
      return { ok: true }
    }),
  ),

  /** Null rather than an error when signed out — being logged out is not a fault. */
  me: publicProcedure.query(async ({ ctx }) => {
    try {
      return await currentUser(ctx)
    } catch (error) {
      if (isMissingTable(error)) return null
      throw error
    }
  }),
})
