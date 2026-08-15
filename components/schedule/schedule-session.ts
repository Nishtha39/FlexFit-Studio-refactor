'use client'

import * as React from 'react'
import type { ID } from '@/lib/types'
import { memberById } from '@/lib/data/members'
import { classMoves } from '@/lib/data/class-moves'
import { api } from '@/lib/api/client'
import { useDataVersion, useStudio } from '@/lib/store/studio-store'
import { NOW } from '@/lib/seed'
import type { ClassMove, Occurrence, RecurrenceScope } from './schedule-engine'
import { occurrenceKey, slotClock, slotDate } from './schedule-engine'

/**
 * Session state for the schedule.
 *
 * This used to layer every booking, cancellation, promotion and class move on
 * top of the immutable data engine in React state — so the 6am timetable was
 * correct until somebody refreshed, and nobody else ever saw a change at all.
 *
 * Now the writes go to the database and the screen reads the result back:
 *
 *  - **Bookings live on the class, not the occurrence.** `class_seats` is keyed
 *    by (class, member), which is the real model — a member holds a place in a
 *    recurring class, not in one week of it. The per-occurrence override map
 *    that used to sit here could express something the storage cannot, which is
 *    how the same member ended up on the roster for one week and not the next.
 *  - **Class moves are a stored list.** `schedule-engine.ts` already resolved a
 *    template date against a list of moves; that list now comes from
 *    `class_moves` instead of `useState`.
 *
 * The audit log stays local. It is a record of what *this staffer* has just
 * done, shown so a 6am change is visible rather than silent — the durable trail
 * is the `events` table the API writes on every mutation.
 */

export interface ChangeEntry {
  id: string
  at: Date
  text: string
  tone: 'good' | 'warn' | 'danger' | 'info' | 'neutral'
  undo?: () => void
}

