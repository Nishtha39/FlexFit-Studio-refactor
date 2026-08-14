import type { Member } from '@/lib/types'
import type { FilterValue } from '@/components/ui/filter-chip'
import { NOW, daysBetween } from '@/lib/seed'
import { chipStatusFor, utilizationFor, type MemberChipStatus } from './member-view'

/**
 * The directory's query model. Filters are declarative and serializable so the
 * saved views in the sidebar are literally the same objects the filter bar
 * builds — a saved view is not a special code path, it is a preset.
 */

export type SortKey =
  | 'name'
  | 'status'
  | 'risk'
  | 'lastVisit'
  | 'visits30'
  | 'ltv'
  | 'monthly'
  | 'joined'
  | 'tenure'

export type SortDirection = 'asc' | 'desc'

export interface MemberFilters {
  search: string
  statuses: MemberChipStatus[]
  riskBands: ('low' | 'medium' | 'high')[]
  planIds: string[]
  locations: string[]
  trainerIds: string[]
  tags: string[]
  /** Only members whose last visit is at least this many days ago. */
  inactiveDays: number | null
  /** Only members with at least one failed payment. */
  failedPaymentsOnly: boolean
  /** Only members using less than 40% of a limited plan. */
  underUsingOnly: boolean
  /** Only members who joined within this many days. */
  joinedWithinDays: number | null
}

export const EMPTY_FILTERS: MemberFilters = {
  search: '',
  statuses: [],
  riskBands: [],
  planIds: [],
  locations: [],
  trainerIds: [],
  tags: [],
  inactiveDays: null,
  failedPaymentsOnly: false,
  underUsingOnly: false,
  joinedWithinDays: null,
}

export const STATUS_OPTIONS: { id: MemberChipStatus; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'at_risk', label: 'At risk' },
  { id: 'past_due', label: 'Past due' },
  { id: 'trial', label: 'Trial' },
  { id: 'frozen', label: 'Frozen' },
  { id: 'lapsed', label: 'Lapsed' },
]

export const RISK_OPTIONS: { id: 'low' | 'medium' | 'high'; label: string }[] = [
  { id: 'high', label: 'High (70+)' },
  { id: 'medium', label: 'Watch (40–69)' },
  { id: 'low', label: 'Low (0–39)' },
]

/* -------------------------------------------------------------------------- */
/* Saved views — the sidebar presets, defined as real filter payloads.         */
/* -------------------------------------------------------------------------- */

export interface SavedViewDef {
  id: string
  label: string
  description: string
  filters: Partial<MemberFilters>
  sort: { key: SortKey; dir: SortDirection }
}

export const SAVED_VIEW_DEFS: SavedViewDef[] = [
  {
    id: 'at-risk',
    label: 'At risk · high value',
    description: 'High churn risk, ranked by lifetime value — where a save is worth the most.',
    filters: { riskBands: ['high'] },
    sort: { key: 'ltv', dir: 'desc' },
  },
  {
    id: 'expiring-30',
    label: 'Expiring in 30 days',
    description: 'Memberships lapsing within the month.',
    filters: { statuses: ['lapsed'] },
    sort: { key: 'lastVisit', dir: 'asc' },
  },
  {
    id: 'failed-payments',
    label: 'Failed payments',
    description: 'At least one failed charge on record.',
    filters: { failedPaymentsOnly: true },
    sort: { key: 'monthly', dir: 'desc' },
  },
  {
    id: 'new-60',
    label: 'Joined last 60 days',
    description: 'New members still forming the habit.',
    filters: { joinedWithinDays: 60 },
    sort: { key: 'joined', dir: 'desc' },
  },
  {
    id: 'unsigned-waiver',
    label: 'Unsigned waivers',
    description: 'Trial members who have not completed a waiver.',
    filters: { statuses: ['trial'] },
    sort: { key: 'joined', dir: 'desc' },
  },
  {
    id: 'under-using',
    label: 'Under-using their plan',
    description: 'Paying for materially more than they use — a downgrade or a nudge.',
    filters: { underUsingOnly: true },
    sort: { key: 'monthly', dir: 'desc' },
  },
]

export function savedViewById(id: string | null | undefined) {
  if (!id) return undefined
  return SAVED_VIEW_DEFS.find((v) => v.id === id)
}

/* -------------------------------------------------------------------------- */
/* Filtering                                                                   */
/* -------------------------------------------------------------------------- */

function matchesSearch(member: Member, query: string) {
  if (!query) return true
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    member.name.toLowerCase().includes(q) ||
    member.email.toLowerCase().includes(q) ||
    member.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
    member.id.toLowerCase().includes(q)
  )
}

export function applyFilters(members: Member[], filters: MemberFilters): Member[] {
  return members.filter((m) => {
    if (!matchesSearch(m, filters.search)) return false
    if (filters.statuses.length && !filters.statuses.includes(chipStatusFor(m))) return false
    if (filters.riskBands.length && !filters.riskBands.includes(m.risk.band)) return false
    if (filters.planIds.length && !filters.planIds.includes(m.planId)) return false
    if (filters.locations.length && !filters.locations.includes(m.homeLocation)) return false
    if (filters.trainerIds.length) {
      const id = m.assignedTrainerId ?? 'none'
      if (!filters.trainerIds.includes(id)) return false
    }
    if (filters.tags.length && !filters.tags.some((t) => m.tags.includes(t))) return false
    if (filters.inactiveDays !== null) {
      const d = m.metrics.daysSinceLastVisit
      if (d === null || d < filters.inactiveDays) return false
    }
    if (filters.failedPaymentsOnly && m.metrics.failedPayments === 0) return false
    if (filters.underUsingOnly) {
      const u = utilizationFor(m)
      if (u === null || u >= 0.4) return false
    }
    if (filters.joinedWithinDays !== null) {
      // Measured against the dataset's fixed NOW, not the wall clock, so this
      // count is identical on the server and in the browser.
      const daysSinceJoin = daysBetween(new Date(m.joinedDate), NOW)
      if (daysSinceJoin > filters.joinedWithinDays) return false
    }
    return true
  })
}

