import type { Metadata } from 'next'
import { AuthShell } from '@/components/v2/auth/auth-shell'
import { ForgotPasswordForm } from '@/components/v2/auth/forgot-password-form'

export const metadata: Metadata = {
  title: 'Reset your password | FlexFit Studio',
  description:
    'Request a secure link to reset the password on your FlexFit Studio staff account.',
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email you use to sign in and we'll send a secure link to set a new password."
      aside={{
        quote:
          'Front desk staff rotate constantly. Getting someone back into their account takes seconds, not a support ticket.',
        attribution: 'Devan Rao — Studio Manager, Eastside Strength',
      }}
      image={{
        src: '/images/gym-floor.jpg',
        alt: 'A wide view of a training floor with racks and free weights',
      }}
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
