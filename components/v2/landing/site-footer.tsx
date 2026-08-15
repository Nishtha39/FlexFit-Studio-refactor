import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { buttonVariants } from '@/components/v2/ui/button'
import { Logo } from '@/components/v2/shared/logo'
import { Reveal } from '@/components/v2/shared/reveal'
import { FOOTER_GROUPS } from '@/lib/v2/data/landing'
import { cn } from '@/lib/v2/utils'

/** Closing CTA over a gym photograph, followed by the site footer. */
export function SiteFooter() {
  return (
    <>
      <section className="px-5 pb-20 lg:pb-28">
        <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl">
          <Image
            src="/images/gym-warehouse.jpg"
            alt=""
            fill
            sizes="(min-width: 1024px) 72rem, 100vw"
            className="object-cover"
            aria-hidden="true"
          />
          {/* Scrim keeps the copy legible over the photograph. */}
          <div
            className="absolute inset-0 bg-ink/72"
            aria-hidden="true"
          />
          <div className="relative px-6 py-16 text-center sm:px-10 lg:py-24">
            <h2 className="mx-auto max-w-2xl font-display text-3xl leading-[1.1] font-semibold tracking-[-0.03em] text-balance text-white sm:text-4xl lg:text-[2.75rem]">
              Give your front desk its afternoons back
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-white/70 text-pretty">
              Import your members, connect your timetable and run your first
              week on FlexFit. Free for 14 days, no card needed.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className={cn(
                  buttonVariants({ size: 'lg' }),
                  'group h-12 rounded-full bg-white px-7 text-[15px] text-ink hover:bg-white/90',
                )}
              >
                Start free trial
                <ArrowRight
                  className="ml-1 size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
              <Link
                href="/dashboard"
                className={cn(
                  buttonVariants({ size: 'lg', variant: 'outline' }),
                  'h-12 rounded-full border-white/25 bg-transparent px-7 text-[15px] text-white hover:bg-white/10 hover:text-white',
                )}
              >
                See the dashboard
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border py-14">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_2fr]">
            <div>
              <Logo />
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground text-pretty">
                Gym management software for teams who would rather be on the
                floor than in a spreadsheet.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              {FOOTER_GROUPS.map((group) => (
                <div key={group.title}>
                  <h3 className="text-xs font-semibold tracking-[0.1em] text-foreground uppercase">
                    {group.title}
                  </h3>
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {group.links.map((link) => (
                      <li key={link}>
                        <Link
                          href="#"
                          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {link}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} FlexFit Studio. All rights reserved.
            </p>
            <ul className="flex items-center gap-5">
              {['Privacy', 'Terms', 'Security'].map((item) => (
                <li key={item}>
                  <Link
                    href="#"
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </footer>
    </>
  )
}
