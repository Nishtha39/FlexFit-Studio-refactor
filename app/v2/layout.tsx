import type { Metadata } from 'next'

import { V2Shell } from '@/components/v2/v2-shell'

export const metadata: Metadata = {
  title: {
    default: 'FlexFit Studio — Gym management, quietly handled',
    template: '%s · FlexFit Studio',
  },
  description:
    'Memberships, class schedules, check-ins and billing in one calm workspace for gym teams.',
}

/**
 * Everything under /v2 is the merged-in design: the marketing page, the four
 * auth screens, its own dashboard and the equipment/lead/class detail views.
 * It runs alongside the original back office rather than replacing it, so both
 * remain reachable.
 */
export default function V2Layout({ children }: { children: React.ReactNode }) {
  return <V2Shell>{children}</V2Shell>
}
