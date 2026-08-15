/**
 * FlexFit Studio — persistence schema (Drizzle / SQLite, run on Cloudflare D1).
 *
 * Two rules from MERGE-NOTES govern what is and is not a table here:
 *
 *  1. "lib/types.ts stays the single type contract and no new seed entity was
 *     invented." So this file stores exactly the ten entities that contract
 *     defines, and nothing else. **There is deliberately no `invoices` table** —
 *     an invoice is a derivation over `payments` (`components/billing/billing-data.ts`),
 *     as are dunning items, pool health, lead cards and every report. Persisting
 *     a derivation would create a second source of truth that can disagree with
 *     the ledger it came from.
 *
 *  2. Payments are an append-only ledger: "refund adds a row, never edits one."
 *     Nothing in the API updates a payment row's amount or status in place; a
 *     reversal is a new row pointing at the original through `reversalOf`.
 *
 * `risk` is likewise absent: it is a pure function of a member's metrics
 * (`lib/risk.ts`) and is computed on read, so a stored copy can never go stale.
 *
 * Column names are snake_case in SQLite and camelCase in TypeScript, matching
 * the field names in lib/types.ts so the mapping stays obvious.
 */

import { relations, sql } from 'drizzle-orm'
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type {
  ClassType,
  EquipmentCategory,
  EquipmentStatus,
  FaultSeverity,
  FaultStatus,
  LeadSource,
  LeadStage,
  LocationId,
  MembershipStatus,
  NotificationKind,
  NotificationSeverity,
  NoteKind,
  PaymentMethod,
  PaymentStatus,
  PlanInterval,
  ReservationStatus,
  ServiceKind,
  StaffRole,
  WorkItemStatus,
  WorkQueue,
} from '@/lib/types'

