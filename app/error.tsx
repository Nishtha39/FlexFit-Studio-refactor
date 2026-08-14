'use client'

import * as React from 'react'
import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'

/**
 * Error boundary. Staff need two things from a crash: confirmation that nothing
 * they typed was charged or saved, and one button that retries.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-md border border-danger-border bg-card p-6">
        <span className="flex size-8 items-center justify-center rounded-sm border border-danger-border bg-danger-soft">
          <TriangleAlert className="size-4 text-danger" />
        </span>
        <h1 className="mt-3 text-lg font-semibold text-foreground">This screen failed to load</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Nothing was saved and no payment was taken. Retrying is safe. If it keeps failing, note the
          reference below when you report it.
        </p>
        {error.digest ? (
          <p className="mt-3 rounded-sm border border-border bg-muted px-2 py-1 font-mono text-micro text-muted-foreground">
            {error.digest}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-sm text-secondary-foreground transition-colors hover:border-border-strong hover:bg-muted"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
