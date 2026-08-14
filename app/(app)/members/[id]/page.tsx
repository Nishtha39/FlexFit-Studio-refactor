import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getMember, members } from '@/lib/data/members'
import { getPlan } from '@/lib/data/plans'
import { MemberProfile } from '@/components/members/profile/member-profile'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * The member set is seeded and fully known at build time, so every profile is
 * prerendered. This is what lets the app ship as static files instead of
 * rendering per request — see next.config.mjs `output: 'export'`.
 */
export function generateStaticParams() {
  return members.map((m) => ({ id: m.id }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const member = getMember(id)
  if (!member) return { title: 'Member not found — FlexFit Studio' }
  const plan = getPlan(member.planId)
  return {
    title: `${member.name} — FlexFit Studio`,
    description: `${plan?.name ?? 'Membership'} · risk ${member.risk.score} · ${member.metrics.visitsLast30} visits in the last 30 days.`,
  }
}

export default async function MemberProfilePage({ params }: PageProps) {
  const { id } = await params
  const member = getMember(id)
  if (!member) notFound()

  return <MemberProfile member={member} />
}
