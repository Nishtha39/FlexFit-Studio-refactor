import { Features } from '@/components/v2/landing/features'
import { Hero } from '@/components/v2/landing/hero'
import { Pricing } from '@/components/v2/landing/pricing'
import { Results } from '@/components/v2/landing/results'
import { SiteFooter } from '@/components/v2/landing/site-footer'
import { SiteHeader } from '@/components/v2/landing/site-header'
import { Workflow } from '@/components/v2/landing/workflow'
import { V2Shell } from '@/components/v2/v2-shell'

/**
 * Marketing home page.
 *
 * The root used to redirect straight to /dashboard, on the reasoning that the
 * owner is the default role and the product had no public face. It has one now,
 * so the root serves it and staff go to /dashboard directly — the redirect
 * carried no content of its own, so nothing was lost in the swap.
 *
 * Sections are composed top-to-bottom in narrative order: hook, journey,
 * capabilities, proof, price, close.
 */
export default function RootPage() {
  return (
    <V2Shell>
      <SiteHeader />
      <main>
        <Hero />
        <Workflow />
        <Features />
        <Results />
        <Pricing />
      </main>
      <SiteFooter />
    </V2Shell>
  )
}
