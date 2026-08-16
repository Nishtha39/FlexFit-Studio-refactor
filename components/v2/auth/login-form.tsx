'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/v2/ui/button'
import { Checkbox } from '@/components/v2/ui/checkbox'
import { Input } from '@/components/v2/ui/input'
import { Label } from '@/components/v2/ui/label'
import { api } from '@/lib/api/client'
import { writeSession } from '@/lib/auth/session'

interface FieldErrors {
  email?: string
  password?: string
}

/**
 * Sign-in form.
 *
 * Client-side validation catches the empty and malformed cases so the round
 * trip is not spent on them; the server re-checks everything regardless, since
 * nothing arriving from a browser is trustworthy.
 *
 * Where it lands is the account's business, not this form's: the server returns
 * the role's landing screen, so an owner goes to /dashboard and a member to
 * /portal without this file knowing the mapping.
 */
export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function validate(): FieldErrors {
    const next: FieldErrors = {}
    if (!email.trim()) {
      next.email = 'Enter your work email.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = 'That email address looks incomplete.'
    }
    if (!password) {
      next.password = 'Enter your password.'
    }
    return next
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setPending(true)
    setFormError(null)
    try {
      const { token, user } = await api.auth.signIn.mutate({ email, password })
      writeSession({ token, user })
      router.push(user.landing)
    } catch (error) {
      // One message for a wrong password and an unknown address alike — the
      // server refuses to distinguish them, and echoing its wording keeps that
      // promise instead of quietly leaking which it was.
      setFormError(
        error instanceof Error
          ? error.message
          : 'Could not sign in. Please try again.',
      )
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {formError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      )}

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
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className="h-11 bg-card"
        />
        {errors.email && (
          <p id="email-error" role="alert" className="text-xs text-destructive">
            {errors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-sm">
            Password
          </Label>
          <Link
            href="/forgot-password"
            className="text-xs text-brand transition-colors hover:text-brand/80"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
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
      </div>

      <div className="flex items-center gap-2.5">
        <Checkbox id="remember" name="remember" defaultChecked />
        <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">
          Keep me signed in on this device
        </Label>
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-full bg-brand text-sm text-white hover:bg-brand/90"
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Signing in
          </>
        ) : (
          'Sign in'
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        New to FlexFit?{' '}
        <Link href="/signup" className="font-medium text-brand hover:text-brand/80">
          Create an account
        </Link>
      </p>
    </form>
  )
}
