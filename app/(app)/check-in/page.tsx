import { Suspense } from 'react'
import type { Metadata } from 'next'
import { TableSkeleton } from '@/components/ui/empty-state'
import { CheckinConsole } from '@/components/checkin/checkin-console'

export const metadata: Metadata = {
  title: 'Check-in — FlexFit Studio',
  description:
    'Front-desk check-in console: live arrival feed, member lookup with entitlement checks, and today’s class rosters.',
}

export default function CheckInPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={10} cols={5} />}>
      <CheckinConsole />
    </Suspense>
  )
}
