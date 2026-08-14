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