/**
 * `text().$type<T>()` keeps the union types from lib/types.ts all the way down to
 * the column, so an invalid status is a compile error rather than a runtime
 * surprise. SQLite has no enum type, so this is the only place the constraint
 * can live besides a CHECK.
 */

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------
export const locations = sqliteTable('locations', {
  id: text('id').$type<LocationId>().primaryKey(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  timezone: text('timezone').notNull(),
})

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------
export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  interval: text('interval').$type<PlanInterval>().notNull(),
  /** INR, major units. Integer because the app never prices in paise. */
  price: integer('price').notNull(),
  /** null = unlimited. */
  visitsPerMonth: integer('visits_per_month'),
  corporateOnly: integer('corporate_only', { mode: 'boolean' }).notNull().default(false),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  perks: text('perks', { mode: 'json' }).$type<string[]>().notNull(),
})

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------
export const staff = sqliteTable(
  'staff',
  {
    id: text('id').primaryKey(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    name: text('name').notNull(),
    initials: text('initials').notNull(),
    role: text('role').$type<StaffRole>().notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    specialties: text('specialties', { mode: 'json' }).$type<string[]>().notNull(),
    locations: text('locations', { mode: 'json' }).$type<LocationId[]>().notNull(),
    activeFrom: text('active_from').notNull(),
    /** ISO date if departed, else null. The departed trainer is load-bearing: the
     *  March 2025 attendance step-down is explained by their leaving. */
    activeTo: text('active_to'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [index('staff_role_idx').on(t.role)],
)

// ---------------------------------------------------------------------------
// Companies (corporate credit pools)
// ---------------------------------------------------------------------------
export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  contactName: text('contact_name').notNull(),
  contactEmail: text('contact_email').notNull(),
  planId: text('plan_id')
    .notNull()
    .references(() => plans.id),
  poolCredits: integer('pool_credits').notNull(),
  creditsUsed: integer('credits_used').notNull().default(0),
  burnRatePerWeek: real('burn_rate_per_week').notNull(),
  startDate: text('start_date').notNull(),
  renewalDate: text('renewal_date').notNull(),
})

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------
/**
 * Metrics are stored flat (`metric_*`) rather than as a JSON blob because the
 * directory sorts and filters on them — `visitsLast30`, `monthlyValue` and
 * `daysSinceLastVisit` all need to be indexable columns, not fields inside a
 * document. They are derived from check-ins and payments, and are recomputed by
 * `server/domain/metrics.ts` on every write that can move them, so the
 * denormalisation never drifts.
 */
export const members = sqliteTable(
  'members',
  {
    id: text('id').primaryKey(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    name: text('name').notNull(),
    initials: text('initials').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    status: text('status').$type<MembershipStatus>().notNull(),
    planId: text('plan_id')
      .notNull()
      .references(() => plans.id),
    homeLocation: text('home_location')
      .$type<LocationId>()
      .notNull()
      .references(() => locations.id),
    assignedTrainerId: text('assigned_trainer_id').references(() => staff.id),
    companyId: text('company_id').references(() => companies.id),
    joinedDate: text('joined_date').notNull(),
    endDate: text('end_date'),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull(),

    // --- MemberMetrics (see lib/types.ts) ---
    metricTenureMonths: integer('metric_tenure_months').notNull(),
    metricLastVisit: text('metric_last_visit'),
    metricDaysSinceLastVisit: integer('metric_days_since_last_visit'),
    metricVisitsLast30: integer('metric_visits_last30').notNull(),
    metricVisitsPrev30: integer('metric_visits_prev30').notNull(),
    metricAvgVisitsPerWeek: real('metric_avg_visits_per_week').notNull(),
    metricPlanVisitsPerMonth: integer('metric_plan_visits_per_month'),
    /** Remaining pre-paid credits (limited / corporate plans); null = n/a. */
    metricCreditsRemaining: integer('metric_credits_remaining'),
    metricFreezeCount: integer('metric_freeze_count').notNull(),
    metricCancelRate: real('metric_cancel_rate').notNull(),
    metricFailedPayments: integer('metric_failed_payments').notNull(),
    metricLifetimeValue: integer('metric_lifetime_value').notNull(),
    /**
     * What the member paid before the ledger window opened.
     *
     * `payments` holds one billing cycle, not a member's history, so summing it
     * is not their lifetime value — it is only the part of it this table can
     * see. Lifetime value is therefore this base plus the ledger, and a payment
     * adds exactly its own amount rather than triggering a partial replay that
     * silently rewrites years of history. See migration 0004.
     */
    metricLifetimeBase: integer('metric_lifetime_base').notNull().default(0),
    metricMonthlyValue: integer('metric_monthly_value').notNull(),
  },
  (t) => [
    index('members_status_idx').on(t.status),
    index('members_company_idx').on(t.companyId),
    index('members_trainer_idx').on(t.assignedTrainerId),
    index('members_plan_idx').on(t.planId),
  ],
)

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------
export const classes = sqliteTable(
  'classes',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: text('type').$type<ClassType>().notNull(),
    trainerId: text('trainer_id')
      .notNull()
      .references(() => staff.id),
    location: text('location')
      .$type<LocationId>()
      .notNull()
      .references(() => locations.id),
    /** 0 = Sunday … 6 = Saturday */
    dayOfWeek: integer('day_of_week').notNull(),
    startTime: text('start_time').notNull(),
    durationMin: integer('duration_min').notNull(),
    capacity: integer('capacity').notNull(),
  },
  (t) => [index('classes_day_idx').on(t.dayOfWeek), index('classes_trainer_idx').on(t.trainerId)],
)

/**
 * Roster and waitlist as rows, not as the two `ID[]` arrays the type contract
 * describes. Booking is the app's most contended write — two members can take
 * the last seat in the same second — and a JSON array cannot express "insert
 * only if fewer than `capacity` rows exist" as one atomic statement, nor give
 * the waitlist a stable position that survives someone in the middle cancelling.
 * The arrays are rebuilt on read, so `GymClass` in lib/types.ts is unchanged.
 */
export const classSeats = sqliteTable(
  'class_seats',
  {
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<'roster' | 'waitlist'>().notNull(),
    /** Order within the waitlist; always 0 for roster rows. */
    position: integer('position').notNull().default(0),
    bookedAt: text('booked_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.classId, t.memberId] }),
    index('class_seats_member_idx').on(t.memberId),
    index('class_seats_class_kind_idx').on(t.classId, t.kind),
  ],
)

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------
export const checkIns = sqliteTable(
  'check_ins',
  {
    id: text('id').primaryKey(),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    location: text('location').$type<LocationId>().notNull(),
    timestamp: text('timestamp').notNull(),
    date: text('date').notNull(),
    hour: integer('hour').notNull(),
    /** 0 = Sunday … 6 = Saturday */
    weekday: integer('weekday').notNull(),
    classId: text('class_id').references(() => classes.id),
  },
  (t) => [
    index('check_ins_member_idx').on(t.memberId),
    index('check_ins_date_idx').on(t.date),
    index('check_ins_member_date_idx').on(t.memberId, t.date),
  ],
)

/** Gym-wide daily totals for the trailing 18 months. */
export const dailyAttendance = sqliteTable('daily_attendance', {
  date: text('date').primaryKey(),
  count: integer('count').notNull(),
})

/**
 * Materialised hour × weekday totals for the dashboard heatmap.
 *
 * D1 bills rows *scanned*, and the heatmap is a `GROUP BY weekday, hour` over
 * ~37,000 check-ins. Serving it from the source table would spend the free
 * tier's daily read budget in roughly a hundred page loads. This is 168 rows,
 * maintained on each new check-in, so the dashboard costs a rounding error.
 */
export const attendanceMatrix = sqliteTable(
  'attendance_matrix',
  {
    weekday: integer('weekday').notNull(),
    hour: integer('hour').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.weekday, t.hour] })],
)