export function useScheduleSession() {
  const { mutate, connection } = useStudio()
  const version = useDataVersion()
  const [log, setLog] = React.useState<ChangeEntry[]>([])
  const seq = React.useRef(0)

  /** Reschedules, straight off the live binding so a hydrate refreshes them. */
  const moves = React.useMemo<ClassMove[]>(() => classMoves, [version])

  const record = React.useCallback((entry: Omit<ChangeEntry, 'id' | 'at'>) => {
    seq.current += 1
    const id = `chg-${seq.current}`
    setLog((prev) => [{ ...entry, id, at: new Date(NOW.getTime() + seq.current * 1000) }, ...prev])
    return id
  }, [])

  const dropLog = React.useCallback((id: string) => {
    setLog((prev) => prev.filter((entry) => entry.id !== id))
  }, [])

  // The class carries its own roster and waitlist, rebuilt from class_seats on
  // every hydrate. Reading them straight through is what keeps this screen and
  // the member's own profile agreeing about whether they have a place.
  const rosterFor = React.useCallback((occ: Occurrence): ID[] => occ.gymClass.roster, [])
  const waitlistFor = React.useCallback((occ: Occurrence): ID[] => occ.gymClass.waitlist, [])

  const nameOf = (id: ID) => memberById.get(id)?.name ?? id

  /* ---------------------------------------------------------------------- */
  /* Bookings                                                               */
  /* ---------------------------------------------------------------------- */

  /**
   * Take a place.
   *
   * The server decides roster vs waitlist — `booking.book` seats to the roster
   * while there is room and to the waitlist after that. The caller does not get
   * to choose, so the two can never disagree about whether a class was full;
   * `asWaitlist` from the dialog is treated as the caller's expectation, and the
   * log reports what actually happened.
   */
  const book = React.useCallback(
    (occ: Occurrence, memberId: ID) => {
      if (connection !== 'live') return
      void mutate(() => api.booking.book.mutate({ classId: occ.classId, memberId }), {
        success: (r) => {
          record({
            tone: r.kind === 'roster' ? 'good' : 'info',
            text:
              r.kind === 'roster'
                ? `${nameOf(memberId)} booked into ${occ.gymClass.name} · ${slotDate(occ.start)} ${slotClock(occ.start)}`
                : `${nameOf(memberId)} waitlisted at position ${r.position + 1} for ${occ.gymClass.name} · ${slotDate(occ.start)}`,
          })
          return {
            title: r.kind === 'roster' ? `Booked into ${occ.gymClass.name}` : 'Added to the waitlist',
            detail: `${slotDate(occ.start)} at ${slotClock(occ.start)}.`,
          }
        },
      })
    },
    [connection, mutate, record],
  )

  /** Same call as `book` — the server routes to the waitlist when it is full. */
  const joinWaitlist = book

  /**
   * Give up a place. The server promotes the head of the waitlist and renumbers
   * the rest, so "3rd in line" stays true without this screen recomputing it.
   */
  const cancel = React.useCallback(
    (occ: Occurrence, memberId: ID, forfeited: boolean) => {
      if (connection !== 'live') return
      void mutate(() => api.booking.cancel.mutate({ classId: occ.classId, memberId }), {
        success: (r) => {
          const promoted = r.promoted as ID | null
          record({
            tone: forfeited ? 'danger' : 'neutral',
            text: promoted
              ? `${nameOf(memberId)} ${forfeited ? 'late cancelled' : 'cancelled'} ${occ.gymClass.name} · ${nameOf(promoted)} promoted from the waitlist`
              : `${nameOf(memberId)} ${forfeited ? 'late cancelled' : 'cancelled'} ${occ.gymClass.name} · ${slotDate(occ.start)}`,
          })
          return {
            title: forfeited
              ? 'Late cancel recorded · credit forfeited'
              : 'Booking cancelled · credit returned',
            detail: `${occ.gymClass.name} · ${slotDate(occ.start)}.`,
          }
        },
      })
    },
    [connection, mutate, record],
  )

  /**
   * Offer the open place to somebody specific rather than to the head of the
   * queue. Two writes in order: drop them from the waitlist, then re-seat them,
   * which the server will put on the roster because a place is free.
   */
  const promote = React.useCallback(
    (occ: Occurrence, memberId: ID) => {
      if (connection !== 'live') return
      void mutate(
        async () => {
          await api.booking.cancel.mutate({ classId: occ.classId, memberId })
          return api.booking.book.mutate({ classId: occ.classId, memberId })
        },
        {
          success: (r) => {
            record({
              tone: r.kind === 'roster' ? 'good' : 'warn',
              text:
                r.kind === 'roster'
                  ? `${nameOf(memberId)} promoted into ${occ.gymClass.name} · ${slotDate(occ.start)} ${slotClock(occ.start)}`
                  : `${nameOf(memberId)} could not be promoted — ${occ.gymClass.name} is still full`,
            })
            return r.kind === 'roster'
              ? { title: 'Promoted from the waitlist', detail: `${nameOf(memberId)} · ${occ.gymClass.name}` }
              : { title: 'Still full', detail: 'They kept their place in the queue.' }
          },
        },
      )
    },
    [connection, mutate, record],
  )

  const dropFromWaitlist = React.useCallback(
    (occ: Occurrence, memberId: ID) => {
      if (connection !== 'live') return
      void mutate(() => api.booking.cancel.mutate({ classId: occ.classId, memberId }), {
        success: () => {
          record({
            tone: 'neutral',
            text: `${nameOf(memberId)} removed from the ${occ.gymClass.name} waitlist`,
          })
          return { title: 'Removed from the waitlist', detail: nameOf(memberId) }
        },
      })
    },
    [connection, mutate, record],
  )

  /** Move a booking between classes in one step: cancel there, book here. */
  const moveBooking = React.useCallback(
    (from: Occurrence, to: Occurrence, memberId: ID, asWaitlist: boolean, forfeited: boolean) => {
      if (connection !== 'live') return
      void mutate(
        async () => {
          await api.booking.cancel.mutate({ classId: from.classId, memberId })
          return api.booking.book.mutate({ classId: to.classId, memberId })
        },
        {
          success: (r) => {
            record({
              tone: forfeited ? 'danger' : r.kind === 'waitlist' ? 'warn' : 'good',
              text: `${nameOf(memberId)} moved from ${from.gymClass.name} (${slotDate(from.start)}) to ${to.gymClass.name} (${slotDate(to.start)} ${slotClock(to.start)})${r.kind === 'waitlist' ? ` · waitlist position ${r.position + 1}` : ''}${forfeited ? ' · credit forfeited' : ''}`,
            })
            return {
              title: `Moved to ${to.gymClass.name}`,
              detail:
                r.kind === 'waitlist'
                  ? `Waitlisted at position ${r.position + 1} — the class was full.`
                  : `${slotDate(to.start)} at ${slotClock(to.start)}.`,
            }
          },
        },
      )
      void asWaitlist
    },
    [connection, mutate, record],
  )

  /* ---------------------------------------------------------------------- */
  /* Class moves                                                            */
  /* ---------------------------------------------------------------------- */

  const moveClass = React.useCallback(
    (occ: Occurrence, toIso: string, toStartTime: string, scope: RecurrenceScope, notified: number) => {
      if (connection !== 'live') return
      void mutate(
        () =>
          api.booking.moveClass.mutate({
            classId: occ.classId,
            scope,
            fromIso: occ.originalIsoDate,
            toIso,
            toStartTime,
          }),
        {
          success: (move) => {
            const scopeText =
              scope === 'one'
                ? 'this occurrence only'
                : scope === 'following'
                  ? 'this and all later weeks'
                  : 'every occurrence'
            const target = new Date(`${toIso}T${toStartTime}:00.000Z`)
            record({
              tone: scope === 'all' ? 'danger' : scope === 'following' ? 'warn' : 'info',
              text: `${occ.gymClass.name} moved to ${slotDate(target)} ${slotClock(target)} · ${scopeText} · ${notified} notified`,
              // Undo is a write too, now that the move is stored.
              undo: () => {
                void mutate(() => api.booking.cancelMove.mutate({ id: move.id }), {
                  success: () => ({ title: `${occ.gymClass.name} put back on its original slot` }),
                })
              },
            })
            return {
              title: `${occ.gymClass.name} moved to ${slotDate(target)} ${slotClock(target)}`,
              detail:
                notified === 0
                  ? 'Nobody was booked, so no notices went out.'
                  : `${notified} member${notified === 1 ? '' : 's'} notified.`,
            }
          },
        },
      )
    },
    [connection, mutate, record],
  )

  /** Put every reschedule back. Bookings are not touched — they are not moves. */
  const revertAll = React.useCallback(() => {
    if (connection !== 'live') return
    const current = [...classMoves]
    if (current.length === 0) {
      setLog([])
      return
    }
    void mutate(
      async () => {
        for (const m of current) await api.booking.cancelMove.mutate({ id: m.id })
        return current.length
      },
      {
        success: (n) => {
          setLog([])
          return { title: 'Timetable restored', detail: `${n} reschedule${n === 1 ? '' : 's'} reverted.` }
        },
      },
    )
  }, [connection, mutate])

  /** Occurrence keys carrying a reschedule — the grid marks these as changed. */
  const touched = React.useMemo(
    () => new Set(moves.map((m) => occurrenceKey(m.classId, m.fromIso))),
    [moves],
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
