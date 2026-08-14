import type { Metadata } from 'next'
import { RetentionDashboard } from '@/components/retention/retention-dashboard'

export const metadata: Metadata = {
  title: 'Retention — FlexFit Studio',
  description:
    'Churn-risk distribution, weekly risk movement, the intervention queue ranked by risk and value, and a 60-day effectiveness report.',
}

export default function RetentionPage() {
  return <RetentionDashboard />
}
