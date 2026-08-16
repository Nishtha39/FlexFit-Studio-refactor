'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/v2/ui/button'
import { Checkbox } from '@/components/v2/ui/checkbox'
import { Input } from '@/components/v2/ui/input'
import { Label } from '@/components/v2/ui/label'
import { api } from '@/lib/api/client'
import { writeSession } from '@/lib/auth/session'
import { cn } from '@/lib/v2/utils'

interface FieldErrors {
  name?: string
  gym?: string
  email?: string
  password?: string
  terms?: string
}

/** Coarse password strength, used only to give the user feedback as they type. */
function scorePassword(value: string): { score: number; label: string } {
  let score = 0
  if (value.length >= 8) score += 1
  if (value.length >= 12) score += 1
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1
  if (/\d/.test(value) || /[^A-Za-z0-9]/.test(value)) score += 1

  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']
  return { score, label: labels[score] }
}

/**
 * The four roles an account can hold, in the order they are offered.
 *
 * Member first because it is much the commonest signup, and because the two
 * fields above the picker ask about a gym — which reads oddly to someone
 * joining one rather than running one, so the form hides them for that choice.
 */
const ROLE_CHOICES = [
  { id: 'member', label: 'Member', hint: 'Book classes and manage my membership' },
  { id: 'trainer', label: 'Trainer', hint: 'See my schedule and my clients' },
  { id: 'front_desk', label: 'Front desk', hint: 'Check members in and take payments' },
  { id: 'owner', label: 'Owner', hint: 'Full access to every screen and report' },
] as const

type RoleChoice = (typeof ROLE_CHOICES)[number]['id']

/**
 * Account creation form.
 *
 * Validates here for fast feedback and again on the server, which is the copy
 * that counts. Where the new account lands is decided by its role, and the
 * server returns that destination rather than this form deciding it.
 */
export function SignupForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [gym, setGym] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<RoleChoice>('member')
  const [accepted, setAccepted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  /** Only staff belong to a gym; a member joins one. */
  const isStaff = role !== 'member'

  const strength = useMemo(() => scorePassword(password), [password])

  function validate(): FieldErrors {
    const next: FieldErrors = {}
    if (!name.trim()) next.name = 'Enter your full name.'
    if (isStaff && !gym.trim()) next.gym = 'Enter your gym or studio name.'
    if (!email.trim()) {
      next.email = 'Enter your work email.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = 'That email address looks incomplete.'
    }
    // Twelve, matching the server. Eight would pass here and then be rejected
    // there, which reads as the form being broken.
    if (password.length < 12) {
      next.password = 'Use at least 12 characters — length matters more than symbols.'
    }
    if (!accepted) {
      next.terms = 'Please accept the terms to continue.'
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
      const { token, user } = await api.auth.signUp.mutate({
        name,
        email,
        password,
        role,
        gym: isStaff ? gym : undefined,
      })
      writeSession({ token, user })
      router.push(user.landing)
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Could not create the account.',
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

      {/* Radios rather than a dropdown: four options, and the hint under each
          is the part that actually tells someone which they are. */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-foreground">
          I&apos;m signing up as
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLE_CHOICES.map((choice) => (
            <label
              key={choice.id}
              className={cn(
                'flex cursor-pointer flex-col gap-0.5 rounded-xl border px-3.5 py-3 transition-colors',
                role === choice.id
                  ? 'border-brand bg-brand-soft'
                  : 'border-border bg-card hover:border-border-strong',
              )}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="role"
                  value={choice.id}
                  checked={role === choice.id}
                  onChange={() => setRole(choice.id)}
                  className="size-4 accent-brand"
                />
                <span className="text-sm font-medium text-foreground">{choice.label}</span>
              </span>
              <span className="pl-6 text-xs text-muted-foreground">{choice.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name" className="text-sm">
            Full name
          </Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            placeholder="Priya Nair"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'name-error' : undefined}
            className="h-11 bg-card"
          />
          {errors.name && (
            <p id="name-error" role="alert" className="text-xs text-destructive">
              {errors.name}
            </p>
          )}
        </div>

        {/* Staff only. A member joining a gym has no organisation to name, and
            asking anyway makes the form look like it was built for someone
            else. Hidden rather than disabled — a greyed-out box still reads as
            something you failed to fill in. */}
        <div className={cn('flex flex-col gap-2', !isStaff && 'hidden')}>
          <Label htmlFor="gym" className="text-sm">
            Gym name
          </Label>
          <Input
            id="gym"
            name="gym"
            autoComplete="organization"
            placeholder="Ironworks Collective"
            value={gym}
            onChange={(event) => setGym(event.target.value)}
            aria-invalid={Boolean(errors.gym)}
            aria-describedby={errors.gym ? 'gym-error' : undefined}
            className="h-11 bg-card"
          />
          {errors.gym && (
            <p id="gym-error" role="alert" className="text-xs text-destructive">
              {errors.gym}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="signup-email" className="text-sm">
          Work email
        </Label>
        <Input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@yourgym.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'signup-email-error' : undefined}
          className="h-11 bg-card"
        />
        {errors.email && (
          <p id="signup-email-error" role="alert" className="text-xs text-destructive">
            {errors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="signup-password" className="text-sm">
          Password
        </Label>
        <div className="relative">
          <Input
            id="signup-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby="password-strength"
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

        <div className="flex items-center gap-2.5" id="password-strength">
          <div className="flex flex-1 gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  index < strength.score ? 'bg-brand' : 'bg-secondary',
                )}
              />
            ))}
          </div>
          <span className="w-16 text-right text-xs text-muted-foreground">
            {password ? strength.label : ''}
          </span>
        </div>

        {errors.password && (
          <p role="alert" className="text-xs text-destructive">
            {errors.password}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2.5">
          <Checkbox
            id="terms"
            name="terms"
            checked={accepted}
            onCheckedChange={(checked) => setAccepted(checked === true)}
            aria-describedby={errors.terms ? 'terms-error' : undefined}
            className="mt-0.5"
          />
          <Label
            htmlFor="terms"
            className="text-sm leading-relaxed font-normal text-muted-foreground"
          >
            I agree to the{' '}
            <Link href="#" className="text-brand hover:text-brand/80">
              terms of service
            </Link>{' '}
            and{' '}
            <Link href="#" className="text-brand hover:text-brand/80">
              privacy policy
            </Link>
            .
          </Label>
        </div>
        {errors.terms && (
          <p id="terms-error" role="alert" className="text-xs text-destructive">
            {errors.terms}
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
            Creating account
          </>
        ) : (
          'Create account'
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand hover:text-brand/80">
          Sign in
        </Link>
      </p>
    </form>
  )
}
