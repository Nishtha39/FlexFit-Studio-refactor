'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import { Button } from '@/components/v2/ui/button'
import { Input } from '@/components/v2/ui/input'
import { Label } from '@/components/v2/ui/label'

/**
 * Request a password reset link.
 *
 * The success state deliberately does NOT confirm whether the address exists —
 * that would let anyone enumerate staff accounts. Swap the placeholder await
 * for the `auth.requestPasswordReset` mutation and keep the same copy.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim()) {
      setError('Enter your work email.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('That email address looks incomplete.')
      return
    }

    setError(undefined)
    setPending(true)
    await new Promise((resolve) => setTimeout(resolve, 600))
    setPending(false)
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <div
          role="status"
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5"
        >
          <MailCheck className="size-5 text-brand" aria-hidden="true" />
          <p className="text-sm font-medium">Check your inbox</p>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            If an account exists for{' '}
            <span className="font-medium text-foreground">{email}</span>, a reset
            link is on its way. It expires in 30 minutes.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => setSent(false)}
          className="h-11 w-full rounded-full border-border bg-card text-sm hover:bg-secondary"
        >
          Use a different email
        </Button>

        <Link
          href="/login"
          className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-sm">
          Work email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@yourgym.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'email-error' : undefined}
          className="h-11 bg-card"
        />
        {error && (
          <p id="email-error" role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-full bg-brand text-sm text-white hover:bg-brand/90"
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Sending link
          </>
        ) : (
          'Send reset link'
        )}
      </Button>

      <Link
        href="/login"
        className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to sign in
      </Link>
    </form>
  )
}
