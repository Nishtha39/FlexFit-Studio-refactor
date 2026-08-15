/**
 * Rescheduled class occurrences.
 *
 * `components/schedule/schedule-engine.ts` resolves every occurrence against a
 * list of moves — it always did, but the list lived in component state, so the
 * timetable snapped back on reload while the toast claimed members had been
 * notified. This is that list, loaded from the database.
 *
 * Empty by default and never seeded: a studio with no reschedules has no rows,
 * and the published timetable is exactly the `classes` table.
 */
import type { ClassMove } from '@/components/schedule/schedule-engine'

export let classMoves: ClassMove[] = []

export function setClassMoves(next: ClassMove[]): void {
  classMoves = next
}
