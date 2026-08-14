import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

/**
 * 404. A back-office 404 is almost always a stale link or a deleted record, so
 * it says that plainly and offers the two places staff actually want.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-md border border-border bg-card p-6">
        <span className="flex size-8 items-center justify-center rounded-sm border border-border bg-muted">
          <FileQuestion className="size-4 text-muted-foreground" />
        </span>
        <p className="mt-3 text-micro font-medium tracking-wide text-muted-foreground uppercase">404</p>
        <h1 className="mt-1 text-lg font-semibold text-foreground">This page doesn&apos;t exist</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          The link may be stale, or the record it pointed at was cancelled or merged. Nothing has been
          deleted by opening this page.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          >
            Go to dashboard
          </Link>
          <Link
            href="/members"
            className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-sm text-secondary-foreground transition-colors hover:border-border-strong hover:bg-muted"
          >
            Search members
          </Link>
        </div>
      </div>
    </div>
  )
}
