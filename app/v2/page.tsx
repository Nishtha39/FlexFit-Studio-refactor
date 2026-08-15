import { Features } from '@/components/v2/landing/features'
import { Hero } from '@/components/v2/landing/hero'
import { Pricing } from '@/components/v2/landing/pricing'
import { Results } from '@/components/v2/landing/results'
import { SiteFooter } from '@/components/v2/landing/site-footer'
import { SiteHeader } from '@/components/v2/landing/site-header'
import { Workflow } from '@/components/v2/landing/workflow'

/**
 * Marketing home page.
 *
 * Sections are composed top-to-bottom in narrative order: hook, journey,
 * capabilities, proof, price, close.
 */
export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Workflow />
        <Features />
        <Results />
        <Pricing />
      </main>
      <SiteFooter />
    </>
  )
}
