import type { Metadata } from 'next'
import { ReportsLibrary } from '@/components/reports/reports-library'

export const metadata: Metadata = {
  title: 'Reports — FlexFit Studio',
  description:
    'Twelve operating reports across revenue, members, operations and sales — each computed live from the current dataset.',
}

export default function ReportsPage() {
  return <ReportsLibrary />
}