// ---------------------------------------------------------------------------
// Payments — APPEND ONLY
// ---------------------------------------------------------------------------
/**
 * `invoiceId` is a plain string, not a foreign key, because there is no invoice
 * table: an invoice is the set of payment rows sharing an id. A refund inserts a
 * negative-amount row whose `reversalOf` points at the row it reverses; the
 * original row is never touched, so the ledger always adds up by replay.
 */
export const payments = sqliteTable(
  'payments',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id').notNull(),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    planId: text('plan_id').references(() => plans.id),
    /** INR; negative on a reversal row. */
    amount: integer('amount').notNull(),
    method: text('method').$type<PaymentMethod>().notNull(),
    status: text('status').$type<PaymentStatus>().notNull(),
    date: text('date').notNull(),
    description: text('description').notNull(),
    reversalOf: text('reversal_of'),
  },
  (t) => [
    index('payments_member_idx').on(t.memberId),
    index('payments_invoice_idx').on(t.invoiceId),
    index('payments_status_idx').on(t.status),
  ],
)

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------
/**
 * `ageDays` is in lib/types.ts, but it is not a column: it is `NOW - createdDate`
 * and a stored copy would be wrong the next morning. It is computed on read.
 */
export const leads = sqliteTable(
  'leads',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    source: text('source').$type<LeadSource>().notNull(),
    stage: text('stage').$type<LeadStage>().notNull(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => staff.id),
    createdDate: text('created_date').notNull(),
    estValue: integer('est_value').notNull(),
    interestedPlanId: text('interested_plan_id').references(() => plans.id),
    note: text('note').notNull().default(''),
    /** Set when the stage moves to `lost`; null otherwise. */
    lostReason: text('lost_reason'),
  },
  (t) => [index('leads_stage_idx').on(t.stage), index('leads_owner_idx').on(t.ownerId)],
)

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    kind: text('kind').$type<NotificationKind>().notNull(),
    severity: text('severity').$type<NotificationSeverity>().notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    timestamp: text('timestamp').notNull(),
    read: integer('read', { mode: 'boolean' }).notNull().default(false),
    /** Flattened from the `entity` object so it can be indexed and deep-linked. */
    entityType: text('entity_type').$type<'member' | 'class' | 'company' | 'payment' | 'lead'>(),
    entityId: text('entity_id'),
  },
  (t) => [index('notifications_read_idx').on(t.read)],
)

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------
/**
 * Four tables rather than one, because they have different lifetimes and answer
 * different questions. `status` on the asset is the current headline; the fault
 * log is who reported what and when; the service log is what it has cost to
 * keep. Collapsing any of those into a column on the asset would throw away the
 * history that the maintenance spend and the "third failure this quarter"
 * judgement are made of.
 *
 * Nothing here is derived. Book value, next-service date, overdue days and
 * utilisation are all computed in components/equipment/equipment-data.ts, for
 * the same reason `member.risk` has no column: a stored copy goes stale the
 * moment anything it depends on moves.
 */
