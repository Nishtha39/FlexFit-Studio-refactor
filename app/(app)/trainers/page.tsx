import type { Metadata } from 'next'
import { TrainerRoster } from '@/components/trainers/trainer-roster'

export const metadata: Metadata = {
  title: 'Trainers — FlexFit Studio',
  description:
    'Trainer roster with class load, seat fill rate and the retention of the members assigned to each trainer.',
}

export default function TrainersPage() {
  return <TrainerRoster />
}
