-- 0004 — lifetime value stops collapsing when a member is touched.
--
-- THE BUG. `recomputeMemberMetrics` set metric_lifetime_value to the sum of the
-- member's rows in `payments`. That reads as obviously right and is obviously
-- wrong here, because the payments table is ONE BILLING CYCLE, not the member's
-- history: 65 rows across 54 of 380 members. 326 members have no payment row at
-- all.
--
-- So any write that recomputed metrics — a kiosk check-in was enough — replaced
-- a modelled multi-year lifetime value with a single-cycle sum, or with zero.
-- The worst case in the seed: the highest-value member on the books drops from
-- ₹4,32,378 to ₹0 the moment she scans in. She then loses the `vip` tag (which
-- is `lifetimeValue >= 90000`), falls to the bottom of a directory sorted by
-- value, and changes the revenue reports. Nothing errored; the number simply
-- became wrong, which is the hardest kind of wrong to notice.
--
-- THE FIX. Lifetime value is a baseline plus what the ledger has recorded since:
--
--     metric_lifetime_value = metric_lifetime_base + sum(non-pending payments)
--
-- `metric_lifetime_base` is everything the member paid before the ledger window
-- opened. Backfilled here as (current value − current ledger sum), floored at
-- zero. What changes afterwards is that a new payment adds exactly its own
-- amount, and a refund subtracts exactly its own amount, instead of both being
-- overwritten by a partial replay.
--
-- THE FLOOR IS NOT COSMETIC, and it is the one case where this migration moves
-- a number. A member whose ledger records MORE than their stored lifetime value
-- would need a negative base to keep the old figure — which would assert that
-- the ledger over-counts real money it actually took. It does not, so the base
-- clamps at 0 and their lifetime value rises to the money genuinely recorded
-- against them. On production this was 2 members of 380 (+₹11,417 across the
-- whole book); the other 378 are unchanged to the rupee. Nobody's value falls.
--
-- A member created from now on starts with a base of 0, which is true — they
-- have paid nothing before their first payment, and every rupee they ever pay
-- goes through the ledger.
--
-- Additive and idempotent-safe to run once. Note SQLite has no
-- ADD COLUMN IF NOT EXISTS: a second run fails with "duplicate column name",
-- and that failure IS the signal it already applied.
--
-- RUN ORDER: this must come AFTER seed.sql, not before. `seed.sql` deliberately
-- does not mention metric_lifetime_base — it is derived from the seeded values
-- and the seeded ledger, so naming it in the seed would only duplicate the sum
-- below, and would make the seed fail against the base schema that has no such
-- column. Fresh local setup is therefore:
--
--     db:local → seed:local → …equipment/attendance/notes… → this file

ALTER TABLE members ADD COLUMN metric_lifetime_base INTEGER NOT NULL DEFAULT 0;

UPDATE members
SET metric_lifetime_base = MAX(
  0,
  metric_lifetime_value - COALESCE(
    (SELECT SUM(p.amount) FROM payments p
      WHERE p.member_id = members.id AND p.status != 'pending'),
    0
  )
);

-- Re-derive the stored value through the new formula. For every existing member
-- this writes back the number that was already there; it exists so the invariant
-- holds by construction from the first row rather than from the first write.
UPDATE members
SET metric_lifetime_value = metric_lifetime_base + COALESCE(
  (SELECT SUM(p.amount) FROM payments p
    WHERE p.member_id = members.id AND p.status != 'pending'),
  0
);
