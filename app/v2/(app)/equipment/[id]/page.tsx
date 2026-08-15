import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  EQUIPMENT_CATEGORY_LABELS,
  bookValue,
  equipment,
  equipmentFaults,
  equipmentServices,
  getEquipment,
  nextServiceDate,
} from '@/lib/v2/data/equipment'
import { NOW } from '@/lib/v2/format'
import { EquipmentDetailView } from '@/components/v2/equipment/equipment-detail-view'

interface PageProps {
  params: Promise<{ id: string }>
}

export function generateStaticParams() {
  return equipment.map((e) => ({ id: e.id }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const asset = getEquipment(id)
  if (!asset) return { title: 'Equipment not found — FlexFit Studio' }
  return {
    title: `${asset.name} — FlexFit Studio`,
    description: `${asset.make} ${asset.model} (${asset.assetTag}) in ${asset.zone}, currently ${asset.status}.`,
  }
}

export default async function EquipmentDetailPage({ params }: PageProps) {
  const { id } = await params
  const asset = getEquipment(id)
  if (!asset) notFound()

  // Newest first: the most recent fault is what someone opening this page cares
  // about, and the same ordering makes the open ones surface at the top.
  const faults = equipmentFaults
    .filter((f) => f.equipmentId === asset.id)
    .sort((a, b) => b.reportedDate.localeCompare(a.reportedDate))

  const services = equipmentServices
    .filter((s) => s.equipmentId === asset.id)
    .sort((a, b) => b.date.localeCompare(a.date))

  const nextService = nextServiceDate(asset)
  const daysUntilService = nextService
    ? Math.round((new Date(nextService).getTime() - NOW.getTime()) / 86_400_000)
    : null

  return (
    <EquipmentDetailView
      asset={asset}
      categoryLabel={EQUIPMENT_CATEGORY_LABELS[asset.category]}
      faults={faults}
      services={services}
      bookValueAmount={bookValue(asset)}
      nextService={nextService}
      daysUntilService={daysUntilService}
    />
  )
}