/* -------------------------------------------------------------------------- */
/* Sorting                                                                     */
/* -------------------------------------------------------------------------- */

const STATUS_ORDER: MemberChipStatus[] = [
  'past_due',
  'at_risk',
  'trial',
  'active',
  'frozen',
  'lapsed',
]

function sortValue(member: Member, key: SortKey): number | string {
  switch (key) {
    case 'name':
      return `${member.lastName} ${member.firstName}`.toLowerCase()
    case 'status':
      return STATUS_ORDER.indexOf(chipStatusFor(member))
    case 'risk':
      return member.risk.score
    case 'lastVisit':
      // Never-visited sorts as maximally stale.
      return member.metrics.daysSinceLastVisit ?? 9999
    case 'visits30':
      return member.metrics.visitsLast30
    case 'ltv':
      return member.metrics.lifetimeValue
    case 'monthly':
      return member.metrics.monthlyValue
    case 'joined':
      return new Date(member.joinedDate).getTime()
    case 'tenure':
      return member.metrics.tenureMonths
  }
}

export function applySort(members: Member[], key: SortKey, dir: SortDirection): Member[] {
  const factor = dir === 'asc' ? 1 : -1
  return members.slice().sort((a, b) => {
    const av = sortValue(a, key)
    const bv = sortValue(b, key)
    if (typeof av === 'string' || typeof bv === 'string') {
      return String(av).localeCompare(String(bv)) * factor
    }
    if (av === bv) return a.name.localeCompare(b.name)
    return (av - bv) * factor
  })
}

/* -------------------------------------------------------------------------- */
/* Filters → removable chips                                                   */
/* -------------------------------------------------------------------------- */

export interface ChipDescriptor extends FilterValue {
  /** Which filter key this chip removes when dismissed. */
  clear: (filters: MemberFilters) => MemberFilters
}

export function describeFilters(
  filters: MemberFilters,
  lookup: {
    planName: (id: string) => string
    locationName: (id: string) => string
    trainerName: (id: string) => string
  },
): ChipDescriptor[] {
  const chips: ChipDescriptor[] = []

  for (const status of filters.statuses) {
    const label = STATUS_OPTIONS.find((s) => s.id === status)?.label ?? status
    chips.push({
      id: `status:${status}`,
      field: 'Status',
      value: label,
      clear: (f) => ({ ...f, statuses: f.statuses.filter((s) => s !== status) }),
    })
  }

  for (const band of filters.riskBands) {
    const label = RISK_OPTIONS.find((r) => r.id === band)?.label ?? band
    chips.push({
      id: `risk:${band}`,
      field: 'Risk',
      value: label,
      clear: (f) => ({ ...f, riskBands: f.riskBands.filter((b) => b !== band) }),
    })
  }

  for (const planId of filters.planIds) {
    chips.push({
      id: `plan:${planId}`,
      field: 'Plan',
      value: lookup.planName(planId),
      clear: (f) => ({ ...f, planIds: f.planIds.filter((p) => p !== planId) }),
    })
  }

  for (const loc of filters.locations) {
    chips.push({
      id: `loc:${loc}`,
      field: 'Location',
      value: lookup.locationName(loc),
      clear: (f) => ({ ...f, locations: f.locations.filter((l) => l !== loc) }),
    })
  }

  for (const trainerId of filters.trainerIds) {
    chips.push({
      id: `trainer:${trainerId}`,
      field: 'Trainer',
      value: lookup.trainerName(trainerId),
      clear: (f) => ({ ...f, trainerIds: f.trainerIds.filter((t) => t !== trainerId) }),
    })
  }

  for (const tag of filters.tags) {
    chips.push({
      id: `tag:${tag}`,
      field: 'Tag',
      value: tag,
      clear: (f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }),
    })
  }

  if (filters.inactiveDays !== null) {
    chips.push({
      id: 'inactive',
      field: 'Last visit',
      operator: 'over',
      value: `${filters.inactiveDays}d ago`,
      clear: (f) => ({ ...f, inactiveDays: null }),
    })
  }

  if (filters.failedPaymentsOnly) {
    chips.push({
      id: 'failed',
      field: 'Payments',
      value: 'Has failures',
      clear: (f) => ({ ...f, failedPaymentsOnly: false }),
    })
  }

  if (filters.underUsingOnly) {
    chips.push({
      id: 'under-using',
      field: 'Utilization',
      operator: 'under',
      value: '40%',
      clear: (f) => ({ ...f, underUsingOnly: false }),
    })
  }

  if (filters.joinedWithinDays !== null) {
    chips.push({
      id: 'joined-within',
      field: 'Joined',
      operator: 'within',
      value: `${filters.joinedWithinDays}d`,
      clear: (f) => ({ ...f, joinedWithinDays: null }),
    })
  }

  if (filters.search) {
    chips.push({
      id: 'search',
      field: 'Search',
      value: filters.search,
      clear: (f) => ({ ...f, search: '' }),
    })
  }

  return chips
}
