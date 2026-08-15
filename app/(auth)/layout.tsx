import type { Metadata } from 'next'

import { V2Shell } from '@/components/v2/v2-shell'

export const metadata: Metadata = {
  title: {
    default: 'FlexFit Studio — Gym management, quietly handled',
    template: '%s · FlexFit Studio',
  },
  description:
    'Memberships, class schedules, check-ins and billing in one calm workspace for gym teams.',
}

/**
 * The four auth screens: /login, /signup, /forgot-password, /reset-password.
 *
 * They sit at the top level rather than under /v2 because the marketing page
 * they belong to is served at the site root, and its buttons link to /login and
 * /signup. While these lived under /v2 those links 404'd — every primary call
 * to action on the public front page was dead.
 *
 * A route group `(auth)` adds no URL segment, so it exists purely to hang this
 * layout on: the screens need V2Shell for the palette and the fonts, exactly
 * as they did under app/v2/layout.tsx.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <V2Shell>{children}</V2Shell>
}
