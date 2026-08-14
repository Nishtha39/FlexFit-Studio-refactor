import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { companies, getCompany } from '@/lib/data/companies'
import { PoolDetail } from '@/components/corporate/pool-detail'

interface PageProps {
  params: Promise<{ id: string }>
}

/** Seeded pools — every one is prerendered. See members/[id] for the rationale. */
export function generateStaticParams() {
  return companies.map((c) => ({ id: c.id }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const company = getCompany(id)
  if (!company) return { title: 'Pool not found — FlexFit Studio' }
  return {
    title: `${company.name} — FlexFit Studio`,
    description: `${company.creditsUsed} of ${company.poolCredits} credits used at ${company.burnRatePerWeek}/week.`,
  }
}

export default async function PoolPage({ params }: PageProps) {
  const { id } = await params
  const company = getCompany(id)
  if (!company) notFound()

  return <PoolDetail company={company} />
}
