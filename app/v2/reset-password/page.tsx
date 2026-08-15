import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AuthShell } from '@/components/v2/auth/auth-shell'
import { ResetPasswordForm } from '@/components/v2/auth/reset-password-form'

export const metadata: Metadata = {
  title: 'Set a new password | FlexFit Studio',
  description:
    'Choose a new password for your FlexFit Studio staff account.',
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose something you have not used before. Saving it signs out every other device."
      aside={{
        quote:
          'We audit who can reach member records every quarter. Password hygiene is the part we cannot outsource.',
        attribution: 'Simran Kaur — Compliance, Northgate Athletic',
      }}
      image={{
        src: '/images/gym-warehouse.jpg',
        alt: 'A warehouse-style gym interior with turf lanes and racked plates',
      }}
    >
      {/* The form reads `token` from the query string, so it needs a Suspense
          boundary to stay compatible with static prerendering. */}
      <Suspense fallback={<div className="h-64" aria-busy="true" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  )
}
