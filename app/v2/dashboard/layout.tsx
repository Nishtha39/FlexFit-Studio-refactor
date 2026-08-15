import type { Metadata } from 'next'
import { Sidebar } from '@/components/v2/dashboard/sidebar'
import { Topbar } from '@/components/v2/dashboard/topbar'

export const metadata: Metadata = {
  // Bare, not "Dashboard · FlexFit Studio": app/v2/layout.tsx supplies the
  // "%s · FlexFit Studio" template, and spelling the suffix out here too
  // rendered the tab as "Dashboard · FlexFit Studio · FlexFit Studio".
  title: 'Dashboard',
  description:
    'Track members, check-ins, classes and revenue across your gym from one place.',
}

/**
 * Shell shared by every dashboard route: a fixed rail on desktop with a
 * scrolling content column beside it.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh">
      {/* The rail itself carries the card background and stretches to the full
          page height, while the inner panel sticks to the viewport. Putting
          h-svh on the outer element instead would leave a gap once the content
          column scrolls past one screen. */}
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
