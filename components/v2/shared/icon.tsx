import {
  Activity,
  CalendarDays,
  CreditCard,
  Dumbbell,
  LayoutGrid,
  Settings,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'

/**
 * Registry mapping the icon names stored in the data layer to components.
 *
 * Data modules reference icons by string so they stay serialisable and can
 * cross a tRPC boundary later without importing React.
 */
const REGISTRY = {
  Activity,
  CalendarDays,
  CreditCard,
  Dumbbell,
  LayoutGrid,
  Settings,
  TrendingUp,
  Users,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof REGISTRY

interface IconProps {
  name: string
  className?: string
}

/** Renders a registered icon, or nothing when the name is unknown. */
export function Icon({ name, className }: IconProps) {
  const Glyph = REGISTRY[name as IconName]
  if (!Glyph) return null
  return <Glyph className={className} aria-hidden="true" />
}
