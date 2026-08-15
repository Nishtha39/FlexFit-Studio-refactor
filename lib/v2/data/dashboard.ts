/**
 * Dashboard fixtures.
 *
 * Every export here is a pure value with an explicit domain type. When the
 * tRPC router lands, replace each `const` with the matching query and the
 * components consuming them stay untouched.
 */

import type {
  AcquisitionPoint,
  CheckInCell,
  MemberRecord,
  MemberStage,
  Metric,
  NavItem,
  Staff,
} from '@/lib/v2/domain/types'

export const SIDEBAR_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutGrid', ready: true },
  { label: 'Members', href: '/dashboard/members', icon: 'Users' },
  { label: 'Classes', href: '/dashboard/classes', icon: 'CalendarDays' },
  { label: 'Trainers', href: '/dashboard/trainers', icon: 'Dumbbell' },
  { label: 'Billing', href: '/dashboard/billing', icon: 'CreditCard' },
  { label: 'Settings', href: '/dashboard/settings', icon: 'Settings' },
]

export const STAFF: Record<string, Staff> = {
  priya: {
    id: 'priya',
    name: 'Priya Nair',
    role: 'Head Coach',
    avatar: '/images/staff-priya.png',
  },
  marcus: {
    id: 'marcus',
    name: 'Marcus Hale',
    role: 'Membership Lead',
    avatar: '/images/staff-marcus.png',
  },
  elena: {
    id: 'elena',
    name: 'Elena Ruiz',
    role: 'Strength Coach',
    avatar: '/images/staff-elena.png',
  },
  dev: {
    id: 'dev',
    name: 'Dev Patel',
    role: 'Front Desk',
    avatar: '/images/staff-dev.png',
  },
}

export const TEAM: Staff[] = [STAFF.priya, STAFF.marcus, STAFF.elena, STAFF.dev]

/** Two headline tiles shown in the top-right rail. */
export const HEADLINE_METRICS: Metric[] = [
  { id: 'active', label: 'Active members', value: '1,284', delta: '+6%', trend: 'up' },
  { id: 'revenue', label: 'Monthly revenue', value: '$92,410', delta: '+12%', trend: 'up' },
]

/** Secondary strip beneath the board header. */
export const SECONDARY_METRICS: Metric[] = [
  { id: 'checkins', label: 'Check-ins today', value: '412', delta: '+18', trend: 'up' },
  { id: 'classes', label: 'Classes running', value: '26', delta: '+3', trend: 'up' },
  { id: 'retention', label: '90-day retention', value: '87%', delta: '+2%', trend: 'up' },
  { id: 'churn', label: 'At-risk members', value: '34', delta: '-5', trend: 'down' },
]

export const ACQUISITION: AcquisitionPoint[] = [
  { day: 'Mon', walkIn: 4, referral: 3, campaign: 2 },
  { day: 'Tue', walkIn: 6, referral: 4, campaign: 3 },
  { day: 'Wed', walkIn: 5, referral: 6, campaign: 4 },
  { day: 'Thu', walkIn: 8, referral: 5, campaign: 6 },
  { day: 'Fri', walkIn: 7, referral: 7, campaign: 5 },
  { day: 'Sat', walkIn: 11, referral: 6, campaign: 4 },
  { day: 'Sun', walkIn: 9, referral: 4, campaign: 3 },
]

/** Highlighted point surfaced in the chart callout. */
export const ACQUISITION_CALLOUT = {
  day: 'Thu',
  breakdown: [
    { label: 'Walk-in', value: 8 },
    { label: 'Referral', value: 5 },
    { label: 'Campaign', value: 6 },
  ],
}

export const CHECK_IN_HOURS = ['6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM']

export const CHECK_IN_DAYS = 14

/**
 * Deterministic occupancy grid. Generated from a fixed seed rather than
 * `Math.random()` so the server and client renders always agree.
 */
