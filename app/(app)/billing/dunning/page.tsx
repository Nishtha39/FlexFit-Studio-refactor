import type { Metadata } from 'next'
import { DunningQueue } from '@/components/billing/dunning-queue'

export const metadata: Metadata = {
  title: 'Dunning — FlexFit Studio',
  description:
    'The failed-payment recovery ladder: which rung each invoice is on, what happens next, and what it is worth to recover.',
}

export default function DunningPage() {
  return <DunningQueue />
}
