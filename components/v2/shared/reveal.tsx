'use client'

import { motion, useReducedMotion, type Variants } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  /** Seconds of delay, used to stagger siblings. */
  delay?: number
  /** Travel distance in px before settling. */
  distance?: number
  className?: string
  as?: 'div' | 'section' | 'li' | 'span'
}

/**
 * Scroll-triggered entrance used throughout the landing page.
 *
 * Centralising this keeps the easing and viewport margin consistent across
 * every section, and gives one place to honour `prefers-reduced-motion`.
 *
 * Content is rendered fully visible on the server and only opts into the
 * hidden-then-reveal animation after mount. Without that gate, the server
 * markup ships `opacity: 0` and the copy stays permanently invisible for
 * anyone whose JS is slow, blocked, or broken.
 */
export function Reveal({
  children,
  delay = 0,
  distance = 24,
  className,
  as = 'div',
}: RevealProps) {
  const reduceMotion = useReducedMotion()
  const [animate, setAnimate] = useState(false)
  const placeholder = useRef<HTMLElement>(null)
  const MotionTag = motion[as]

  useEffect(() => {
    // Only opt into the entrance for content that starts below the fold.
    // Animating something already on screen would flash it from visible (the
    // server markup) to hidden and back, which reads as a glitch on load.
    const top = placeholder.current?.getBoundingClientRect().top ?? 0
    if (top > window.innerHeight * 0.9) setAnimate(true)
  }, [])

  // Before hydration (or when motion is reduced) render a plain element so the
  // content is readable no matter what happens to the JS bundle.
  if (!animate || reduceMotion) {
    const Tag = as
    return (
      <Tag ref={placeholder as React.Ref<never>} className={className}>
        {children}
      </Tag>
    )
  }

  const variants: Variants = {
    hidden: { opacity: 0, y: distance },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        delay,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  }

  return (
    <MotionTag
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
    >
      {children}
    </MotionTag>
  )
}
