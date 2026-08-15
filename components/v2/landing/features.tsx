import { Icon } from '@/components/v2/shared/icon'
import { Reveal } from '@/components/v2/shared/reveal'
import { FEATURES } from '@/lib/v2/data/landing'

/** Capability grid. Plain cards, staggered in as the section enters view. */
export function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-t border-border py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <Reveal className="max-w-2xl">
          <p className="text-[11px] font-medium tracking-[0.14em] text-brand uppercase">
            What you get
          </p>
          <h2 className="mt-4 font-display text-3xl leading-[1.1] font-semibold tracking-[-0.03em] text-balance sm:text-4xl lg:text-[2.75rem]">
            The whole operation, without the tab-switching
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground text-pretty">
            Six things your team touches every day, built to work together
            rather than sit in separate tools.
          </p>
        </Reveal>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <Reveal
              as="li"
              key={feature.title}
              delay={index * 0.06}
              className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-brand/40"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-secondary transition-colors group-hover:bg-brand-soft">
                <Icon
                  name={feature.icon}
                  className="size-[18px] text-foreground transition-colors group-hover:text-brand"
                />
              </span>
              <h3 className="mt-5 font-display text-[17px] font-semibold tracking-[-0.01em]">
                {feature.title}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground text-pretty">
                {feature.description}
              </p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
