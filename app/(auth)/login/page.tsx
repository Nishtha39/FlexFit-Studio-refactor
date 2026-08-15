import type { Metadata } from 'next'
import { AuthShell } from '@/components/v2/auth/auth-shell'
import { LoginForm } from '@/components/v2/auth/login-form'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your FlexFit Studio workspace.',
}

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where your team left off."
      aside={{
        quote:
          'We replaced three tools and a shared spreadsheet. The lifecycle board alone gave my desk team back an afternoon every week.',
        attribution: 'Priya Nair — Head Coach, Ironworks Collective',
      }}
      image={{
        src: '/images/gym-rack.jpg',
        alt: 'A weightlifter pressing a barbell overhead inside a training rack',
      }}
    >
      <LoginForm />
    </AuthShell>
  )
}
