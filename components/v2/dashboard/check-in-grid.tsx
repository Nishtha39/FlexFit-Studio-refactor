import { CHECK_IN_DAYS, CHECK_IN_HOURS, CHECK_INS } from '@/lib/v2/data/dashboard'

/**
 * Occupancy density grid: hours down, days across.
 *
 * This is the dashboard's signature panel — everything else on the page is
 * deliberately quieter so this reads first. Intensity maps to four discrete
 * steps rather than a continuous ramp, because staff act on bands ("quiet",
 * "busy"), not on precise percentages.
 */
function swatch(intensity: number): string {
  if (intensity > 0.72) return 'bg-brand'
  if (intensity > 0.5) return 'bg-brand/60'
  if (intensity > 0.28) return 'bg-sky'
  return 'bg-secondary'
}

function band(intensity: number): string {
  if (intensity > 0.72) return 'peak'
  if (intensity > 0.5) return 'busy'
  if (intensity > 0.28) return 'steady'
  return 'quiet'
}

export function CheckInGrid() {
  return (
    <section
      aria-labelledby="checkin-heading"
      className="rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="checkin-heading" className="font-display text-base font-semibold">
            Floor occupancy
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Check-ins by hour · last 14 days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Quiet</span>
          <div className="flex items-center gap-1" aria-hidden="true">
            {['bg-secondary', 'bg-sky', 'bg-brand/60', 'bg-brand'].map((tone) => (
              <span key={tone} className={`size-3 rounded-[3px] ${tone}`} />
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground">Peak</span>
        </div>
      </div>

      {/* Each hour label sits in the same flex row as its cells so the two
          columns stay locked together at every breakpoint. */}
      <div className="mt-5 flex flex-col gap-1.5">
        {CHECK_IN_HOURS.map((hour, hourIndex) => (
          <div key={hour} className="flex items-center gap-3">
            <span className="w-11 shrink-0 text-right text-[11px] text-muted-foreground">
              {hour}
            </span>
            <div className="flex flex-1 gap-1.5">
              {CHECK_INS.filter((cell) => cell.hour === hourIndex).map((cell) => (
                <span
                  key={`${cell.hour}-${cell.day}`}
                  title={`${hour}, day ${cell.day + 1} — ${band(cell.intensity)}`}
                  className={`h-4 flex-1 rounded-[3px] ${swatch(cell.intensity)}`}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="flex justify-between pl-14">
          <span className="text-[11px] text-muted-foreground">
            {CHECK_IN_DAYS} days ago
          </span>
          <span className="text-[11px] text-muted-foreground">Today</span>
        </div>
      </div>

      <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
        The 6 PM band runs at peak on every weekday. Two extra floor staff
        between 17:30 and 19:30 would cover it.
      </p>
    </section>
  )
}
