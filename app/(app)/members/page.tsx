import { Suspense } from 'react'
import type { Metadata } from 'next'
import { TableSkeleton } from '@/components/ui/empty-state'
import { MembersDirectory } from '@/components/members/members-directory'

export const metadata: Metadata = {
  title: 'Members — FlexFit Studio',
  description: 'Search, filter and act on the full member directory across all locations.',
}

export default function MembersPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={14} cols={7} />}>
      <MembersDirectory />
    </Suspense>
  )
}
