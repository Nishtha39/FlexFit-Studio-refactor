import Link from 'next/link'
import { cn } from '@/lib/v2/utils'

interface LogoProps {
  href?: string
  className?: string
  /** Hide the wordmark and render the badge alone. */
  markOnly?: boolean
}

/**
 * The FlexFit badge and wordmark.
 *
 * Shared by the landing nav, the auth panels and the dashboard sidebar so the
 * mark is defined in exactly one place.
 */
export function Logo({ href = '/', className, markOnly = false }: LogoProps) {
  return (
    <Link
      href={href}
      className={cn('inline-flex items-center gap-2.5', className)}
      aria-label="FlexFit Studio home"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-ink">
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          aria-hidden="true"
        >
          {/* Abstract dumbbell: two plates joined by a bar. */}
          <rect x="2" y="8.5" width="3.5" height="7" rx="1.5" fill="#c9f17e" />
          <rect x="18.5" y="8.5" width="3.5" height="7" rx="1.5" fill="#5880da" />
          <rect x="6" y="10.75" width="12" height="2.5" rx="1.25" fill="#ffffff" />
        </svg>
      </span>
      {!markOnly && (
        <span className="font-display text-[17px] font-semibold tracking-[-0.02em] text-foreground">
          FlexFit
        </span>
      )}
    </Link>
  )
}
