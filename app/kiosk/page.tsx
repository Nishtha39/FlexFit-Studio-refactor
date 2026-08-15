import type { Metadata, Viewport } from 'next'
import { KioskScreen } from '@/components/kiosk/kiosk-screen'
import { StudioProvider } from '@/lib/store/studio-store'

/**
 * The kiosk lives OUTSIDE the (app) route group, so it inherits no sidebar,
 * no top bar and no role switcher — it breaks the shell by construction
 * rather than by hiding chrome with CSS.
 */
export const metadata: Metadata = {
  title: 'Check-in — FlexFit Studio',
  description: 'Self-service member check-in kiosk.',
  robots: { index: false, follow: false },
}

/** Pinch-zoom off and no scaling: this is a fixed wall-mounted display. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ffffff',
}

/**
 * The kiosk gets the data store even though it has no shell: a check-in taken
 * here is a real visit and has to reach the database, or the member's history,
 * their remaining credits and the attendance heatmap all disagree with the door.
 *
 * `actor` is fixed rather than read from the role switcher — there is no role
 * switcher out here, and the honest answer for an unattended wall display is
 * that the kiosk did it.
 */
export default function KioskPage() {
  return (
    <StudioProvider actor="kiosk">
      <KioskScreen />
    </StudioProvider>
  )
}
