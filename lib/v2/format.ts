/**
 * SANDBOX SUBSET — do not copy into FlexFit-Studio-refactor.
 *
 * Mirrors the signatures of the repo's richer `lib/format.ts` for the handful of
 * helpers the new detail screens use, so imports resolve identically in both.
 */

/** Fixed reference "now" so derived day counts never shift between renders. */
export const NOW = new Date('2025-04-14T09:00:00.000Z')

export function money(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function num(value: number, digits = 0): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function daysAgo(v: Date | string | number, now: Date = NOW): number {
  const then = new Date(v).getTime()
  return Math.max(0, Math.round((now.getTime() - then) / 86_400_000))
}

/** "14 Apr 2025" — stable across locales because the locale is pinned. */
export function dateStamp(v: Date | string | number): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(v))
}

/** "18:00" plus a duration into "18:00 – 19:00". */
export function timeRange(startTime: string, durationMin: number): string {
  const [h, m] = startTime.split(':').map(Number)
  const end = new Date(Date.UTC(2025, 0, 1, h, m + durationMin))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${startTime} – ${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}`
}

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const
