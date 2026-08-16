// FlexFit Studio — shared type contract.
// This is the single source of truth for every generated entity. Later batches
// import these types and MUST NOT redefine them.

export type ID = string

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------
export type LocationId = "downtown" | "riverside" | "north-loop"

export interface Location {
  id: LocationId
  name: string
  shortName: string
  timezone: string
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------
export type StaffRole = "owner" | "manager" | "trainer" | "front-desk"

/**
 * Who an account signs in as.
 *
 * Deliberately not StaffRole. That describes a job on the payroll and has no
 * "member" — the people who make up most of the sign-ins. These four are the
 * roles the shell already reshapes itself around
 * (components/shell/role-context.tsx), and each one has a landing screen there,
 * so authenticating to one of these values is enough to route a person home.
 */
export type AuthRole = "owner" | "front_desk" | "trainer" | "member"

export interface Staff {
  id: ID
  firstName: string
  lastName: string
  name: string
  initials: string
  role: StaffRole
  email: string
  phone: string
  specialties: string[]
  locations: LocationId[]
  activeFrom: string // ISO date
  activeTo: string | null // ISO date if departed, else null
  active: boolean
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------
export type PlanInterval = "per-visit" | "monthly" | "annual"

export interface Plan {
  id: ID
  name: string
  description: string
  interval: PlanInterval
  /** Price in INR (major units). */
  price: number
  /** Allowed visits per month; null = unlimited. */
  visitsPerMonth: number | null
  /** Whether this plan is offered to corporate pools only. */
  corporateOnly: boolean
  active: boolean
  perks: string[]
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------
export type MembershipStatus = "trial" | "active" | "frozen" | "expired" | "cancelled"

export interface MemberMetrics {
  tenureMonths: number
  /** ISO date of most recent visit, or null if never visited. */
  lastVisit: string | null
  daysSinceLastVisit: number | null
  visitsLast30: number
  visitsPrev30: number
  avgVisitsPerWeek: number
  /** Plan allowance per month, null = unlimited. */
  planVisitsPerMonth: number | null
  /** Remaining pre-paid credits (limited plans / corporate), null = n/a. */
  creditsRemaining: number | null
  freezeCount: number
  /** Share of bookings the member cancelled, 0..1. */
  cancelRate: number
  failedPayments: number
  /** Lifetime value in INR. */
  lifetimeValue: number
  /** Monthly recurring value in INR. */
  monthlyValue: number
}

export interface Member {
  id: ID
  firstName: string
  lastName: string
  name: string
  initials: string
  email: string
  phone: string
  status: MembershipStatus
  planId: ID
  homeLocation: LocationId
  assignedTrainerId: ID | null
  companyId: ID | null
  joinedDate: string // ISO date
  endDate: string | null // ISO date for expired/cancelled
  tags: string[]
  metrics: MemberMetrics
  risk: RiskResult
}

// ---------------------------------------------------------------------------
// Risk (scoring lives in lib/risk.ts; these are the shapes it produces)
// ---------------------------------------------------------------------------
export type RiskBand = "low" | "medium" | "high"

export interface RiskFactor {
  key: string
  label: string
  /** Points this factor contributes to the total score. */
  points: number
  detail: string
}

export interface RiskResult {
  score: number // 0..100
  band: RiskBand
  factors: RiskFactor[] // sorted by points desc, only contributing factors
}

export interface RiskInput {
  status: MembershipStatus
  daysSinceLastVisit: number | null
  visitsLast30: number
  visitsPrev30: number
  planVisitsPerMonth: number | null
  tenureMonths: number
  failedPayments: number
  cancelRate: number
  freezeCount: number
}

// ---------------------------------------------------------------------------
// Classes / schedule
// ---------------------------------------------------------------------------
export type ClassType = "Strength" | "HIIT" | "Yoga" | "Spin" | "Pilates" | "Boxing" | "Mobility" | "CrossFit"

export interface GymClass {
  id: ID
  name: string
  type: ClassType
  trainerId: ID
  location: LocationId
  /** 0 = Sunday ... 6 = Saturday */
  dayOfWeek: number
  startTime: string // "18:00"
  durationMin: number
  capacity: number
  /** Confirmed member ids on the roster. */
  roster: ID[]
  /** Member ids on the waitlist, in position order. */
  waitlist: ID[]
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------
export interface DailyAttendance {
  date: string // ISO date
  count: number
}

export interface CheckIn {
  id: ID
  memberId: ID
  location: LocationId
  timestamp: string // ISO
  date: string // ISO date
  /** 0-23 */
  hour: number
  /** 0 = Sunday ... 6 = Saturday */
  weekday: number
  classId: ID | null
}

// ---------------------------------------------------------------------------
// Payments / billing
// ---------------------------------------------------------------------------
export type PaymentMethod = "card" | "cash" | "upi" | "transfer"
export type PaymentStatus = "paid" | "pending" | "failed" | "refunded"

export interface Payment {
  id: ID
  invoiceId: string
  memberId: ID
  planId: ID | null
  amount: number // INR, negative for refund reversal rows
  method: PaymentMethod
  status: PaymentStatus
  date: string // ISO
  description: string
  /** For a refund reversal row, the id of the original payment. */
  reversalOf: ID | null
}

// ---------------------------------------------------------------------------
// Corporate pools
// ---------------------------------------------------------------------------
export interface Company {
  id: ID
  name: string
  contactName: string
  contactEmail: string
  planId: ID
  /** Total pre-purchased credits in the pool. */
  poolCredits: number
  /** Credits consumed so far. */
  creditsUsed: number
  /** Average credits burned per week. */
  burnRatePerWeek: number
  employeeMemberIds: ID[]
  startDate: string // ISO date
  renewalDate: string // ISO date
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------
export type LeadStage = "new" | "contacted" | "tour-booked" | "trial" | "won" | "lost"
export type LeadSource = "walk-in" | "referral" | "website" | "instagram" | "google" | "corporate"

export interface Lead {
  id: ID
  name: string
  email: string
  phone: string
  source: LeadSource
  stage: LeadStage
  ownerId: ID // staff id
  createdDate: string // ISO date
  ageDays: number
  /** Estimated monthly value in INR if converted. */
  estValue: number
  interestedPlanId: ID | null
  note: string
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export type NotificationSeverity = "info" | "success" | "warning" | "critical"
export type NotificationKind = "payment" | "retention" | "class" | "corporate" | "lead" | "system"

export interface AppNotification {
  id: ID
  kind: NotificationKind
  severity: NotificationSeverity
  title: string
  body: string
  timestamp: string // ISO
  read: boolean
  /** Optional linked entity for deep-linking. */
  entity: { type: "member" | "class" | "company" | "payment" | "lead"; id: ID } | null
}

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------
// Added after the original ten entities. It is a genuine entity rather than a
// derivation: an asset has an identity, a purchase price, a service history and
// a physical location, none of which can be computed from anything else here.
//
// Four tables, because they answer four different questions and have different
// lifetimes: what we own (`Equipment`), what is broken (`EquipmentFault`), what
// it has cost to keep running (`EquipmentService`), and who has reserved it
// (`EquipmentReservation`). Folding faults into a status column on the asset
// would lose who reported it and when, which is the whole point of a fault log.

export type EquipmentCategory =
  | "cardio"
  | "strength"
  | "free-weights"
  | "functional"
  | "recovery"
  | "studio"

/**
 * `retired` is terminal and distinct from `out-of-service`: a retired asset is
 * gone from the floor and stops counting toward capacity, an out-of-service one
 * is expected back. Reports need to tell those apart.
 */
export type EquipmentStatus = "in-service" | "needs-service" | "out-of-service" | "retired"

export interface Equipment {
  id: ID
  name: string
  category: EquipmentCategory
  make: string
  model: string
  /** Asset tag stencilled on the machine — what a trainer reads off the frame. */
  assetTag: string
  location: LocationId
  /** Where on the floor: "Cardio deck", "Rig 2", "Studio B". */
  zone: string
  /** Identical units of this asset in that zone (8 treadmills = one row, qty 8). */
  quantity: number
  status: EquipmentStatus
  purchaseDate: string // ISO date
  /** Purchase price per unit, INR. */
  unitCost: number
  /** Straight-line depreciation period. Book value is derived, never stored. */
  usefulLifeMonths: number
  /** Days between routine services. Due date is derived from the last service. */
  serviceIntervalDays: number
  lastServiceDate: string | null // ISO date
  /** Members may reserve this (a court, a reformer, a sled lane). */
  bookable: boolean
  /** Length of one reservation slot, minutes. Meaningless when !bookable. */
  slotMinutes: number
  notes: string
}

export type FaultSeverity = "minor" | "major" | "unsafe"
export type FaultStatus = "open" | "acknowledged" | "resolved"

export interface EquipmentFault {
  id: ID
  equipmentId: ID
  /** Staff id or member id — anyone on the floor can report a fault. */
  reportedBy: ID
  reporterName: string
  reportedAt: string // ISO
  severity: FaultSeverity
  summary: string
  status: FaultStatus
  resolvedAt: string | null
  resolutionNote: string | null
}

export type ServiceKind = "routine" | "repair" | "inspection" | "install"

export interface EquipmentService {
  id: ID
  equipmentId: ID
  date: string // ISO date
  kind: ServiceKind
  vendor: string
  /** INR. Install rows carry the purchase cost so lifetime spend adds up. */
  cost: number
  note: string
}

export type ReservationStatus = "booked" | "cancelled" | "completed"

export interface EquipmentReservation {
  id: ID
  equipmentId: ID
  memberId: ID
  date: string // ISO date
  startTime: string // "18:00"
  durationMin: number
  status: ReservationStatus
  createdAt: string // ISO
}

// ---------------------------------------------------------------------------
// Member notes
// ---------------------------------------------------------------------------
/**
 * A note written against a member by a member of staff. Pinning is the one
 * decision the notes screen makes operational: a pinned note is shown at the
 * kiosk before the door opens, so it is an instruction rather than a comment.
 */
export type NoteKind = "note" | "call" | "injury" | "goal" | "complaint"

export interface MemberNote {
  id: ID
  memberId: ID
  kind: NoteKind
  body: string
  authorId: ID
  timestamp: string // ISO
  pinned: boolean
}

// ---------------------------------------------------------------------------
// Work items
// ---------------------------------------------------------------------------
/**
 * A decision recorded against a *derived* queue row.
 *
 * The attention queue, the intervention queue and the dunning ladder are all
 * computed from the entities — nothing about a member says "someone already
 * rang them about this". That fact is not derivable, so it is the one thing
 * those queues genuinely need to store, keyed on the derived row's stable id.
 *
 * Deliberately generic rather than three near-identical tables: the three
 * queues differ in how their rows are computed, not in what a human does to
 * one — pick it up, put it off, or finish it.
 */
export type WorkQueue = "attention" | "retention" | "dunning"
export type WorkItemStatus = "open" | "snoozed" | "done"

export interface WorkItem {
  /** The derived row's own id, e.g. `ret-m-0142`. */
  id: ID
  queue: WorkQueue
  status: WorkItemStatus
  assigneeId: ID | null
  /** ISO date; the row returns to the queue on its own once this passes. */
  snoozedUntil: string | null
  /** What was done, in the queue's own words. */
  resolution: string | null
  note: string | null
  updatedAt: string // ISO
  updatedBy: ID
}
