import type { Metadata } from 'next'
import { PortalHome } from '@/components/portal/portal-home'

export const metadata: Metadata = {
  title: 'My bookings — FlexFit Studio',
  description: 'Member portal: membership credits, booked classes, self-serve booking and recent charges.',
}

export default function PortalPage() {
  return <PortalHome />
}
