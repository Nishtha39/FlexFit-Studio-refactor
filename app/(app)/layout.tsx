import type React from 'react'
import { AppProvider } from '@/components/shell/role-context'
import { AppShell } from '@/components/shell/app-shell'
import { CommandPalette } from '@/components/command/command-palette'

/**
 * Every in-product screen renders inside the shell. The kiosk (Batch 4) lives
 * outside this route group precisely so it can break the shell.
 *
 * Merge wiring (Batch 9): the ⌘K palette mounts here, inside AppProvider, so it
 * can read `commandOpen` from the shell context the top bar already toggles.
 */
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AppShell>{children}</AppShell>
      <CommandPalette />
    </AppProvider>
  )
}
