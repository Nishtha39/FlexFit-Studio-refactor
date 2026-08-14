import type { Metadata } from 'next'
import { NotificationCenter } from '@/components/notifications/notification-center'

export const metadata: Metadata = {
  title: 'Notifications — FlexFit Studio',
  description:
    'Event feed for payments, retention, classes and corporate pools, plus the broadcast composer.',
}

export default function NotificationsPage() {
  return <NotificationCenter />
}
