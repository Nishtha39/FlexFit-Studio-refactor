'use client'

import Link from 'next/link'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { ArrowRight, Check, Clock, Users } from 'lucide-react'
import { useRef } from 'react'
import { buttonVariants } from '@/components/v2/ui/button'
import { HERO, TRUST_STRIP } from '@/lib/v2/data/landing'
import { cn } from '@/lib/v2/utils'

/**
 * Floating card that drifts on scroll.
 *
 * `depth` scales the parallax travel so cards at different visual distances
 * move at different rates.
 */
function FloatingCard({
  children,
  className,
  depth = 1,
  delay = 0,
  progress,
}: {
  children: React.ReactNode
  className?: string
  depth?: number
  delay?: number
  progress: ReturnType<typeof useScroll>['scrollYProgress']
}) {
  const reduceMotion = useReducedMotion()
  const y = useTransform(progress, [0, 1], [0, reduceMotion ? 0 : -90 * depth])

  return (
    <motion.div
      style={{ y }}
      initial={{ opacity: 0, y: 28, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: reduceMotion ? 0 : 0.8,
        delay: reduceMotion ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      <div className="rounded-2xl border border-border bg-card p-3.5 shadow-[0_18px_40px_-24px_rgb(20_22_26_/_0.28)]">
        {children}
      </div>
    </motion.div>
  )
}

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })

  // The headline lifts and fades slightly as the next section arrives.
  const copyY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : -60])
  const copyOpacity = useTransform(scrollYProgress, [0, 0.75], [1, reduceMotion ? 1 : 0.2])

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-dotted pt-14 pb-20 sm:pt-20 lg:pb-28"
    >
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <motion.div
          style={{ y: copyY, opacity: copyOpacity }}
          className="relative z-10 mx-auto max-w-3xl text-center"
        >
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground"
          >
            <span className="size-1.5 rounded-full bg-lime" aria-hidden="true" />
            {HERO.eyebrow}
          </motion.p>

          <h1 className="mt-6 font-display text-[2.6rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-6xl lg:text-[4.25rem]">
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduceMotion ? 0 : 0.7,
                delay: reduceMotion ? 0 : 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="block text-foreground"
            >
              {HERO.titleLead}
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduceMotion ? 0 : 0.7,
                delay: reduceMotion ? 0 : 0.18,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="block text-muted-foreground"
            >
              {HERO.titleTrail}
            </motion.span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduceMotion ? 0 : 0.6,
              delay: reduceMotion ? 0 : 0.3,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-muted-foreground text-pretty"
          >
            {HERO.body}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduceMotion ? 0 : 0.6,
              delay: reduceMotion ? 0 : 0.4,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
          >
            {/* Links styled as buttons, so they keep real link semantics. */}
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ size: 'lg' }),
                'group h-12 rounded-full bg-brand px-7 text-[15px] text-white hover:bg-brand/90',
              )}
            >
              {HERO.primaryCta}
              <ArrowRight
                className="ml-1 size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
            <Link
              href="/dashboard"
              className={cn(
                buttonVariants({ size: 'lg', variant: 'outline' }),
                'h-12 rounded-full border-border bg-card px-7 text-[15px] hover:bg-secondary',
              )}
            >
              {HERO.secondaryCta}
            </Link>
          </motion.div>
        </motion.div>

        {/* Floating product fragments, hidden on small screens where they crowd the copy. */}
        <div
          className="pointer-events-none absolute inset-0 hidden lg:block"
          aria-hidden="true"
        >
          <FloatingCard
            progress={scrollYProgress}
            depth={1.3}
            delay={0.45}
            className="absolute top-24 left-4 w-56 -rotate-6 xl:left-10"
          >
            <div className="flex items-center gap-2 border-b border-border pb-2.5">
              <span className="flex size-6 items-center justify-center rounded-md bg-accent">
                <Users className="size-3 text-brand" />
              </span>
              <p className="text-xs font-medium">Today&apos;s check-ins</p>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-semibold">412</span>
              <span className="rounded-full bg-lime/40 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                +18
              </span>
            </div>
            <div className="mt-2.5 flex items-end gap-1">
              {[40, 62, 48, 78, 92, 70, 54].map((height, index) => (
                <span
                  key={index}
                  style={{ height: `${height * 0.32}px` }}
                  className="w-full rounded-sm bg-sky"
                />
              ))}
            </div>
          </FloatingCard>

          <FloatingCard
            progress={scrollYProgress}
            depth={0.7}
            delay={0.6}
            className="absolute top-14 right-4 w-52 rotate-[5deg] xl:right-10"
          >
            <p className="text-xs font-medium">Next class</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Strength Circuit · Studio 2
            </p>
            <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-brand-soft px-2 py-1.5">
              <Clock className="size-3 text-brand" />
              <span className="text-[11px] font-medium text-accent-foreground">
                18:00 — 18:45
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Capacity</span>
              <span className="font-medium text-foreground">22 / 24</span>
            </div>
          </FloatingCard>

          <FloatingCard
            progress={scrollYProgress}
            depth={1.05}
            delay={0.75}
            className="absolute bottom-4 left-12 w-60 rotate-[4deg] xl:left-20"
          >
            <p className="text-xs font-medium">Renewals this week</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {['Bloom Marchetti', 'Atlas Vance', 'Nova Reid'].map((name) => (
                <li key={name} className="flex items-center gap-2">
                  <span className="flex size-4 items-center justify-center rounded-full bg-lime">
                    <Check className="size-2.5 text-ink" strokeWidth={3} />
                  </span>
                  <span className="text-[11px] text-muted-foreground">{name}</span>
                </li>
              ))}
            </ul>
          </FloatingCard>

          <FloatingCard
            progress={scrollYProgress}
            depth={0.5}
            delay={0.9}
            className="absolute right-12 bottom-10 w-52 -rotate-[5deg] xl:right-20"
          >
            <p className="text-xs font-medium">Retention</p>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-semibold">87%</span>
              <span className="text-[10px] font-medium text-brand">+2%</span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-secondary">
              <span className="block h-full w-[87%] rounded-full bg-brand" />
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              90-day cohort, all locations
            </p>
          </FloatingCard>
        </div>
      </div>

      {/* Logo strip grounds the hero and starts the scroll narrative. */}
      <div className="relative z-10 mx-auto mt-16 max-w-6xl px-5 lg:mt-24 lg:px-8">
        <p className="text-center text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Trusted by independent studios and multi-site operators
        </p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {TRUST_STRIP.map((name, index) => (
            <motion.li
              key={name}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{
                duration: reduceMotion ? 0 : 0.5,
                delay: reduceMotion ? 0 : index * 0.06,
              }}
              className="font-display text-sm font-medium text-muted-foreground/70"
            >
              {name}
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  )
}
