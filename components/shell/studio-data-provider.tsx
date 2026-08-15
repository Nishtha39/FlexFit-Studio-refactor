'use client'

import * as React from 'react'
import { CloudOff, RefreshCw } from 'lucide-react'
import { StudioProvider, useStudio } from '@/lib/store/studio-store'
import { useApp } from '@/components/shell/role-context'
import { Button } from '@/components/ui/button'

/**
 * Mounts the live data store with the acting role attached, and shows the one
 * piece of UI the store needs: an honest banner when the API cannot be reached.
 *
 * The banner matters more than it looks. Without it, an unreachable API is
 * indistinguishable from a working one — the screens still render, because they
 * fall back to the seed the database was loaded from — and the only symptom
 * would be that saving quietly does nothing. That is precisely the failure this
 * whole change set exists to remove, so it gets said out loud.
 */
export function StudioDataProvider({ children }: { children: React.ReactNode }) {
  const { roleMeta } = useApp()
  return (
    <StudioProvider actor={roleMeta.id}>
      <OfflineBanner />
      {children}
    </StudioProvider>
  )
}

function OfflineBanner() {
  const { connection, refresh, error } = useStudio()
  const [retrying, setRetrying] = React.useState(false)

  if (connection !== 'offline') return null

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-warn-border bg-warn-soft px-4 py-2 text-micro text-warn"
    >
      <CloudOff aria-hidden className="size-3.5 shrink-0" />
      <span className="font-medium">Working from the built-in sample data — changes will not save.</span>
      <span className="text-warn/80">
        The API at <code className="font-mono">/api/trpc</code> did not respond
        {error ? ` (${error})` : ''}. Run <code className="font-mono">pnpm preview</code> to serve it locally.
      </span>
      <Button
        variant="ghost"
        size="xs"
        className="ml-auto"
        disabled={retrying}
        onClick={async () => {
          setRetrying(true)
          await refresh()
          setRetrying(false)
        }}
      >
        <RefreshCw className={retrying ? 'size-3.5 animate-spin' : 'size-3.5'} />
        Retry
      </Button>
    </div>
  )
}
