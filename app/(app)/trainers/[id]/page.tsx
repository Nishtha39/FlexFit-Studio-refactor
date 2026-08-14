import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTrainerLoad, trainerLoads } from '@/components/trainers/trainers-data'
import { TrainerDetail } from '@/components/trainers/trainer-detail'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * Driven off `trainerLoads` rather than the raw staff list so it matches exactly
 * what `getTrainerLoad` can resolve — that includes the departed trainer, whose
 * page the roster still links to.
 */
export function generateStaticParams() {
  return trainerLoads.map((l) => ({ id: l.trainer.id }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const load = getTrainerLoad(id)
  if (!load) return { title: 'Trainer not found — FlexFit Studio' }
  return {
    title: `${load.trainer.name} — FlexFit Studio`,
    description: `${load.classes.length} weekly classes, ${load.clients.length} assigned members.`,
  }
}

export default async function TrainerPage({ params }: PageProps) {
  const { id } = await params
  const load = getTrainerLoad(id)
  if (!load) notFound()

  return <TrainerDetail load={load} />
}
