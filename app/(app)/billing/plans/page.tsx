import type { Metadata } from 'next'
import { PlanBuilder } from '@/components/billing/plan-builder'

export const metadata: Metadata = {
  title: 'Plans — FlexFit Studio',
  description:
    'Build and price membership plans with the live revenue and allowance impact on current holders.',
}

export default function PlansPage() {
  return <PlanBuilder />
}
