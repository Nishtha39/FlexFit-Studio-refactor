'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Check, Eye, EyeOff, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/v2/ui/button'
import { Input } from '@/components/v2/ui/input'
import { Label } from '@/components/v2/ui/label'
import { cn } from '@/lib/v2/utils'

interface FieldErrors {
  password?: string
  confirm?: string
}

const RULES = [
  { label: 'At least 10 characters', test: (v: string) => v.length >= 10 },
  { label: 'One number', test: (v: string) => /\d/.test(v) },
  { label: 'One letter', test: (v: string) => /[a-zA-Z]/.test(v) },
] as const

/**
 * Set a new password from an emailed reset link.
 *
 * The `token` query param is what the real `auth.resetPassword` mutation will
 * need; it is read here so a link arriving without one fails closed instead of
 * showing a form that could never succeed.
 */
export function ResetPasswordForm() {
  const router = useRouter()
  const token = useSearchParams().get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const next: FieldErrors = {}
    if (!password) {
      next.password = 'Choose a new password.'
    } else if (RULES.some((rule) => !rule.test(password))) {
      next.password = 'Your password does not meet the requirements below.'
    }
    if (!confirm) {
      next.confirm = 'Re-enter your new password.'
    } else if (confirm !== password) {
      next.confirm = 'Both passwords must match.'
    }

    setErrors(next)
    if (Object.keys(next).length > 0) return

    setPending(true)
    await new Promise((resolve) => setTimeout(resolve, 600))
    setPending(false)
    setDone(true)
  }

  // A link with no token can never be completed, so say so rather than
  // collecting a password the mutation would reject.
  if (!token) {
    return (
      <div className="flex flex-col gap-5">
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5"
        >
          <TriangleAlert className="size-5 text-destructive" aria-hidden="true" />
          <p className="text-sm font-medium">This link is not valid</p>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            Reset links expire after 30 minutes and can only be used once.
            Request a fresh one to continue.
          </p>
        </div>

        <Link
          href="/forgot-password"
          className="flex h-11 w-full items-center justify-center rounded-full bg-brand text-sm text-white transition-colors hover:bg-brand/90"
        >
          Request a new link
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex flex-col gap-5">
        <div
          role="status"
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5"
        >
          <ShieldCheck className="size-5 text-brand" aria-hidden="true" />
          <p className="text-sm font-medium">Password updated</p>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            Every other session has been signed out. Use your new password to
            sign back in.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => router.push('/login')}
          className="h-11 w-full rounded-full bg-brand text-sm text-white hover:bg-brand/90"
        >
          Continue to sign in
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password" className="text-sm">
          New password
        </Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={cn(
              'password-rules',
              errors.password && 'password-error',
            )}
            className="h-11 bg-card pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" role="alert" className="text-xs text-destructive">
            {errors.password}
          </p>
        )}

        <ul id="password-rules" className="mt-1 flex flex-col gap-1.5">
          {RULES.map((rule) => {
            const met = rule.test(password)
            return (
              <li
                key={rule.label}
                className={cn(
                  'flex items-center gap-2 text-xs transition-colors',
                  met ? 'text-brand' : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-full border',
                    met ? 'border-brand bg-brand/15' : 'border-border',
                  )}
                  aria-hidden="true"
                >
                  {met && <Check className="size-2.5" />}
                </span>
                {rule.label}
                <span className="sr-only">{met ? ' — met' : ' — not met'}</span>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm" className="text-sm">
          Confirm new password
        </Label>
        <Input
          id="confirm"
          name="confirm"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="••••••••••"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          aria-invalid={Boolean(errors.confirm)}
          aria-describedby={errors.confirm ? 'confirm-error' : undefined}
          className="h-11 bg-card"
        />
        {errors.confirm && (
          <p id="confirm-error" role="alert" className="text-xs text-destructive">
            {errors.confirm}
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
            Updating password
          </>
        ) : (
          'Update password'
        )}
      </Button>
    </form>
  )
}
