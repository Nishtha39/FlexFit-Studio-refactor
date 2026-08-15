import { Sidebar } from '@/components/v2/dashboard/sidebar'
import { Topbar } from '@/components/v2/dashboard/topbar'

/**
 * SANDBOX SHELL — do not copy into FlexFit-Studio-refactor.
 *
 * The repo already has `app/(app)/layout.tsx`, which wraps these routes in
 * AppProvider + StudioDataProvider + AppShell. This stand-in gives the new
 * detail routes the same rail-and-topbar framing here so they can be reviewed
 * in place. The `(app)` route group adds no URL segment, so the page files
 * inside it resolve to /schedule/[id], /leads/[id] and /equipment/[id] in both
 * codebases.
 */
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-64 shrink-0 bg-card lg:block">
        <div className="sticky top-0 flex h-svh flex-col">
          <Sidebar />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-5 lg:px-6">{children}</main>
      </div>
    </div>
  )
}
