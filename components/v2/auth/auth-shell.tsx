import Image from 'next/image'
import type { ReactNode } from 'react'
import { Logo } from '@/components/v2/shared/logo'

interface AuthShellProps {
  title: string
  subtitle: string
  children: ReactNode
  /** Pull-quote shown on the image panel. */
  aside: { quote: string; attribution: string }
  image: { src: string; alt: string }
}

/**
 * Split-screen layout shared by login and signup.
 *
 * The form column sits on the dotted paper background so the auth pages read
 * as the same product as the landing hero; the image column only appears from
 * `lg` up, where there is room for it.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  aside,
  image,
}: AuthShellProps) {
  return (
    <main className="flex min-h-svh">
      <div className="flex w-full flex-col bg-dotted px-5 py-8 sm:px-8 lg:w-1/2 lg:px-14">
        <Logo />

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <h1 className="font-display text-3xl leading-tight font-semibold tracking-[-0.03em] text-balance">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
              {subtitle}
            </p>

            <div className="mt-8">{children}</div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground lg:text-left">
          &copy; {new Date().getFullYear()} FlexFit Studio
        </p>
      </div>

      <div className="relative hidden lg:block lg:w-1/2">
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="50vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-ink/55" aria-hidden="true" />
        <figure className="absolute inset-x-0 bottom-0 p-10 xl:p-14">
          <blockquote className="max-w-md font-display text-2xl leading-snug font-medium tracking-[-0.02em] text-balance text-white">
            &ldquo;{aside.quote}&rdquo;
          </blockquote>
          <figcaption className="mt-5 text-sm text-white/60">
            {aside.attribution}
          </figcaption>
        </figure>
      </div>
    </main>
  )
}
