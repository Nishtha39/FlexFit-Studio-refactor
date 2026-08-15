/**
 * Work items — what a human has already done to a derived queue row.
 *
 * The attention queue, the intervention queue and the dunning ladder are all
 * computed from the entities. That is the right design: a row appears because
 * the underlying facts say it should. But it means none of them can remember
 * "Marco rang her on Tuesday" — no entity holds that, and recomputing the queue
 * brings the row straight back.
 *
 * So this is the one thing those screens store, keyed on the derived row's own
 * id. There is no seed: an untouched row simply has no record, and `stateOf()`
 * treats a missing record as open. That keeps the table small and, more
 * importantly, keeps the queues honest — a row is open because nothing says
 * otherwise, not because something says it is.
 */
import type { WorkItem, WorkItemStatus, WorkQueue } from '@/lib/types'
import { NOW } from '@/lib/seed'

export let workItems: WorkItem[] = []

let byId = new Map<string, WorkItem>()

function index(): void {
  byId = new Map(workItems.map((w) => [w.id, w]))
}

export function setWorkItems(next: WorkItem[]): void {
  workItems = next
  index()
}

/** The stored record for a queue row, or null if nobody has touched it. */
export function workItemFor(id: string): WorkItem | null {
  return byId.get(id) ?? null
}

export interface QueueRowState {
  status: WorkItemStatus
  assigneeId: string | null
  snoozedUntil: string | null
  resolution: string | null
}

/**
 * How a queue row stands right now.
 *
 * A snooze that has run out is reported as `open` rather than being written
 * back to `open` on a timer — the app has no scheduler, and a stored status
 * that only becomes true once someone loads the page would be a lie in the
 * database. The date is the fact; the status is read from it.
 */
export function stateOf(id: string, fallbackAssignee: string | null = null): QueueRowState {
  const w = byId.get(id)
  if (!w) return { status: 'open', assigneeId: fallbackAssignee, snoozedUntil: null, resolution: null }

  const expired = w.status === 'snoozed' && w.snoozedUntil !== null && w.snoozedUntil <= isoDate(NOW)
  return {
    status: expired ? 'open' : w.status,
    assigneeId: w.assigneeId ?? fallbackAssignee,
    snoozedUntil: expired ? null : w.snoozedUntil,
    resolution: w.resolution,
  }
}

/** Every row in one queue that is neither done nor currently snoozed. */
export function openIn(queue: WorkQueue): WorkItem[] {
  return workItems.filter((w) => w.queue === queue && stateOf(w.id).status === 'open')
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
