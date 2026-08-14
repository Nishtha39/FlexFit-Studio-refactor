import type { Metadata } from 'next'
import { MySchedule } from '@/components/trainers/my-schedule'

export const metadata: Metadata = {
  title: 'My schedule — FlexFit Studio',
  description: 'A trainer\u2019s own week: today\u2019s classes, rosters, and the assigned members worth a word.',
}

export default function MySchedulePage() {
  return <MySchedule />
}
