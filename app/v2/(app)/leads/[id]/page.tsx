import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { leadById, leads } from '@/lib/v2/data/leads'
import { getStaff } from '@/lib/v2/data/staff'
import { LeadDetailView } from '@/components/v2/leads/lead-detail-view'

interface PageProps {
  params: Promise<{ id: string }>
}

/** Threshold shared with the leads board's "stale" filter. */
const STALE_AFTER_DAYS = 7

const PLAN_NAMES: Record<string, string> = {
  'p-studio': 'Studio',
  'p-elite': 'Elite',
}

export function generateStaticParams() {
  return leads.map((l) => ({ id: l.id }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const lead = leadById.get(id)
  if (!lead) return { title: 'Lead not found — FlexFit Studio' }
  return {
    title: `${lead.name} — FlexFit Studio`,
    description: `${lead.source} lead at stage ${lead.stage}, ${lead.ageDays} days old, estimated ${lead.estValue} per month.`,
  }
}

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params
  const lead = leadById.get(id)
  if (!lead) notFound()

  // A won or lost lead is closed, so it can't be stale no matter how old it is.
  const isStale =
    lead.ageDays >= STALE_AFTER_DAYS && lead.stage !== 'won' && lead.stage !== 'lost'

  return (
    <LeadDetailView
      lead={lead}
      owner={getStaff(lead.ownerId)}
      planName={lead.interestedPlanId ? PLAN_NAMES[lead.interestedPlanId] : undefined}
      isStale={isStale}
    />
  )
}
