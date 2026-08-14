import type { Metadata } from 'next'
import { ScheduleScreen } from '@/components/schedule/schedule-view'

export const metadata: Metadata = {
  title: 'Schedule — FlexFit Studio',
  description:
    'Weekly timetable with capacity pressure, live rosters and waitlist order, drag-to-reschedule with recurrence scope, and the booking, cancellation and reschedule dialog family.',
}

export default function SchedulePage() {
  return <ScheduleScreen />
}
