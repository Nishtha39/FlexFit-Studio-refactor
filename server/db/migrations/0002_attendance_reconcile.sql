-- Reconcile daily_attendance and attendance_matrix with the check_ins rows.
--
-- WHY: these three were populated from two unrelated generators and were never
-- compared. daily_attendance modelled ~210 visits a day gym-wide while check_ins
-- produced per-member events at roughly half that rate, so the dashboard's
-- "Visits · 30 days" tile read 4,721 while the attendance heatmap directly
-- beneath it summed 2,703 actual rows — same screen, same claimed fact, 75%
-- apart. Found by scripts/verify-numbers.mjs.
--
-- The generator (lib/data/attendance.ts) now COUNTS the events for the window
-- they cover. This migration does the same thing to the data already in the
-- database, rather than re-seeding: counting the rows that are actually there is
-- exact by construction, keeps the 37,000-row check_ins table untouched, and
-- preserves any check-in written since the seed.
--
-- ORDER IS LOAD-BEARING. Step 1 reads the OLD modelled values in the recent
-- window to work out how far off the pre-history is; step 2 then overwrites that
-- window with real counts. Running them the other way round would compute the
-- scale factor against data it had already replaced, and the 18-month trend
-- chart would get a visible cliff at the seam.

-- Step 1 — rescale the months with no check-in rows to meet the counted part.
-- The factor is (real check-ins) / (modelled visits) over the first 56 days of
-- the counted window, so the two halves of the series join smoothly.
UPDATE daily_attendance
SET count = CAST(
  count * (
    SELECT CAST((
      SELECT COUNT(*) FROM check_ins
      WHERE date >= (SELECT MIN(date) FROM check_ins)
        AND date < DATE((SELECT MIN(date) FROM check_ins), '+56 days')
    ) AS REAL) / NULLIF((
      SELECT SUM(count) FROM daily_attendance
      WHERE date >= (SELECT MIN(date) FROM check_ins)
        AND date < DATE((SELECT MIN(date) FROM check_ins), '+56 days')
    ), 0)
  ) AS INTEGER)
WHERE date < (SELECT MIN(date) FROM check_ins);

-- Step 2 — the window check_ins covers is counted, not modelled.
-- A day with no visits is a real zero, not a gap.
UPDATE daily_attendance
SET count = (
  SELECT COUNT(*) FROM check_ins c WHERE c.date = daily_attendance.date
)
WHERE date >= (SELECT MIN(date) FROM check_ins);

-- Step 3 — rebuild the materialised heatmap from its source table.
-- This is the counter that drifts silently: nothing errors when it stops
-- agreeing with check_ins, which is why smoke.mjs asserts the two are equal.
UPDATE attendance_matrix
SET count = (
  SELECT COUNT(*) FROM check_ins c
  WHERE c.weekday = attendance_matrix.weekday AND c.hour = attendance_matrix.hour
);
