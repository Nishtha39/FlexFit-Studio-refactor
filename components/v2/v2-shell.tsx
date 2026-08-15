import { Inter, Outfit } from 'next/font/google'

/**
 * Wrapper that turns the v2 design tokens on for everything inside it.
 *
 * The v2 screens came from a standalone build whose root layout owned the fonts
 * and the palette. Here they are guests inside the back office's own root
 * layout, which loads Geist and the dense token set, so the two have to
 * coexist: `.v2-scope` (see app/globals.css) re-declares the palette, the radii
 * and the type scale for this subtree only, and the font variables are attached
 * to the same element so `--font-inter` / `--font-outfit` resolve within it.
 *
 * Used by both app/v2/layout.tsx and the marketing page at the site root.
 */

/** Body copy and UI text. */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

/** Display face for headings and the wordmark. */
const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

export function V2Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.variable} ${outfit.variable} v2-scope min-h-screen`}>
      {children}
    </div>
  )
}
