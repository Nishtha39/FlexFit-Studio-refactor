import type { CheckIn, DailyAttendance, LocationId } from "../types"
import { addDays, addMonths, isoDate, isoStamp, makeRng, NOW, startOfDay, weekday } from "../seed"
import { members } from "./members"
import { TRAINER_DEPARTURE_DATE } from "./staff"

const rng = makeRng(0xa77e11)

// Relative demand by weekday (0 = Sun ... 6 = Sat). Weekday mornings/evenings
// carry the gym; weekends are lighter.
const WEEKDAY_FACTOR = [0.62, 1.08, 1.12, 1.1, 1.08, 0.9, 0.66]

// Hour-of-day weights — twin peaks at 7–9am and 5–8pm.
const HOUR_WEIGHTS = [
  0, 0, 0, 0, 0, 2, 6, 14, 16, 10, 6, 7, 9, 6, 5, 6, 10, 16, 18, 15, 9, 4, 1, 0,
]

const LOCATION_SHARE: (readonly [LocationId, number])[] = [
  ["downtown", 5],
  ["riverside", 3],
  ["north-loop", 2],
]

/** Multiplier capturing January spike, summer dip, and the March trainer departure. */
function seasonalFactor(date: Date): number {
  const month = date.getUTCMonth() // 0 = Jan
  let f = 1

  // New-year resolution spike.
  if (month === 0) f *= 1.35
  else if (month === 1) f *= 1.12 // February afterglow, tapering

  // Summer dip (Jun–Aug).
  if (month >= 5 && month <= 7) f *= 0.82

  // Step-down after the HIIT/Boxing trainer departed — a real, lasting drop
  // that only partially recovers over the following months.
  if (date.getTime() >= TRAINER_DEPARTURE_DATE.getTime()) {
    const weeksSince = (date.getTime() - TRAINER_DEPARTURE_DATE.getTime()) / (7 * 24 * 3600 * 1000)
    const recovery = Math.min(0.06, weeksSince * 0.002) // slow, incomplete recovery
    f *= 0.88 + recovery
  }

  return f
}

// ---------------------------------------------------------------------------
// Daily gym-wide attendance for the trailing 18 months.
// ---------------------------------------------------------------------------
function buildDaily(): DailyAttendance[] {
  const out: DailyAttendance[] = []
  const start = startOfDay(addMonths(NOW, -18))
  const end = startOfDay(NOW)
  const BASE = 210 // typical weekday visits across all locations

  for (let d = new Date(start); d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    const wd = weekday(d)
    const base = BASE * WEEKDAY_FACTOR[wd] * seasonalFactor(d)
    const noise = rng.float(0.9, 1.1)
    out.push({ date: isoDate(d), count: Math.round(base * noise) })
  }
  return out
}

export const dailyAttendance: DailyAttendance[] = buildDaily()

// ---------------------------------------------------------------------------
// Per-member check-in events for the trailing 52 weeks (drives member heatmaps
// and the dashboard hour × weekday heatmap).
// ---------------------------------------------------------------------------
function pickHour(): number {
  const total = HOUR_WEIGHTS.reduce((s, w) => s + w, 0)
  let roll = rng.next() * total
  for (let h = 0; h < 24; h++) {
    roll -= HOUR_WEIGHTS[h]
    if (roll <= 0) return h
  }
  return 18
}

function buildCheckIns(): CheckIn[] {
  const out: CheckIn[] = []
  const horizonDays = 364
  let seq = 0

  for (const m of members) {
    // How far back this member's history plausibly extends.
    const tenureDays = Math.min(horizonDays, Math.max(0, m.metrics.tenureMonths * 30))
    if (tenureDays <= 0) continue

    // No visits more recent than their last-visit gap.
    const gap = m.metrics.daysSinceLastVisit
    const mostRecentOffset = gap === null ? horizonDays + 1 : gap
    if (gap === null) continue // never visited → no events

    // Weekly rate anchored on current behaviour, slightly higher earlier for
    // members whose attendance is declining.
    const currentRate = m.metrics.avgVisitsPerWeek
    const earlierRate = Math.max(currentRate, m.metrics.visitsPrev30 / 4.33)

    const weeks = Math.floor(tenureDays / 7)
    for (let w = 0; w < weeks; w++) {
      // w = 0 is the most recent week.
      const isEarlier = w > 8
      const rate = isEarlier ? earlierRate : currentRate
      const visitsThisWeek = Math.round(rate * rng.float(0.6, 1.25))
      for (let v = 0; v < visitsThisWeek; v++) {
        const dayOffset = w * 7 + rng.int(0, 6)
        if (dayOffset < mostRecentOffset) continue // respects the inactivity gap
        if (dayOffset > horizonDays) continue
        const hour = pickHour()
        const ts = new Date(startOfDay(addDays(NOW, -dayOffset)))
        ts.setUTCHours(hour, rng.int(0, 59), 0, 0)
        const date = isoDate(ts)
        out.push({
          id: `ci-${(++seq).toString().padStart(6, "0")}`,
          memberId: m.id,
          location: rng.weighted(LOCATION_SHARE),
          timestamp: isoStamp(ts),
          date,
          hour,
          weekday: weekday(ts),
          classId: null,
        })
      }
    }
  }

  out.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)) // newest first
  return out
}

export const checkIns: CheckIn[] = buildCheckIns()

export const checkInsByMember: Map<string, CheckIn[]> = (() => {
  const map = new Map<string, CheckIn[]>()
  for (const ci of checkIns) {
    const list = map.get(ci.memberId)
    if (list) list.push(ci)
    else map.set(ci.memberId, [ci])
  }
  return map
})()

/** 7×24 matrix [weekday][hour] of check-in counts, for the dashboard heatmap. */
export function hourWeekdayMatrix(): number[][] {
  const matrix = Array.from({ length: 7 }, () => new Array(24).fill(0))
  for (const ci of checkIns) matrix[ci.weekday][ci.hour]++
  return matrix
}

/** 52-week visit counts (oldest → newest) for a single member's heatmap. */
export function weeklyCheckInCounts(memberId: string, weeks = 52): number[] {
  const counts = new Array(weeks).fill(0)
  const list = checkInsByMember.get(memberId) ?? []
  const now = startOfDay(NOW).getTime()
  for (const ci of list) {
    const daysAgo = Math.round((now - startOfDay(new Date(ci.date)).getTime()) / (24 * 3600 * 1000))
    const weekAgo = Math.floor(daysAgo / 7)
    if (weekAgo >= 0 && weekAgo < weeks) counts[weeks - 1 - weekAgo]++
  }
  return counts
}
