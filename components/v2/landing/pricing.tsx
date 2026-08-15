import Link from 'next/link'
import { Check } from 'lucide-react'
import { buttonVariants } from '@/components/v2/ui/button'
import { Reveal } from '@/components/v2/shared/reveal'
import { PLANS } from '@/lib/v2/data/landing'
import { cn } from '@/lib/v2/utils'

/** Three-tier pricing. The middle tier is lifted with the brand border. */
export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 border-t border-border py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-medium tracking-[0.14em] text-brand uppercase">
            Pricing
          </p>
          <h2 className="mt-4 font-display text-3xl leading-[1.1] font-semibold tracking-[-0.03em] text-balance sm:text-4xl lg:text-[2.75rem]">
            One plan per stage of growth
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground text-pretty">
            Every tier includes onboarding, data import and unlimited staff
            accounts. No setup fees, cancel whenever.
          </p>
        </Reveal>

        <ul className="mt-12 grid items-start gap-4 lg:mt-16 lg:grid-cols-3">
          {PLANS.map((plan, index) => (
            <Reveal
              as="li"
              key={plan.name}
              delay={index * 0.08}
              className={cn(
                'rounded-2xl border bg-card p-7',
                plan.featured
                  ? 'border-brand shadow-[0_24px_60px_-32px_rgb(88_128_218_/_0.5)] lg:-mt-4 lg:pb-9'
                  : 'border-border',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-[17px] font-semibold">{plan.name}</h3>
                {plan.featured && (
                  <span className="rounded-full bg-lime px-2.5 py-1 text-[10px] font-semibold tracking-wide text-ink uppercase">
                    Most picked
                  </span>
                )}
              </div>

              <p className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-4xl font-semibold tracking-[-0.03em]">
                  {plan.price}
                </span>
                {plan.cadence && (
                  <span className="text-sm text-muted-foreground">{plan.cadence}</span>
                )}
              </p>

              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {plan.description}
              </p>

              <Link
                href="/signup"
                className={cn(
                  buttonVariants(),
                  'mt-6 h-11 w-full rounded-full text-sm',
                  plan.featured
                    ? 'bg-brand text-white hover:bg-brand/90'
                    : 'bg-secondary text-foreground hover:bg-secondary/70',
                )}
              >
                {plan.price === 'Custom' ? 'Talk to sales' : 'Start free trial'}
              </Link>

              <ul className="mt-7 flex flex-col gap-3 border-t border-border pt-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-soft">
                      <Check className="size-2.5 text-brand" strokeWidth={3} aria-hidden="true" />
                    </span>
                    <span className="text-sm leading-relaxed text-muted-foreground">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
