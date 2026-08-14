import type { Metadata } from 'next'
import { SettingsView } from '@/components/settings/settings-view'

export const metadata: Metadata = {
  title: 'Settings — FlexFit Studio',
  description:
    'Studio details, booking and cancellation policy, the dunning ladder, role access and alert cadence.',
}

export default function SettingsPage() {
  return <SettingsView />
}
