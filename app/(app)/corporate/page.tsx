import type { Metadata } from 'next'
import { CorporateList } from '@/components/corporate/corporate-list'

export const metadata: Metadata = {
  title: 'Corporate — FlexFit Studio',
  description:
    'Corporate credit pools with utilization, weekly burn rate and an early warning before a pool empties.',
}

export default function CorporatePage() {
  return <CorporateList />
}
