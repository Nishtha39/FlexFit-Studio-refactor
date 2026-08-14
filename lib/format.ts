/** Shared formatters. Every number that lands in a table goes through here. */

/**
 * Locale is fixed to en-IN / INR so amounts group the Indian way
 * (₹4,82,500 — not ₹482,500) and never shift with the viewer's machine.
 */
export const LOCALE = 'en-IN'
export const CURRENCY = 'INR'

const currencyFmt = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: 0,
})

const currencyPaiseFmt = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** `paise: true` for invoice lines where exact settlement matters. */
export function money(value: number, opts?: { paise?: boolean }) {
  return opts?.paise ? currencyPaiseFmt.format(value) : currencyFmt.format(value)
}

/** Lakh / crore short form for tight KPI tiles: ₹48.3L, ₹1.2Cr, ₹4.8k. */
export function compactMoney(value: number) {
  const abs = Math.abs(value)
  const sign = value < 0 ? '\u2212' : ''
  const trim = (n: number) => (Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1))
  if (abs >= 10_000_000) return `${sign}\u20b9${trim(abs / 10_000_000)}Cr`
  if (abs >= 100_000) return `${sign}\u20b9${trim(abs / 100_000)}L`
  if (abs >= 1_000) return `${sign}\u20b9${trim(abs / 1_000)}k`
  return money(value)
}

export function num(value: number, digits = 0) {
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function percent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`
}

/** Signed delta string, e.g. "+4.2%" / "−1.8%". Uses a real minus sign. */
export function delta(value: number, opts?: { digits?: number; unit?: string }) {
  const digits = opts?.digits ?? 1
  const unit = opts?.unit ?? '%'
  const sign = value > 0 ? '+' : value < 0 ? '\u2212' : ''
  return `${sign}${Math.abs(value).toFixed(digits)}${unit}`
}

export type DeltaTone = 'good' | 'bad' | 'flat'

/** `inverse` for metrics where down is good (churn, no-shows). */
export function deltaTone(value: number, inverse = false): DeltaTone {
  if (Math.abs(value) < 0.05) return 'flat'
  const positive = value > 0
  return (inverse ? !positive : positive) ? 'good' : 'bad'
}

/**
 * Every date formatter is pinned to one timezone. Without this the server
 * (UTC) and the browser (the staff member's local zone) render different
 * strings for the same instant and React throws a hydration mismatch.
 */
export const TIME_ZONE = 'Asia/Kolkata'

const dateFmt = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  day: 'numeric',
  timeZone: TIME_ZONE,
})
const dateYearFmt = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: TIME_ZONE,
})
const monthFmt = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  year: '2-digit',
  timeZone: TIME_ZONE,
})
const weekdayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', timeZone: TIME_ZONE })
const dayFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', timeZone: TIME_ZONE })
const monthOnlyFmt = new Intl.DateTimeFormat(LOCALE, { month: 'short', timeZone: TIME_ZONE })
const timeFmt = new Intl.DateTimeFormat(LOCALE, {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: TIME_ZONE,
})

function toDate(value: Date | string | number) {
  return value instanceof Date ? value : new Date(value)
}

export const shortDate = (v: Date | string | number) => dateFmt.format(toDate(v))
export const fullDate = (v: Date | string | number) => dateYearFmt.format(toDate(v))
export const monthLabel = (v: Date | string | number) => monthFmt.format(toDate(v))
export const weekday = (v: Date | string | number) => weekdayFmt.format(toDate(v))
/** "6:30pm" — collapses both the ASCII and narrow no-break space Intl emits. */
export const clock = (v: Date | string | number) =>
  timeFmt.format(toDate(v)).replace(/[\s\u202f\u00a0]/g, '').toLowerCase()

/** "6:30pm, Tue 12 Aug" — the timestamp form used in forfeit warnings. */
export function deadlineStamp(v: Date | string | number) {
  const d = toDate(v)
  return `${clock(d)}, ${weekday(d)} ${dayFmt.format(d)} ${monthOnlyFmt.format(d)}`
}

export function daysAgo(v: Date | string | number, now = new Date()) {
  const diff = Math.floor((now.getTime() - toDate(v).getTime()) / 86_400_000)
  if (diff <= 0) return 'today'
  if (diff === 1) return 'yesterday'
  if (diff < 30) return `${diff}d ago`
  if (diff < 365) return `${Math.floor(diff / 30)}mo ago`
  return `${Math.floor(diff / 365)}y ago`
}

export function tenure(joined: Date | string | number, now = new Date()) {
  const months = Math.max(
    0,
    Math.floor((now.getTime() - toDate(joined).getTime()) / (86_400_000 * 30.44)),
  )
  if (months < 1) return 'new'
  if (months < 24) return `${months} mo`
  return `${(months / 12).toFixed(1)} yr`
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${num(count)} ${count === 1 ? singular : plural}`
}