export const equipment = sqliteTable(
  'equipment',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    category: text('category').$type<EquipmentCategory>().notNull(),
    make: text('make').notNull(),
    model: text('model').notNull(),
    /** Stencilled on the frame — what a trainer reads off the machine. */
    assetTag: text('asset_tag').notNull(),
    location: text('location')
      .$type<LocationId>()
      .notNull()
      .references(() => locations.id),
    zone: text('zone').notNull(),
    /** Identical units on one register line: 8 treadmills = 1 row, quantity 8. */
    quantity: integer('quantity').notNull().default(1),
    status: text('status').$type<EquipmentStatus>().notNull(),
    purchaseDate: text('purchase_date').notNull(),
    /** INR per unit. */
    unitCost: integer('unit_cost').notNull(),
    usefulLifeMonths: integer('useful_life_months').notNull(),
    serviceIntervalDays: integer('service_interval_days').notNull(),
    lastServiceDate: text('last_service_date'),
    bookable: integer('bookable', { mode: 'boolean' }).notNull().default(false),
    slotMinutes: integer('slot_minutes').notNull().default(30),
    notes: text('notes').notNull().default(''),
  },
  (t) => [
    index('equipment_location_idx').on(t.location),
    index('equipment_status_idx').on(t.status),
    index('equipment_bookable_idx').on(t.bookable),
  ],
)

export const equipmentFaults = sqliteTable(
  'equipment_faults',
  {
    id: text('id').primaryKey(),
    equipmentId: text('equipment_id')
      .notNull()
      .references(() => equipment.id, { onDelete: 'cascade' }),
    /** Staff id OR member id — anyone on the floor can report a fault, so this
     *  deliberately has no foreign key: it points into two different tables. */
    reportedBy: text('reported_by').notNull(),
    reporterName: text('reporter_name').notNull(),
    reportedAt: text('reported_at').notNull(),
    severity: text('severity').$type<FaultSeverity>().notNull(),
    summary: text('summary').notNull(),
    status: text('status').$type<FaultStatus>().notNull(),
    resolvedAt: text('resolved_at'),
    resolutionNote: text('resolution_note'),
  },
  (t) => [
    index('equipment_faults_equipment_idx').on(t.equipmentId),
    index('equipment_faults_status_idx').on(t.status),
  ],
)

export const equipmentServices = sqliteTable(
  'equipment_services',
  {
    id: text('id').primaryKey(),
    equipmentId: text('equipment_id')
      .notNull()
      .references(() => equipment.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    kind: text('kind').$type<ServiceKind>().notNull(),
    vendor: text('vendor').notNull(),
    /** INR. The `install` row carries the purchase cost, so lifetime spend on an
     *  asset is a plain SUM over this table with no special case. */
    cost: integer('cost').notNull(),
    note: text('note').notNull().default(''),
  },
  (t) => [
    index('equipment_services_equipment_idx').on(t.equipmentId),
    index('equipment_services_date_idx').on(t.date),
  ],
)

/**
 * Member reservations of a bookable asset.
 *
 * Unlike `class_seats` this cannot be a composite primary key on
 * (equipment, member): the same member may book the same sauna twice in a week,
 * and two different members may hold the same asset at once when quantity > 1.
 * The clash rule is an interval overlap counted against `quantity`, enforced in
 * the router — see server/domain/equipment-rules.ts.
 */
export const equipmentReservations = sqliteTable(
  'equipment_reservations',
  {
    id: text('id').primaryKey(),
    equipmentId: text('equipment_id')
      .notNull()
      .references(() => equipment.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    startTime: text('start_time').notNull(),
    durationMin: integer('duration_min').notNull(),
    status: text('status').$type<ReservationStatus>().notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('equipment_res_equipment_date_idx').on(t.equipmentId, t.date),
    index('equipment_res_member_idx').on(t.memberId),
  ],
)

// ---------------------------------------------------------------------------
// Operational tables — not seed entities, so lib/types.ts is untouched
// ---------------------------------------------------------------------------
/**
 * Append-only record of staff actions that change nothing an entity can hold on
 * its own: "front desk called this member", "access paused", "retry attempted".
 * The dunning ladder reads it to work out which rung an invoice is on, which is
 * why that rung never had to become a column.
 */
export const events = sqliteTable(
  'events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    at: text('at').notNull(),
    kind: text('kind').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    /** Staff id, or 'system' for anything the app did on its own. */
    actor: text('actor').notNull(),
    summary: text('summary').notNull(),
    payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>(),
  },
  (t) => [
    index('events_entity_idx').on(t.entityType, t.entityId),
    index('events_kind_idx').on(t.kind),
    index('events_at_idx').on(t.at),
  ],
)

// ---------------------------------------------------------------------------
// Class moves
// ---------------------------------------------------------------------------
/**
 * A rescheduled class occurrence.
 *
 * Stored as a *log of moves* rather than by editing `classes.day_of_week`,
 * because the schedule screen supports moving one occurrence, this-and-later,
 * or the whole series — and only the last of those is expressible as an edit to
 * the class row. `components/schedule/schedule-engine.ts` already resolves a
 * template date against a list of moves in exactly this shape; this table is
 * that list, made durable. Later moves win, which is why insertion order is
 * kept via `created_at`.
 */
export const classMoves = sqliteTable(
  'class_moves',
  {
    id: text('id').primaryKey(),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    scope: text('scope').$type<'one' | 'following' | 'all'>().notNull(),
    /** The occurrence date the move was made from. */
    fromIso: text('from_iso').notNull(),
    toIso: text('to_iso').notNull(),
    toStartTime: text('to_start_time').notNull(),
    createdAt: text('created_at').notNull(),
    createdBy: text('created_by').notNull(),
  },
  (t) => [index('class_moves_class_idx').on(t.classId)],
)

// ---------------------------------------------------------------------------
// Member notes
// ---------------------------------------------------------------------------
/**
 * Notes are their own table rather than a JSON column on the member because
 * they are appended constantly by different people and read back filtered by
 * kind — and because the pinned ones are what the kiosk shows the front desk
 * before it opens the door, which is a query, not a blob.
 */
export const memberNotes = sqliteTable(
  'member_notes',
  {
    id: text('id').primaryKey(),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id),
    kind: text('kind').$type<NoteKind>().notNull(),
    body: text('body').notNull(),
    authorId: text('author_id').notNull(),
    timestamp: text('timestamp').notNull(),
    pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('member_notes_member_idx').on(t.memberId), index('member_notes_pinned_idx').on(t.pinned)],
)

