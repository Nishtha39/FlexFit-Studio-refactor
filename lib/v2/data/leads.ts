/**
 * SANDBOX FIXTURE — do not copy into FlexFit-Studio-refactor.
 *
 * Matches the repo's `leads` / `leadById` / `leadsByStage` exports.
 */

import type { Lead, LeadSource, LeadStage } from '@/lib/v2/types'

interface Seed {
  name: string
  source: LeadSource
  stage: LeadStage
  ownerId: string
  ageDays: number
  estValue: number
  interestedPlanId: string | null
  note: string
}

const seeds: Seed[] = [
  { name: 'Priya Nair', source: 'website', stage: 'new', ownerId: 's-05', ageDays: 1, estValue: 3200, interestedPlanId: 'p-studio', note: 'Filled the pricing form at 11pm, asked about 6am slots.' },
  { name: 'Manish Gupta', source: 'walk-in', stage: 'contacted', ownerId: 's-05', ageDays: 3, estValue: 2600, interestedPlanId: 'p-studio', note: 'Walked in after work, wants to compare with the gym next door.' },
  { name: 'Lakshmi Venkat', source: 'referral', stage: 'tour-booked', ownerId: 's-06', ageDays: 2, estValue: 4500, interestedPlanId: 'p-elite', note: 'Referred by Ananya Sharma. Tour booked Thursday 7pm.' },
  { name: 'Zoya Khan', source: 'instagram', stage: 'trial', ownerId: 's-05', ageDays: 5, estValue: 3200, interestedPlanId: 'p-studio', note: 'On day 2 of the 3-day trial. Attended Metcon Engine.' },
  { name: 'Harish Kumar', source: 'google', stage: 'contacted', ownerId: 's-06', ageDays: 11, estValue: 2600, interestedPlanId: null, note: 'Two calls unanswered, one SMS delivered. Going stale.' },
  { name: 'Ritika Shah', source: 'corporate', stage: 'won', ownerId: 's-06', ageDays: 8, estValue: 5400, interestedPlanId: 'p-elite', note: 'Signed under the Zeta Labs corporate agreement.' },
  { name: 'Sameer Dutta', source: 'walk-in', stage: 'lost', ownerId: 's-05', ageDays: 16, estValue: 2600, interestedPlanId: null, note: 'Chose a cheaper option closer to home.' },
  { name: 'Anjali Kaur', source: 'referral', stage: 'new', ownerId: 's-05', ageDays: 0, estValue: 4500, interestedPlanId: 'p-elite', note: 'Called about personal training add-ons.' },
]

function build(): Lead[] {
  return seeds.map((s, i) => ({
    id: `l-${String(i + 1).padStart(2, '0')}`,
    name: s.name,
    email: `${s.name.split(' ')[0].toLowerCase()}@example.com`,
    phone: '+91 98800 0000' + i,
    source: s.source,
    stage: s.stage,
    ownerId: s.ownerId,
    // Derived from ageDays against a fixed reference date so it never drifts.
    createdDate: new Date(Date.UTC(2025, 3, 14 - s.ageDays)).toISOString().slice(0, 10),
    ageDays: s.ageDays,
    estValue: s.estValue,
    interestedPlanId: s.interestedPlanId,
    note: s.note,
  }))
}

export let leads: Lead[] = build()

export let leadById = new Map(leads.map((l) => [l.id, l]))

export function leadsByStage(stage: LeadStage): Lead[] {
  return leads.filter((l) => l.stage === stage)
}

export function staleLeads(thresholdDays = 7): Lead[] {
  return leads.filter(
    (l) => l.ageDays >= thresholdDays && l.stage !== 'won' && l.stage !== 'lost',
  )
}
