// Deterministic seeded PRNG + date helpers.
// Every data file derives its own independent stream from a fixed seed constant,
// so generated data is identical on every run regardless of import order.

/** mulberry32 — tiny, fast, deterministic 32-bit PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Rng {
  /** Raw float in [0, 1). */
  next: () => number
  /** Integer in [min, max] inclusive. */
  int: (min: number, max: number) => number
  /** Float in [min, max). */
  float: (min: number, max: number) => number
  /** true with probability p. */
  bool: (p?: number) => boolean
  /** Pick a random element. */
  pick: <T>(arr: readonly T[]) => T
  /** Pick n distinct elements (order preserved-ish). */
  sample: <T>(arr: readonly T[], n: number) => T[]
  /** Weighted pick: entries of [value, weight]. */
  weighted: <T>(entries: readonly (readonly [T, number])[]) => T
  /** In-place Fisher–Yates shuffle returning a new array. */
  shuffle: <T>(arr: readonly T[]) => T[]
  /** Roughly-normal value via averaging (Irwin–Hall), clamped to [min, max]. */
  normal: (min: number, max: number, spread?: number) => number
}

export function makeRng(seed: number): Rng {
  const r = mulberry32(seed)
  const int = (min: number, max: number) => Math.floor(r() * (max - min + 1)) + min
  const float = (min: number, max: number) => r() * (max - min) + min
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length)]
  const shuffle = <T,>(arr: readonly T[]): T[] => {
    const out = arr.slice()
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }
  return {
    next: r,
    int,
    float,
    bool: (p = 0.5) => r() < p,
    pick,
    sample: <T,>(arr: readonly T[], n: number): T[] => shuffle(arr).slice(0, Math.max(0, Math.min(n, arr.length))),
    weighted: <T,>(entries: readonly (readonly [T, number])[]): T => {
      const total = entries.reduce((s, [, w]) => s + w, 0)
      let roll = r() * total
      for (const [value, w] of entries) {
        roll -= w
        if (roll <= 0) return value
      }
      return entries[entries.length - 1][0]
    },
    shuffle,
    normal: (min: number, max: number, spread = 3) => {
      let sum = 0
      for (let i = 0; i < spread; i++) sum += r()
      const t = sum / spread
      return min + t * (max - min)
    },
  }
}

// ---------------------------------------------------------------------------
// Fixed "now" so the whole dataset is stable and relationships line up.
// ---------------------------------------------------------------------------
export const NOW = new Date("2026-08-14T09:00:00.000Z")

const DAY_MS = 24 * 60 * 60 * 1000

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime())
  d.setUTCMonth(d.getUTCMonth() + months)
  return d
}

/** YYYY-MM-DD */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Full ISO timestamp */
export function isoStamp(date: Date): string {
  return date.toISOString()
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS)
}

export function startOfDay(date: Date): Date {
  const d = new Date(date.getTime())
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(date: Date): number {
  return date.getUTCDay()
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
export const WEEKDAY_LABELS_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const
