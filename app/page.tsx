import { redirect } from 'next/navigation'

/**
 * Batch 7 replaces the design-system showcase that used to live here. The root
 * has no content of its own: the owner is the default role, so the app opens on
 * the owner dashboard. Other roles land on their own screen via the role
 * switcher, which reads `roleMeta.landing`.
 */
export default function RootPage() {
  redirect('/dashboard')
}
