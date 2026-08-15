/**
 * Work queues — the attention queue, the intervention queue and the dunning
 * ladder.
 *
 * All three rows are *derived*: they appear because the entities say they
 * should. That is the right design and it is not changed here. What it cannot
 * express is the one fact those screens kept losing on every reload — that
 * somebody has already picked the row up, put it off, or finished with it.
 *
 * So this router stores exactly that, keyed on the derived row's own id, and
 * nothing else. It does not store the row, its title, its severity or its value;
 * all of those are recomputed from the entities every time, so a queue can
 * never show a stale copy of a member's risk next to a live decision about it.
 *
 * One procedure rather than assign/snooze/resolve/reopen, because they are the
 * same write with different fields set, and four procedures would each need the
 * same upsert and the same guards.
 */
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { publicProcedure, recordEvent, refuse, router } from '../init'
import { staff, workItems } from '../../db/schema'
import { toWorkItem } from '../../domain/mappers'
import { NOW, isoDate, isoStamp } from '../../../lib/seed'

const QUEUES = ['attention', 'retention', 'dunning'] as const
const STATUSES = ['open', 'snoozed', 'done'] as const

export const queueRouter = router({
  /**
   * Record what was done to a queue row.
   *
   * Upsert, not insert: an untouched row has no record at all, so the first
   * action creates one and every later action edits it. Reopening a row writes
   * `open` rather than deleting the record, because who reopened it and when is
   * part of the trail.
   */
  setState: publicProcedure
    .input(
      z.object({
        /** The derived row's id — `interventionQueue`/`attentionItems` mint these. */
        id: z.string().min(1).max(120),
        queue: z.enum(QUEUES),
        status: z.enum(STATUSES),
        assigneeId: z.string().nullable().default(null),
        /** ISO date. Required when snoozing — a snooze with no end never returns. */
        snoozedUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
        resolution: z.string().max(200).nullable().default(null),
        note: z.string().max(1000).nullable().default(null),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.status === 'snoozed' && !input.snoozedUntil) {
        refuse('BAD_REQUEST', 'A snooze needs a date to come back on, or the row would never return to the queue.')
      }
      if (input.status === 'snoozed' && input.snoozedUntil! <= isoDate(NOW)) {
        refuse('BAD_REQUEST', 'That snooze date has already passed — the row would come straight back.')
      }
      if (input.assigneeId) {
        const s = await ctx.db.select().from(staff).where(eq(staff.id, input.assigneeId))
        if (!s[0]) refuse('NOT_FOUND', 'No staff member with that id.')
        if (!s[0].active) {
          refuse('BAD_REQUEST', `${s[0].name} has left — assign this to somebody who is still here.`)
        }
      }

      const row = {
        id: input.id,
        queue: input.queue,
        status: input.status,
        assigneeId: input.assigneeId,
        // Clearing the status back to open clears the date with it, so a stale
        // "snoozed until" cannot sit on a row that is live again.
        snoozedUntil: input.status === 'snoozed' ? input.snoozedUntil : null,
        resolution: input.status === 'done' ? input.resolution : null,
        note: input.note,
        updatedAt: isoStamp(NOW),
        updatedBy: ctx.actor,
      }

      await ctx.db
        .insert(workItems)
        .values(row)
        .onConflictDoUpdate({ target: workItems.id, set: row })

      await recordEvent(ctx, {
        kind: `queue.${input.status}`,
        entityType: 'work-item',
        entityId: input.id,
        summary: `${input.queue}: ${input.id} → ${input.status}`,
        payload: {
          assigneeId: input.assigneeId,
          snoozedUntil: row.snoozedUntil,
          resolution: row.resolution,
        },
      })

      return toWorkItem(row)
    }),
})
