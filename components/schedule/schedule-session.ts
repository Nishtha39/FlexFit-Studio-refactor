'use client'

import * as React from 'react'
import type { ID } from '@/lib/types'
import { memberById } from '@/lib/data/members'
import { NOW } from '@/lib/seed'
import type { ClassMove, Occurrence, RecurrenceScope } from './schedule-engine'
import { occurrenceKey, slotClock, slotDate } from './schedule-engine'

/**
 * Session state for the schedule. The data engine is immutable, so every
 * booking, cancellation, promotion and class move made on screen is layered on
 * top of it, keyed by occurrence.
 *
 * Each change also writes an audit line. A schedule that silently accepts a
 * drag is a schedule nobody trusts at 6am — the staffer needs to see that the
 * move happened, who it touched, and how to put it back.
 */

export interface ChangeEntry {
  id: string
  at: Date
  text: string
  tone: 'good' | 'warn' | 'danger' | 'info' | 'neutral'
  undo?: () => void
}

interface Overrides {
  roster: Record<string, ID[]>
  waitlist: Record<string, ID[]>
}

export function useScheduleSession() {
  const [moves, setMoves] = React.useState<ClassMove[]>([])
  const [overrides, setOverrides] = React.useState<Overrides>({ roster: {}, waitlist: {} })
  const [log, setLog] = React.useState<ChangeEntry[]>([])
  const seq = React.useRef(0)

  const record = React.useCallback((entry: Omit<ChangeEntry, 'id' | 'at'>) => {
    seq.current += 1
    const id = `chg-${seq.current}`
    setLog((prev) => [
      { ...entry, id, at: new Date(NOW.getTime() + seq.current * 1000) },
      ...prev,
    ])
    return id
  }, [])

  const dropLog = React.useCallback((id: string) => {
    setLog((prev) => prev.filter((entry) => entry.id !== id))
  }, [])

  const rosterFor = React.useCallback(
    (occ: Occurrence): ID[] => overrides.roster[occ.key] ?? occ.gymClass.roster,
    [overrides.roster],
  )

  const waitlistFor = React.useCallback(
    (occ: Occurrence): ID[] => overrides.waitlist[occ.key] ?? occ.gymClass.waitlist,
    [overrides.waitlist],
  )

  const setLists = React.useCallback(
    (key: string, roster: ID[], waitlist: ID[]) => {
      setOverrides((prev) => ({
        roster: { ...prev.roster, [key]: roster },
        waitlist: { ...prev.waitlist, [key]: waitlist },
      }))
    },
    [],
  )

  const nameOf = (id: ID) => memberById.get(id)?.name ?? id

  /* ---------------------------------------------------------------------- */
  /* Bookings                                                               */
  /* ---------------------------------------------------------------------- */

  const book = React.useCallback(
    (occ: Occurrence, memberId: ID) => {
      const roster = rosterFor(occ)
      const waitlist = waitlistFor(occ).filter((id) => id !== memberId)
      if (roster.includes(memberId)) return
      setLists(occ.key, [...roster, memberId], waitlist)
      record({
        tone: 'good',
        text: `${nameOf(memberId)} booked into ${occ.gymClass.name} · ${slotDate(occ.start)} ${slotClock(occ.start)}`,
      })
    },
    [record, rosterFor, setLists, waitlistFor],
  )

  const joinWaitlist = React.useCallback(
    (occ: Occurrence, memberId: ID) => {
      const waitlist = waitlistFor(occ)
      if (waitlist.includes(memberId)) return
      setLists(occ.key, rosterFor(occ), [...waitlist, memberId])
      record({
        tone: 'info',
        text: `${nameOf(memberId)} waitlisted at position ${waitlist.length + 1} for ${occ.gymClass.name} · ${slotDate(occ.start)}`,
      })
    },
    [record, rosterFor, setLists, waitlistFor],
  )

  /** Cancel a confirmed spot and promote position 1, if anyone is waiting. */
  const cancel = React.useCallback(
    (occ: Occurrence, memberId: ID, forfeited: boolean) => {
      const roster = rosterFor(occ)
      const waitlist = waitlistFor(occ)
      const promoted = waitlist[0] ?? null
      const nextRoster = roster.filter((id) => id !== memberId)
      const nextWaitlist = promoted ? waitlist.slice(1) : waitlist
      if (promoted) nextRoster.push(promoted)

      setLists(occ.key, nextRoster, nextWaitlist)
      record({
        tone: forfeited ? 'danger' : 'neutral',
        text: promoted
          ? `${nameOf(memberId)} ${forfeited ? 'late cancelled' : 'cancelled'} ${occ.gymClass.name} · ${nameOf(promoted)} promoted from the waitlist`
          : `${nameOf(memberId)} ${forfeited ? 'late cancelled' : 'cancelled'} ${occ.gymClass.name} · ${slotDate(occ.start)}`,
        undo: forfeited
          ? undefined
          : () => setLists(occ.key, roster, waitlist),
      })
    },
    [record, rosterFor, setLists, waitlistFor],
  )

  /** Manually offer the open spot to someone on the list. */
  const promote = React.useCallback(
    (occ: Occurrence, memberId: ID) => {
      const roster = rosterFor(occ)
      const waitlist = waitlistFor(occ)
      setLists(occ.key, [...roster, memberId], waitlist.filter((id) => id !== memberId))
      record({
        tone: 'good',
        text: `${nameOf(memberId)} promoted into ${occ.gymClass.name} · ${slotDate(occ.start)} ${slotClock(occ.start)}`,
        undo: () => setLists(occ.key, roster, waitlist),
      })
    },
    [record, rosterFor, setLists, waitlistFor],
  )

  const dropFromWaitlist = React.useCallback(
    (occ: Occurrence, memberId: ID) => {
      const waitlist = waitlistFor(occ)
      setLists(occ.key, rosterFor(occ), waitlist.filter((id) => id !== memberId))
      record({
        tone: 'neutral',
        text: `${nameOf(memberId)} removed from the ${occ.gymClass.name} waitlist`,
        undo: () => setLists(occ.key, rosterFor(occ), waitlist),
      })
    },
    [record, rosterFor, setLists, waitlistFor],
  )

  /** Move a booking between occurrences in one step. */
  const moveBooking = React.useCallback(
    (from: Occurrence, to: Occurrence, memberId: ID, asWaitlist: boolean, forfeited: boolean) => {
      const fromRoster = rosterFor(from)
      const fromWaitlist = waitlistFor(from)
      const promoted = fromWaitlist[0] ?? null
      const nextFromRoster = fromRoster.filter((id) => id !== memberId)
      if (promoted) nextFromRoster.push(promoted)

      const toRoster = rosterFor(to)
      const toWaitlist = waitlistFor(to)

      setOverrides((prev) => ({
        roster: {
          ...prev.roster,
          [from.key]: nextFromRoster,
          [to.key]: asWaitlist ? toRoster : [...toRoster, memberId],
        },
        waitlist: {
          ...prev.waitlist,
          [from.key]: promoted ? fromWaitlist.slice(1) : fromWaitlist,
          [to.key]: asWaitlist ? [...toWaitlist, memberId] : toWaitlist,
        },
      }))

      record({
        tone: forfeited ? 'danger' : asWaitlist ? 'warn' : 'good',
        text: `${nameOf(memberId)} moved from ${from.gymClass.name} (${slotDate(from.start)}) to ${to.gymClass.name} (${slotDate(to.start)} ${slotClock(to.start)})${asWaitlist ? ` · waitlist position ${toWaitlist.length + 1}` : ''}${forfeited ? ' · credit forfeited' : ''}`,
      })
    },
    [record, rosterFor, setOverrides, waitlistFor],
  )

  /* ---------------------------------------------------------------------- */
  /* Class moves                                                            */
  /* ---------------------------------------------------------------------- */

  const moveClass = React.useCallback(
    (
      occ: Occurrence,
      toIso: string,
      toStartTime: string,
      scope: RecurrenceScope,
      notified: number,
    ) => {
      const move: ClassMove = {
        id: `mv-${occ.key}-${toIso}-${toStartTime}-${scope}`,
        classId: occ.classId,
        scope,
        fromIso: occ.originalIsoDate,
        toIso,
        toStartTime,
      }
      setMoves((prev) => [...prev, move])
      const scopeText =
        scope === 'one'
          ? 'this occurrence only'
          : scope === 'following'
            ? 'this and all later weeks'
            : 'every occurrence'
      record({
        tone: scope === 'all' ? 'danger' : scope === 'following' ? 'warn' : 'info',
        text: `${occ.gymClass.name} moved to ${slotDate(new Date(`${toIso}T${toStartTime}:00.000Z`))} ${slotClock(new Date(`${toIso}T${toStartTime}:00.000Z`))} · ${scopeText} · ${notified} notified`,
        undo: () => setMoves((prev) => prev.filter((m) => m.id !== move.id)),
      })
    },
    [record],
  )

  const revertAll = React.useCallback(() => {
    setMoves([])
    setOverrides({ roster: {}, waitlist: {} })
    setLog([])
  }, [])

  const touched = React.useMemo(
    () => new Set(Object.keys(overrides.roster).concat(Object.keys(overrides.waitlist))),
    [overrides],
  )

  return {
    moves,
    log,
    touched,
    rosterFor,
    waitlistFor,
    book,
    joinWaitlist,
    cancel,
    promote,
    dropFromWaitlist,
    moveBooking,
    moveClass,
    revertAll,
    dropLog,
  }
}

export type ScheduleSession = ReturnType<typeof useScheduleSession>

export { occurrenceKey }