// ---------------------------------------------------------------------------
// Work items
// ---------------------------------------------------------------------------
/**
 * The one fact the three derived queues cannot compute: whether a human has
 * already dealt with a row. See the `WorkItem` doc comment in lib/types.ts.
 *
 * A row exists only once somebody has touched the item — an untouched queue row
 * is simply absent, which is why the client treats "no row" as open rather than
 * seeding one per derived item.
 */
export const workItems = sqliteTable(
  'work_items',
  {
    id: text('id').primaryKey(),
    queue: text('queue').$type<WorkQueue>().notNull(),
    status: text('status').$type<WorkItemStatus>().notNull(),
    assigneeId: text('assignee_id').references(() => staff.id),
    snoozedUntil: text('snoozed_until'),
    resolution: text('resolution'),
    note: text('note'),
    updatedAt: text('updated_at').notNull(),
    updatedBy: text('updated_by').notNull(),
  },
  (t) => [index('work_items_queue_idx').on(t.queue, t.status)],
)

/** Studio settings — one row per key so a save touches only what changed. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(current_timestamp)`),
})

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const memberRelations = relations(members, ({ one, many }) => ({
  plan: one(plans, { fields: [members.planId], references: [plans.id] }),
  company: one(companies, { fields: [members.companyId], references: [companies.id] }),
  trainer: one(staff, { fields: [members.assignedTrainerId], references: [staff.id] }),
  seats: many(classSeats),
  checkIns: many(checkIns),
  payments: many(payments),
}))

export const classRelations = relations(classes, ({ one, many }) => ({
  trainer: one(staff, { fields: [classes.trainerId], references: [staff.id] }),
  seats: many(classSeats),
}))

export const classSeatRelations = relations(classSeats, ({ one }) => ({
  class: one(classes, { fields: [classSeats.classId], references: [classes.id] }),
  member: one(members, { fields: [classSeats.memberId], references: [members.id] }),
}))

export const companyRelations = relations(companies, ({ one, many }) => ({
  plan: one(plans, { fields: [companies.planId], references: [plans.id] }),
  employees: many(members),
}))

export const paymentRelations = relations(payments, ({ one }) => ({
  member: one(members, { fields: [payments.memberId], references: [members.id] }),
  plan: one(plans, { fields: [payments.planId], references: [plans.id] }),
}))

export const leadRelations = relations(leads, ({ one }) => ({
  owner: one(staff, { fields: [leads.ownerId], references: [staff.id] }),
  interestedPlan: one(plans, { fields: [leads.interestedPlanId], references: [plans.id] }),
}))
