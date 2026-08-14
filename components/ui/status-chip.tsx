import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Status is NEVER communicated by color alone.
 * Every chip renders: a shape marker + a border + a text label.
 * Shape differs per tone so the chip survives greyscale and color blindness.
 */
export type Tone = 'good' | 'warn' | 'danger' | 'info' | 'neutral'

const toneClass: Record<Tone, string> = {
  good: 'border-good-border bg-good-soft text-good',
  warn: 'border-warn-border bg-warn-soft text-warn',
  danger: 'border-danger-border bg-danger-soft text-danger',
  info: 'border-info-border bg-info-soft text-info',
  neutral: 'border-border bg-neutral-chip text-muted-foreground',
}

/** Distinct marker shape per tone: ● good, ▲ warn, ■ danger, ◆ info, ○ neutral */
const markerClass: Record<Tone, string> = {
  good: 'rounded-full bg-good',
  warn: 'bg-warn [clip-path:polygon(50%_0,100%_100%,0_100%)]',
  danger: 'bg-danger',
  info: 'bg-info [clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)]',
  neutral: 'rounded-full border border-border-strong bg-transparent',
}

export function StatusMarker({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden className={cn('size-2 shrink-0', markerClass[tone], className)} />
}

export function StatusChip({
  tone = 'neutral',
  label,
  title,
  className,
}: {
  tone?: Tone
  label: string
  title?: string
  className?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-micro font-medium whitespace-nowrap',
        toneClass[tone],
        className,
      )}
    >
      <StatusMarker tone={tone} />
      {label}
    </span>
  )
}

/* ---------------------------------------------------------------------------
   Domain status → tone + label maps. Later batches import these so a
   "past_due" member looks identical on every screen.
--------------------------------------------------------------------------- */

export const memberStatusMap = {
  active: { tone: 'good', label: 'Active' },
  at_risk: { tone: 'warn', label: 'At risk' },
  past_due: { tone: 'danger', label: 'Past due' },
  frozen: { tone: 'info', label: 'Frozen' },
  lapsed: { tone: 'neutral', label: 'Lapsed' },
  trial: { tone: 'info', label: 'Trial' },
  expiring: { tone: 'warn', label: 'Expiring' },
} as const satisfies Record<string, { tone: Tone; label: string }>

export const paymentStatusMap = {
  paid: { tone: 'good', label: 'Paid' },
  pending: { tone: 'warn', label: 'Pending' },
  failed: { tone: 'danger', label: 'Failed' },
  refunded: { tone: 'neutral', label: 'Refunded' },
  reversal: { tone: 'info', label: 'Reversal' },
} as const satisfies Record<string, { tone: Tone; label: string }>

export const bookingStatusMap = {
  booked: { tone: 'good', label: 'Booked' },
  checked_in: { tone: 'good', label: 'Checked in' },
  waitlisted: { tone: 'info', label: 'Waitlisted' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
  no_show: { tone: 'danger', label: 'No-show' },
  late_cancel: { tone: 'warn', label: 'Late cancel' },
} as const satisfies Record<string, { tone: Tone; label: string }>

export const leadStageMap = {
  inquiry: { tone: 'neutral', label: 'Inquiry' },
  toured: { tone: 'info', label: 'Toured' },
  trial: { tone: 'info', label: 'Trial' },
  joined: { tone: 'good', label: 'Joined' },
  lost: { tone: 'danger', label: 'Lost' },
} as const satisfies Record<string, { tone: Tone; label: string }>

type MapKey<M> = Extract<keyof M, string>

function chipFromMap<M extends Record<string, { tone: Tone; label: string }>>(
  map: M,
  key: string,
): { tone: Tone; label: string } {
  return map[key as MapKey<M>] ?? { tone: 'neutral', label: key.replace(/_/g, ' ') }
}

export function MemberStatus({ status, className }: { status: string; className?: string }) {
  const { tone, label } = chipFromMap(memberStatusMap, status)
  return <StatusChip tone={tone} label={label} className={className} />
}

export function PaymentStatus({ status, className }: { status: string; className?: string }) {
  const { tone, label } = chipFromMap(paymentStatusMap, status)
  return <StatusChip tone={tone} label={label} className={className} />
}

export function BookingStatus({ status, className }: { status: string; className?: string }) {
  const { tone, label } = chipFromMap(bookingStatusMap, status)
  return <StatusChip tone={tone} label={label} className={className} />
}

/** Risk score badge — tone by band, and the number is always visible. */
export function RiskScore({ score, className }: { score: number; className?: string }) {
  const tone: Tone = score >= 70 ? 'danger' : score >= 45 ? 'warn' : 'good'
  const band = score >= 70 ? 'High' : score >= 45 ? 'Watch' : 'Low'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-micro font-medium tnum',
        toneClass[tone],
        className,
      )}
    >
      <StatusMarker tone={tone} />
      <span>{score}</span>
      <span className="opacity-70">{band}</span>
    </span>
  )
}

/** Signed delta text with tone. `inverse` for metrics where down is good. */
export function DeltaText({
  value,
  formatted,
  inverse = false,
  className,
}: {
  value: number
  formatted: string
  inverse?: boolean
  className?: string
}) {
  const flat = Math.abs(value) < 0.05
  const positive = value > 0
  const good = inverse ? !positive : positive
  return (
    <span
      className={cn(
        // shrink-0 + nowrap: without them flex crushes this box below its
        // content width and the arrow collides with the metric value.
        'inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-micro font-medium tnum',
        flat ? 'text-muted-foreground' : good ? 'text-good' : 'text-danger',
        className,
      )}
    >
      <span aria-hidden>{flat ? '\u2192' : positive ? '\u2191' : '\u2193'}</span>
      {formatted}
    </span>
  )
}

/** Days-in-stage / aging chip used on leads and dunning. */
export function AgingChip({ days, className }: { days: number; className?: string }) {
  const tone: Tone = days >= 14 ? 'danger' : days >= 7 ? 'warn' : 'neutral'
  return <StatusChip tone={tone} label={`${days}d in stage`} className={className} />
}

export { toneClass }