export const CHECK_INS: CheckInCell[] = (() => {
  const cells: CheckInCell[] = []
  // Peak intensity per hour row: mornings and evenings are busiest.
  const hourWeight = [0.62, 0.44, 0.35, 0.48, 0.95, 0.58]

  for (let hour = 0; hour < CHECK_IN_HOURS.length; hour += 1) {
    for (let day = 0; day < CHECK_IN_DAYS; day += 1) {
      // Cheap deterministic hash keeps the texture varied but stable.
      const noise = ((day * 37 + hour * 91) % 23) / 23
      const weekend = day % 7 === 5 || day % 7 === 6
      const base = hourWeight[hour] * (weekend ? 0.72 : 1)
      cells.push({
        day,
        hour,
        intensity: Math.min(1, Math.max(0.08, base * (0.62 + noise * 0.62))),
      })
    }
  }

  return cells
})()

export const STAGES: { id: MemberStage; label: string }[] = [
  { id: 'enquiry', label: 'Enquiry' },
  { id: 'trial', label: 'Trial' },
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'active', label: 'Active' },
]

export const MEMBERS: MemberRecord[] = [
  {
    id: 'm1',
    name: 'Aster Rowe',
    summary: 'Walked in from the Camden flyer. Wants strength focus, 3x a week.',
    tag: 'New lead',
    stage: 'enquiry',
    owner: STAFF.marcus,
    date: '13 May',
    sessions: 2,
    notes: 4,
  },
  {
    id: 'm2',
    name: 'Nova Reid',
    summary: 'Lapsed annual member from 2023. Asking about the new spin studio.',
    tag: 'Returning',
    stage: 'enquiry',
    owner: STAFF.dev,
    date: '25 May',
    sessions: 1,
    notes: 2,
  },
  {
    id: 'm3',
    name: 'Bright Kaur',
    summary: 'Corporate referral. Needs a shared invoice across four colleagues.',
    tag: 'Returning',
    stage: 'trial',
    owner: STAFF.priya,
    date: '29 May',
    sessions: 4,
    notes: 6,
  },
  {
    id: 'm4',
    name: 'North Adeyemi',
    summary: 'Two trial classes done. Deciding between off-peak and full access.',
    tag: 'New lead',
    stage: 'trial',
    owner: STAFF.elena,
    date: '28 May',
    sessions: 5,
    notes: 12,
  },
  {
    id: 'm5',
    name: 'Pulse Okafor',
    summary: 'Signed the 12-month plan. Induction with a strength coach pending.',
    tag: 'Priority',
    stage: 'onboarding',
    owner: STAFF.priya,
    date: '13 May',
    sessions: 2,
    notes: 4,
  },
  {
    id: 'm6',
    name: 'Green Lindqvist',
    summary: 'Physio clearance received. Programme build scheduled for Friday.',
    tag: 'Returning',
    stage: 'onboarding',
    owner: STAFF.elena,
    date: '13 May',
    sessions: 2,
    notes: 4,
  },
  {
    id: 'm7',
    name: 'Bloom Marchetti',
    summary: 'Six months in, attendance climbing. Candidate for the coaching tier.',
    tag: 'Follow-up',
    stage: 'active',
    owner: STAFF.priya,
    date: '1 May',
    sessions: 12,
    notes: 17,
  },
  {
    id: 'm8',
    name: 'Atlas Vance',
    summary: 'Family plan, four passes. Renewal lands at the end of the quarter.',
    tag: 'Follow-up',
    stage: 'active',
    owner: STAFF.marcus,
    date: '3 May',
    sessions: 6,
    notes: 14,
  },
]

/** The single nudge rendered in the sidebar's inverted card. */
export const PRIORITY_NUDGE = {
  title: 'Priority member',
  body: 'Pulse Okafor is mid-onboarding with no induction booked. Assign a coach to keep the plan moving.',
  action: 'Assign coach',
}

export function membersByStage(stage: MemberStage): MemberRecord[] {
  return MEMBERS.filter((member) => member.stage === stage)
}
