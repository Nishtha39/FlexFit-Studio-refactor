import Image from 'next/image'
import { Reveal } from '@/components/v2/shared/reveal'
import { RESULTS, TESTIMONIALS } from '@/lib/v2/data/landing'

/**
 * The page's one loud moment: an inverted ink panel carrying the numbers and
 * the quotes. Everything around it stays on paper, so this reads as the
 * anchor rather than one more card.
 */
export function Results() {
  return (
    <section id="results" className="scroll-mt-20 px-5 pb-20 lg:pb-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="overflow-hidden rounded-3xl bg-ink px-6 py-14 text-white sm:px-10 lg:px-14 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium tracking-[0.14em] text-lime uppercase">
              Results
            </p>
            <h2 className="mt-4 font-display text-3xl leading-[1.1] font-semibold tracking-[-0.03em] text-balance sm:text-4xl lg:text-[2.75rem]">
              Less time on admin, more members who stay
            </h2>
          </div>

          <ul className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 lg:mt-16 lg:grid-cols-4">
            {RESULTS.map((result, index) => (
              <Reveal as="li" key={result.label} delay={index * 0.08}>
                <p className="font-display text-4xl leading-none font-semibold tracking-[-0.03em] lg:text-5xl">
                  {result.value}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-white/55 text-pretty">
                  {result.label}
                </p>
              </Reveal>
            ))}
          </ul>

          <div className="mt-14 grid gap-4 border-t border-white/10 pt-12 lg:mt-20 lg:grid-cols-2 lg:gap-6">
            {TESTIMONIALS.map((testimonial, index) => (
              <Reveal
                key={testimonial.name}
                delay={index * 0.1}
                className="rounded-2xl bg-white/[0.04] p-6 lg:p-7"
              >
                <blockquote className="text-[15px] leading-relaxed text-white/85 text-pretty">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <Image
                    src={testimonial.avatar}
                    alt={`Portrait of ${testimonial.name}`}
                    width={36}
                    height={36}
                    className="size-9 rounded-full object-cover"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{testimonial.name}</span>
                    <span className="text-xs text-white/50">{testimonial.role}</span>
                  </span>
                </figcaption>
              </Reveal>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
