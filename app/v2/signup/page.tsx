import type { Metadata } from 'next'
import { AuthShell } from '@/components/v2/auth/auth-shell'
import { SignupForm } from '@/components/v2/auth/signup-form'

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Start a free 14-day trial of FlexFit Studio.',
}

export default function SignupPage() {
  return (
    <AuthShell
      title="Start your free trial"
      subtitle="Fourteen days of everything, no card required."
      aside={{
        quote:
          'The check-in grid changed how we roster. We could finally see the 6pm crush for what it was and staff around it.',
        attribution: 'Marcus Hale — Operations, Northgate Athletic',
      }}
      image={{
        src: '/images/gym-ropes.jpg',
        alt: 'An athlete training with battle ropes on a covered rooftop',
      }}
    >
      <SignupForm />
    </AuthShell>
  )
}
