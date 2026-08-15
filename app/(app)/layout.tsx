import type React from 'react'
import { AppProvider } from '@/components/shell/role-context'
import { AppShell } from '@/components/shell/app-shell'
import { CommandPalette } from '@/components/command/command-palette'
import { StudioDataProvider } from '@/components/shell/studio-data-provider'

/**
 * Every in-product screen renders inside the shell. The kiosk (Batch 4) lives
 * outside this route group precisely so it can break the shell.
 *
 * Merge wiring (Batch 9): the ⌘K palette mounts here, inside AppProvider, so it
 * can read `commandOpen` from the shell context the top bar already toggles.
 *
 * `StudioDataProvider` sits inside AppProvider because it tags every write with
 * the acting role for the audit trail, and it wraps AppShell so that any screen
 * — and the connection banner in the top bar — can read the live dataset.
 */
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <StudioDataProvider>
        <AppShell>{children}</AppShell>
        <CommandPalette />
      </StudioDataProvider>
    </AppProvider>
  )
}
