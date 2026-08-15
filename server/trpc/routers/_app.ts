/**
 * The API surface, assembled. Split by capability rather than by entity: a
 * booking touches classes, members and companies at once, so filing it under
 * any one of those tables would have scattered the rule.
 */
import { router } from '../init'
import { readRouter } from './read'
import { bookingRouter } from './booking'
import { billingRouter } from './billing'
import { crmRouter } from './crm'
import { opsRouter } from './ops'
import { equipmentRouter } from './equipment'
import { commsRouter } from './comms'
import { queueRouter } from './queue'

export const appRouter = router({
  read: readRouter,
  booking: bookingRouter,
  billing: billingRouter,
  crm: crmRouter,
  ops: opsRouter,
  equipment: equipmentRouter,
  comms: commsRouter,
  queue: queueRouter,
})

/** The client imports this as a type only — no server code reaches the browser. */
export type AppRouter = typeof appRouter
