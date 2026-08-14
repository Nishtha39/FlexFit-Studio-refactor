'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardBody, CardFooter, DataPoint } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { CalendarOff } from 'lucide-react'
import type { Member } from '@/lib/types'
import { WEEKDAY_LABELS } from '@/lib/seed'
import { weeklyCheckInCounts, checkInsByMember } from '@/lib/data/attendance'
import { clock, fullDate, num, shortDate } from '@/lib/format'
import { attendanceHeatmap, streakWeeks } from './profile-data'

/**
 * Attendance tab. The 52-week heatmap is the point: a churn score tells you a
 * member is leaving, the heatmap tells you when they started.
 */

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** 5 steps, encoded as fill AND border so the grid survives greyscale. */
function levelFor(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  if (count === 3) return 3
  return 4
}

const LEVEL_CLASS: Record<number, string> = {
  0: 'bg-muted',
  1: 'bg-primary/25',
  2: 'bg-primary/45',
  3: 'bg-primary/70',
  4: 'bg-primary',
}

export function AttendanceTab({ member }: { member: Member }) {
  const weekly = React.useMemo(() => weeklyCheckInCounts(member.id, 52), [member.id])
  const grid = React.useMemo(() => attendanceHeatmap(member.id, 52), [member.id])
  const visits = React.useMemo(() => checkInsByMember.get(member.id) ?? [], [member.id])

  const total = weekly.reduce((s, w) => s + w, 0)
  const activeWeeks = weekly.filter((w) => w > 0).length
  const bestWeek = Math.max(...weekly, 0)
  const streak = streakWeeks(weekly)
  const avgPerActiveWeek = activeWeeks > 0 ? total / activeWeeks : 0

  // Column headers: label a column only when its month differs from the previous.
  const monthMarks = React.useMemo(() => {
    const marks: (string | null)[] = []
    let last = ''
    for (let w = 0; w < 52; w++) {
      const firstDay = grid.find((d) => d.weekIndex === w)
      if (!firstDay) {
        marks.push(null)
        continue
      }
      const month = MONTH_SHORT[new Date(firstDay.date).getUTCMonth()]
      marks.push(month !== last ? month : null)
      last = month
    }
    return marks
  }, [grid])

  const byWeekday = React.useMemo(() => {
    const counts = new Array(7).fill(0)
    for (const v of visits) counts[v.weekday]++
    return counts
  }, [visits])

  const byHourBucket = React.useMemo(() => {
    const buckets = [
      { label: 'Early (5–9am)', from: 5, to: 9, count: 0 },
      { label: 'Midday (9am–4pm)', from: 9, to: 16, count: 0 },
      { label: 'Evening (4–9pm)', from: 16, to: 21, count: 0 },
      { label: 'Late (9pm+)', from: 21, to: 24, count: 0 },
    ]
    for (const v of visits) {
      const b = buckets.find((x) => v.hour >= x.from && v.hour < x.to)
      if (b) b.count++
    }
    return buckets
  }, [visits])

  if (visits.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon={CalendarOff}
          title="No check-ins on record"
          description={`${member.name} has never checked in. If they are training here, the door system is not matching their credential — verify it at the front desk.`}
        />
      </div>
    )
  }

  const maxWeekday = Math.max(...byWeekday, 1)
  const maxBucket = Math.max(...byHourBucket.map((b) => b.count), 1)

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* min-w-0 — see attendance-heatmap: keeps the min-w-[720px] grid inside
          its own scroll container instead of widening the page. */}
      <Card className="min-w-0">
        <CardHeader
          title="52-week attendance"
          description="One cell per day. Darker means more visits that day."
        />
        <CardBody>
          <div className="overflow-x-auto pb-1 scrollbar-thin">
            <div className="min-w-[720px]">
              {/* month row */}
              <div className="flex gap-[3px] pl-8">
                {monthMarks.map((mark, i) => (
                  <span
                    key={i}
                    className="w-2.5 shrink-0 text-micro text-muted-foreground"
                    aria-hidden
                  >
                    {mark ? <span className="relative -left-px">{mark}</span> : null}
                  </span>
                ))}
              </div>

              <div className="mt-1 flex gap-[3px]">
                {/* weekday labels — only alternating rows, to stay legible */}
                <div className="flex w-8 shrink-0 flex-col gap-[3px] pr-1">
                  {WEEKDAY_LABELS.map((label, i) => (
                    <span
                      key={label}
                      className="flex h-2.5 items-center justify-end text-micro leading-none text-muted-foreground"
                      aria-hidden
                    >
                      {i % 2 === 1 ? label : ''}
                    </span>
                  ))}
                </div>

                {/* one column per week */}
                {Array.from({ length: 52 }).map((_, week) => (
                  <div key={week} className="flex shrink-0 flex-col gap-[3px]">
                    {Array.from({ length: 7 }).map((_, day) => {
                      const cell = grid.find((d) => d.weekIndex === week && d.weekday === day)
                      if (!cell || cell.count < 0) {
                        return <span key={day} className="size-2.5" aria-hidden />
                      }
                      const level = levelFor(cell.count)
                      return (
                        <span
                          key={day}
                          title={`${fullDate(cell.date)} — ${cell.count === 0 ? 'no visits' : num(cell.count) + (cell.count === 1 ? ' visit' : ' visits')}`}
                          className={cn(
                            'size-2.5 rounded-[2px] border',
                            LEVEL_CLASS[level],
                            level === 0 ? 'border-border' : 'border-primary/30',
                          )}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>

              {/* legend */}
              <div className="mt-3 flex items-center gap-1.5 pl-8">
                <span className="text-micro text-muted-foreground">Less</span>
                {[0, 1, 2, 3, 4].map((level) => (
                  <span
                    key={level}
                    className={cn(
                      'size-2.5 rounded-[2px] border',
                      LEVEL_CLASS[level],
                      level === 0 ? 'border-border' : 'border-primary/30',
                    )}
                    aria-hidden
                  />
                ))}
                <span className="text-micro text-muted-foreground">More</span>
                <span className="ml-3 text-micro text-muted-foreground">
                  4+ visits in a day is the darkest step
                </span>
              </div>
            </div>
          </div>
        </CardBody>
        <CardFooter>
          <span>
            {num(total)} visits across {num(activeWeeks)} active weeks
          </span>
          <span>Longest streak {num(streak)} consecutive weeks</span>
        </CardFooter>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Rhythm" />
          <CardBody className="grid grid-cols-2 gap-4">
            <DataPoint label="Visits / week" value={member.metrics.avgVisitsPerWeek.toFixed(1)} sub="Trailing 30 days" />
            <DataPoint label="Best week" value={num(bestWeek)} sub="Peak in 52 weeks" />
            <DataPoint
              label="Per active week"
              value={avgPerActiveWeek.toFixed(1)}
              sub="Excludes zero weeks"
            />
            <DataPoint
              label="Gaps"
              value={num(52 - activeWeeks)}
              sub="Weeks with no visit"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Preferred days" description="Where this member's habit actually sits." />
          <CardBody className="flex flex-col gap-2">
            {WEEKDAY_LABELS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-micro text-muted-foreground">{label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-sm bg-muted">
                  <span
                    className="block h-full bg-primary"
                    style={{ width: `${(byWeekday[i] / maxWeekday) * 100}%` }}
                  />
                </span>
                <span className="w-6 shrink-0 text-right text-micro text-muted-foreground tnum">
                  {byWeekday[i]}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Preferred times" description="Drives which classes to suggest." />
          <CardBody className="flex flex-col gap-2.5">
            {byHourBucket.map((bucket) => (
              <div key={bucket.label} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm text-foreground">{bucket.label}</span>
                  <span className="shrink-0 text-micro text-muted-foreground tnum">
                    {bucket.count}
                  </span>
                </div>
                <span className="h-1.5 overflow-hidden rounded-sm bg-muted">
                  <span
                    className="block h-full bg-primary"
                    style={{ width: `${(bucket.count / maxBucket) * 100}%` }}
                  />
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent check-ins" description="Most recent 20 door events." />
        <ul className="divide-y divide-border">
          {visits.slice(0, 20).map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-medium text-foreground">{shortDate(v.timestamp)}</span>
                <span className="text-muted-foreground"> · {clock(v.timestamp)}</span>
              </span>
              <span className="shrink-0 text-micro capitalize text-muted-foreground">
                {v.location.replace('-', ' ')}
              </span>
            </li>
          ))}
        </ul>
        {visits.length > 20 ? (
          <CardFooter>
            <span>{num(visits.length - 20)} earlier check-ins not shown</span>
          </CardFooter>
        ) : null}
      </Card>
    </div>
  )
}
