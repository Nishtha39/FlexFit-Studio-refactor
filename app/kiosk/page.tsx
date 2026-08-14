import type { Metadata, Viewport } from 'next'
import { KioskScreen } from '@/components/kiosk/kiosk-screen'

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

export default function KioskPage() {
  return <KioskScreen />
}
