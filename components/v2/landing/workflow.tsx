import Image from 'next/image'
import { Reveal } from '@/components/v2/shared/reveal'
import { WORKFLOW_STEPS } from '@/lib/v2/data/landing'

/**
 * Three-beat member journey.
 *
 * Rows alternate image side on desktop so the eye zig-zags down the page,
 * which is what carries the scroll story between hero and product.
 */
export function Workflow() {
  return (
    <section id="workflow" className="scroll-mt-20 border-t border-border py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <Reveal className="max-w-2xl">
          <p className="text-[11px] font-medium tracking-[0.14em] text-brand uppercase">
            The member journey
          </p>
          <h2 className="mt-4 font-display text-3xl leading-[1.1] font-semibold tracking-[-0.03em] text-balance sm:text-4xl lg:text-[2.75rem]">
            Every stage in one place, from first visit to fifth year
          </h2>
        </Reveal>

        <div className="mt-14 flex flex-col gap-16 lg:mt-20 lg:gap-24">
          {WORKFLOW_STEPS.map((step, index) => {
            const imageFirst = index % 2 === 1

            return (
              <Reveal
                key={step.title}
                className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16"
              >
                <div
                  className={
                    imageFirst ? 'lg:order-2 lg:pl-4' : 'lg:order-1 lg:pr-4'
                  }
                >
                  <span className="font-display text-sm font-medium text-muted-foreground/60">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-3 font-display text-2xl leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-3xl">
                    {step.title}
                  </h3>
                  <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground text-pretty">
                    {step.body}
                  </p>
                </div>

                <div className={imageFirst ? 'lg:order-1' : 'lg:order-2'}>
                  <div className="relative aspect-4/3 overflow-hidden rounded-2xl border border-border bg-secondary">
                    <Image
                      src={step.image}
                      alt={step.alt}
                      fill
                      sizes="(min-width: 1024px) 44rem, 100vw"
                      className="object-cover"
                      priority={index === 0}
                    />
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
