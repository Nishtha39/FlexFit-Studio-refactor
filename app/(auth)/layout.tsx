import type { Metadata } from 'next'

import { V2Shell } from '@/components/v2/v2-shell'

export const metadata: Metadata = {
  // Pages here set a bare title ("Sign in") and inherit the suffix from this
  // template, so the four tabs read consistently.
  title: { default: 'FlexFit Studio', template: '%s · FlexFit Studio' },
}

/**
 * Route group for the sign-in screens.
 *
 * They sit at /login, /signup, /forgot-password and /reset-password rather than
 * under /v2, because that is where every link that reaches them points: the
 * marketing header and hero, the pricing call to action, and the forms' own
 * cross-links. Namespacing them under /v2 during the merge left all of those
 * pointing at pages that did not exist.
 *
 * The group's parentheses keep it out of the URL, and exist only to hang this
 * layout — the screens need the v2 palette that /v2 gets from its own layout.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <V2Shell>{children}</V2Shell>
}
