import type { Config } from 'drizzle-kit'

/**
 * D1 is SQLite, so the generated migrations are plain SQLite DDL and are applied
 * with `wrangler d1 execute --file`. `drizzle-kit push` is deliberately not used:
 * the same .sql has to run against the local D1 and the remote one, and a file we
 * can read is also a file we can review.
 */
export default {
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
} satisfies Config
