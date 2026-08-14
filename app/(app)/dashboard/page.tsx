import type { Metadata } from 'next'
import { DashboardView } from '@/components/dashboard/dashboard-view'

export const metadata: Metadata = {
  title: 'Dashboard — FlexFit Studio',
  description:
    'Ranked operational queue, recurring revenue, attendance density and cohort retention across all FlexFit locations.',
}

export default function DashboardPage() {
  return <DashboardView />
}
