import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { classes, getClass } from '@/lib/v2/data/classes'
import { getMember } from '@/lib/v2/data/members'
import { getStaff } from '@/lib/v2/data/staff'
import { WEEKDAYS } from '@/lib/v2/format'
import { ClassDetailView } from '@/components/v2/schedule/class-detail-view'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * The class week is seeded and fully known at build time, so every session is
 * prerendered — required by `output: 'export'`.
 */
export function generateStaticParams() {
  return classes.map((c) => ({ id: c.id }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const gymClass = getClass(id)
  if (!gymClass) return { title: 'Class not found — FlexFit Studio' }
  return {
    title: `${gymClass.name} — FlexFit Studio`,
    description: `${WEEKDAYS[gymClass.dayOfWeek]} ${gymClass.startTime} · ${gymClass.roster.length}/${gymClass.capacity} booked · ${gymClass.waitlist.length} on the waitlist.`,
  }
}

export default async function ClassDetailPage({ params }: PageProps) {
  const { id } = await params
  const gymClass = getClass(id)
  if (!gymClass) notFound()

  // Ids are resolved here so the view stays presentational. Unknown ids are
  // dropped rather than rendered blank — a roster entry for a deleted member is
  // a data problem, not something to show as an empty row.
  const resolve = (ids: string[]) =>
    ids.flatMap((memberId) => {
      const m = getMember(memberId)
      return m ? [{ id: m.id, name: m.name, initials: m.initials, status: m.status }] : []
    })

  return (
    <ClassDetailView
      gymClass={gymClass}
      trainer={getStaff(gymClass.trainerId)}
      roster={resolve(gymClass.roster)}
      waitlist={resolve(gymClass.waitlist)}
    />
  )
}
