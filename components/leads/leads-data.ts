// Lead pipeline derivations. Aging is the only editorial choice here: a lead
// that sits still is the failure mode, so every column carries its own SLA.

import { leads } from '@/lib/data/leads'
import { staffById } from '@/lib/data/staff'
import { getPlan } from '@/lib/data/plans'
import type { Lead, LeadSource, LeadStage } from '@/lib/types'

export interface StageMeta {
  id: LeadStage
  label: string
  /** Days after which a lead in this stage is late. */
  slaDays: number
  /** What the next action actually is. */
  nextAction: string
  open: boolean
}

export const STAGES: StageMeta[] = [
  { id: 'new', label: 'New', slaDays: 1, nextAction: 'Call within 24 hours.', open: true },
  { id: 'contacted', label: 'Contacted', slaDays: 4, nextAction: 'Book a tour or a trial class.', open: true },
  { id: 'tour-booked', label: 'Tour booked', slaDays: 7, nextAction: 'Confirm the day before. Assign a trainer.', open: true },
  { id: 'trial', label: 'Trial', slaDays: 10, nextAction: 'Offer a plan on their second visit.', open: true },
  { id: 'won', label: 'Won', slaDays: 999, nextAction: 'Hand off to onboarding.', open: false },
  { id: 'lost', label: 'Lost', slaDays: 999, nextAction: 'Log the reason. Re-market in 90 days.', open: false },
]

export const stageMeta = new Map(STAGES.map((s) => [s.id, s]))

export const SOURCE_LABELS: Record<LeadSource, string> = {
  'walk-in': 'Walk-in',
  referral: 'Referral',
  website: 'Website',
  instagram: 'Instagram',
  google: 'Google',
  corporate: 'Corporate',
}

export interface LeadCard extends Lead {
  ownerName: string
  ownerInitials: string
  planName: string | null
  /** Past the SLA for its stage. */
  late: boolean
}

export function toCard(lead: Lead): LeadCard {
  const owner = staffById.get(lead.ownerId)
  const sla = stageMeta.get(lead.stage)?.slaDays ?? 999
  return {
    ...lead,
    ownerName: owner?.name ?? 'Unassigned',
    ownerInitials: owner?.initials ?? '—',
    planName: lead.interestedPlanId ? (getPlan(lead.interestedPlanId)?.name ?? null) : null,
    late: lead.ageDays > sla,
  }
}

export const leadCards: LeadCard[] = leads.map(toCard)

export function groupByStage(cards: LeadCard[]): Record<LeadStage, LeadCard[]> {
  const out = {} as Record<LeadStage, LeadCard[]>
  for (const stage of STAGES) {
    out[stage.id] = cards
      .filter((c) => c.stage === stage.id)
      .sort((a, b) => Number(b.late) - Number(a.late) || b.ageDays - a.ageDays)
  }
  return out
}

export interface FunnelStep {
  stage: StageMeta
  count: number
  value: number
  late: number
}

export function funnel(cards: LeadCard[]): FunnelStep[] {
  return STAGES.map((stage) => {
    const own = cards.filter((c) => c.stage === stage.id)
    return {
      stage,
      count: own.length,
      value: own.reduce((s, c) => s + c.estValue, 0),
      late: own.filter((c) => c.late).length,
    }
  })
}

export function openPipelineValue(cards: LeadCard[]): number {
  return cards.filter((c) => stageMeta.get(c.stage)?.open).reduce((s, c) => s + c.estValue, 0)
}

export function conversionRate(cards: LeadCard[]): number {
  const closed = cards.filter((c) => c.stage === 'won' || c.stage === 'lost').length
  const won = cards.filter((c) => c.stage === 'won').length
  return closed === 0 ? 0 : (won / closed) * 100
}

export const LOSS_REASONS = [
  'Price',
  'Location / commute',
  'Chose a competitor',
  'Timing — will return',
  'No response after 3 attempts',
] as const
