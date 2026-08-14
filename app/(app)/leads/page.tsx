import type { Metadata } from 'next'
import { LeadsBoard } from '@/components/leads/leads-board'

export const metadata: Metadata = {
  title: 'Leads — FlexFit Studio',
  description:
    'Lead pipeline by stage with per-stage SLAs, aging chips, pipeline value and conversion rate.',
}

export default function LeadsPage() {
  return <LeadsBoard />
}
