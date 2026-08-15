/**
 * SANDBOX SUBSET — do not copy into FlexFit-Studio-refactor.
 *
 * The repo already ships a much richer `lib/types.ts`. This file mirrors only
 * the shapes the new detail screens read, using the repo's exact field names,
 * so those screens compile here and drop straight into the repo unchanged.
 */

export type ID = string

export type LocationId = 'indiranagar' | 'koramangala' | 'whitefield'

export const LOCATION_LABELS: Record<LocationId, string> = {
  indiranagar: 'Indiranagar',
  koramangala: 'Koramangala',
  whitefield: 'Whitefield',
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------
export type StaffRole = 'trainer' | 'manager' | 'front-desk' | 'owner'

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
  active: boolean
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------
export type MembershipStatus = 'active' | 'paused' | 'expired' | 'cancelled'

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
  joinedDate: string
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------
export type ClassType =
  | 'Strength'
  | 'HIIT'
  | 'Yoga'
  | 'Spin'
  | 'Pilates'
  | 'Boxing'
  | 'Mobility'
  | 'CrossFit'

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
// Leads
// ---------------------------------------------------------------------------
export type LeadStage =
  | 'new'
  | 'contacted'
  | 'tour-booked'
  | 'trial'
  | 'won'
  | 'lost'

export type LeadSource =
  | 'walk-in'
  | 'referral'
  | 'website'
  | 'instagram'
  | 'google'
  | 'corporate'

export interface Lead {
  id: ID
  name: string
  email: string
  phone: string
  source: LeadSource
  stage: LeadStage
  ownerId: ID
  createdDate: string
  ageDays: number
  /** Estimated monthly value in INR if converted. */
  estValue: number
  interestedPlanId: ID | null
  note: string
}

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------
export type EquipmentCategory =
  | 'cardio'
  | 'strength'
  | 'free-weights'
  | 'functional'
  | 'recovery'
  | 'studio'

/**
 * `retired` is terminal and distinct from `out-of-service`: a retired asset is
 * gone from the floor and stops counting toward capacity, an out-of-service one
 * is expected back.
 */
export type EquipmentStatus =
  | 'in-service'
  | 'needs-service'
  | 'out-of-service'
  | 'retired'

export interface Equipment {
  id: ID
  name: string
  category: EquipmentCategory
  make: string
  model: string
  assetTag: string
  location: LocationId
  zone: string
  quantity: number
  status: EquipmentStatus
  purchaseDate: string
  unitCost: number
  usefulLifeMonths: number
  serviceIntervalDays: number
  lastServiceDate: string | null
  bookable: boolean
  slotMinutes: number
  notes: string
}

export interface EquipmentFault {
  id: ID
  equipmentId: ID
  reportedBy: ID
  reporterName: string
  reportedDate: string
  severity: 'low' | 'medium' | 'high'
  summary: string
  resolvedDate: string | null
}

export interface EquipmentService {
  id: ID
  equipmentId: ID
  date: string
  vendor: string
  cost: number
  notes: string
}
