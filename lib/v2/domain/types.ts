/**
 * Domain types for FlexFit Studio.
 *
 * These describe the shapes the UI renders. They are deliberately free of any
 * transport or persistence concerns so the same types can be produced by the
 * fixture modules in `lib/data/*` today and by tRPC procedures backed by
 * Drizzle/SQLite later, without any change to the components.
 */

export type Trend = 'up' | 'down' | 'flat'

/** A single headline number on the dashboard. */
export interface Metric {
  id: string
  label: string
  value: string
  /** Signed, pre-formatted delta such as "+6%". Omit when there is no compare. */
  delta?: string
  trend?: Trend
}

/** One weekday column of the stacked "new members" area chart. */
export interface AcquisitionPoint {
  day: string
  walkIn: number
  referral: number
  campaign: number
}

/** One cell of the check-in density grid: a weekday/hour intensity pair. */
export interface CheckInCell {
  /** 0-based day index within the rendered window. */
  day: number
  /** Row index, mapped to `CHECK_IN_HOURS`. */
  hour: number
  /** Normalised 0-1 occupancy used to pick a swatch. */
  intensity: number
}

export type MemberStage = 'enquiry' | 'trial' | 'onboarding' | 'active'

export type MemberTag = 'New lead' | 'Returning' | 'Priority' | 'Follow-up'

/** A member card in the lifecycle board. */
export interface MemberRecord {
  id: string
  name: string
  summary: string
  tag: MemberTag
  stage: MemberStage
  owner: Staff
  date: string
  sessions: number
  notes: number
}

export interface Staff {
  id: string
  name: string
  role: string
  avatar: string
}

export interface NavItem {
  label: string
  href: string
  icon: string
  /** False while the route is not built yet, so the rail can avoid dead links. */
  ready?: boolean
}

/** Landing page content blocks. */
export interface Feature {
  title: string
  description: string
  icon: string
}

export interface Testimonial {
  quote: string
  name: string
  role: string
  avatar: string
}

export interface Plan {
  name: string
  price: string
  cadence: string
  description: string
  features: string[]
  featured?: boolean
}
