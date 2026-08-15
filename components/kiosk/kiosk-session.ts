'use client'

import * as React from 'react'
import type { ID, LocationId, Member } from '@/lib/types'
import { members } from '@/lib/data/members'
import { checkIns } from '@/lib/data/attendance'
import { NOW } from '@/lib/seed'
import { api } from '@/lib/api/client'
import { useStudio } from '@/lib/store/studio-store'
import { decide, needsWaiver, type Decision, type Outcome, type ResolveKind } from './kiosk-engine'

/**
 * One completed kiosk event. The check-in console renders these as its live
 * feed, so the two screens in this batch agree on what happened at the door.
 */
export interface KioskEvent {
  id: string
  at: Date
  /** null for an anonymous guest drop-in. */
  memberId: ID | null
  name: string
  outcome: Outcome
  /** What the staffer actually did, in past tense, for the audit line. */
  action: string
  /** Set when money changed hands at the door. */
  amount: number | null
  /** True when a resolve action turned a red/amber into an admission. */
  resolved: boolean
}

/* -------------------------------------------------------------------------- */
/* Seeded recent history                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The console must not open on an empty feed — an empty gym at 2pm is a bug,
 * not a state. Seed the last ~14 real check-ins from the data engine and run
 * each through the same decision function the kiosk uses.
 */
function seedFeed(): KioskEvent[] {
  const todayIso = NOW.toISOString().slice(0, 10)
  const recent = checkIns.filter((ci) => ci.date === todayIso).slice(0, 14)
  const pool = recent.length >= 6 ? recent : checkIns.slice(0, 14)

  const out: KioskEvent[] = []
  for (const ci of pool) {
    const m = members.find((x) => x.id === ci.memberId)
    if (!m) continue
    const d = decide(m)
    out.push({
      id: `evt-seed-${ci.id}`,
      at: new Date(ci.timestamp),
      memberId: m.id,
      name: m.name,
      outcome: d.outcome,
      action:
        d.outcome === 'green'
          ? 'Admitted'
          : d.outcome === 'amber'
            ? `Admitted · ${d.headline.toLowerCase()}`
            : `Held at door · ${d.headline.toLowerCase()}`,
      amount: null,
      resolved: false,
    })
  }
  return out.sort((a, b) => b.at.getTime() - a.at.getTime())
}

/* -------------------------------------------------------------------------- */
/* Flow state                                                                 */
/* -------------------------------------------------------------------------- */

export type KioskStage =
  | { kind: 'idle' }
  | { kind: 'result'; member: Member; decision: Decision }
  | { kind: 'guest'; decision: Decision }

export interface WaiverRecord {
  memberId: ID
  signedAt: Date
}

const PAST_TENSE: Record<ResolveKind, string> = {
  'sign-waiver': 'Waiver signed at door',
  'take-payment': 'Payment taken at door',
  'sell-drop-in': 'Day pass sold at door',
  unfreeze: 'Membership unfrozen at door',
  renew: 'Membership restarted at door',
  override: 'Admitted by staff override',
  none: 'Admitted',
}

/**
 * The door.
 *
 * The feed, the waiver ledger and the credits spent this session are local —
 * they are a view of what happened at this terminal in the last few minutes,
 * and they are rebuilt from the database on load. What is NOT local any more is
 * the check-in itself: `admit` writes a real visit row, so the member's history,
 * their remaining credits, the churn score that reads them and the attendance
 * heatmap all move together. Before this, someone could be admitted all day and
 * their "days since last visit" would keep climbing.
 *
 * Every write is fire-and-forget from the door's point of view. The queue at
 * the desk cannot wait on a round trip, and the local feed is what the staffer
 * is looking at; a failed write surfaces through the store's own error toast
 * rather than by holding the turnstile.
 */
export function useKioskSession() {
  const { mutate, connection } = useStudio()
  const [stage, setStage] = React.useState<KioskStage>({ kind: 'idle' })
  const [feed, setFeed] = React.useState<KioskEvent[]>(() => seedFeed())
  const [waivers, setWaivers] = React.useState<WaiverRecord[]>([])
  /** Credits decremented during this session, keyed by member id. */
  const [spent, setSpent] = React.useState<Record<ID, number>>({})
  const [announcement, setAnnouncement] = React.useState('')
  const seq = React.useRef(0)

  const record = React.useCallback(
    (event: Omit<KioskEvent, 'id' | 'at'>) => {
      seq.current += 1
      setFeed((prev) => [
        { ...event, id: `evt-live-${seq.current}`, at: new Date(NOW.getTime() + seq.current * 1000) },
        ...prev,
      ])
    },
    [],
  )

  /** Local waiver ledger overrides the derived one once signed in this session. */
  const waiverSigned = React.useCallback(
    (id: ID) => waivers.some((w) => w.memberId === id),
    [waivers],
  )

  /** Credits remaining for a member, accounting for this session's decrements. */
  const creditsFor = React.useCallback(
    (m: Member) => {
      const base = m.metrics.creditsRemaining
      if (base === null) return null
      return Math.max(0, base - (spent[m.id] ?? 0))
    },
    [spent],
  )

  /**
   * Evaluate a member. Session state is layered over the pure decision so a
   * waiver signed thirty seconds ago does not block the same person again.
   */
  const evaluate = React.useCallback(
    (m: Member): Decision => {
      const base = decide(m)
      const remaining = creditsFor(m)

      if (base.code === 'waiver-missing' && waiverSigned(m.id)) {
        // Re-decide as if the waiver were on file.
        return {
          ...base,
          outcome: 'green',
          code: 'ok',
          headline: `Welcome back, ${m.firstName}`,
          detail: 'Waiver on file · signed today',
          script: '',
          resolve: 'none',
          resolveLabel: '',
          amountDue: null,
          creditsAfter: remaining === null ? null : remaining - 1,
          admitted: true,
        }
      }

      if (remaining !== null && remaining <= 0 && base.outcome !== 'red') {
        return {
          ...base,
          outcome: 'red',
          code: 'credits-exhausted',
          headline: 'No visits left this month',
          detail: `${m.firstName}, your allowance is fully used. A day pass covers today.`,
          script: base.script || `"You've used your visits for this month. A day pass is the quickest fix."`,
          resolve: 'sell-drop-in',
          resolveLabel: 'Sell day pass · ₹600',
          amountDue: 600,
          creditsAfter: 0,
          admitted: false,
        }
      }

      return { ...base, creditsAfter: remaining === null ? null : Math.max(0, remaining - 1) }
    },
    [creditsFor, waiverSigned],
  )

  const present = React.useCallback(
    (m: Member) => {
      const decision = evaluate(m)
      setStage({ kind: 'result', member: m, decision })
      setAnnouncement(
        `${decision.outcome === 'green' ? 'Approved' : decision.outcome === 'amber' ? 'Approved with a note' : 'Not admitted'}. ${decision.headline}. ${decision.detail}`,
      )
      return decision
    },
    [evaluate],
  )

  const presentGuest = React.useCallback((decision: Decision) => {
    setStage({ kind: 'guest', decision })
    setAnnouncement(`Guest check-in. ${decision.headline}. ${decision.detail}`)
  }, [])

  const reset = React.useCallback(() => {
    setStage({ kind: 'idle' })
    setAnnouncement('')
  }, [])

  /**
   * Write what happened at the door.
   *
   * ONE call, awaited in order, never several fired at once. The steps are not
   * independent: `ops.checkIn` refuses a membership that is not live, so an
   * unfreeze has to land *before* the visit or the visit is rejected by the
   * state the unfreeze was about to clear. Two parallel `mutate()` calls also
   * each trigger their own re-read, and the second can overwrite the first.
   *
   * A door override is deliberately NOT persisted as a visit. `ops.checkIn`
   * blocks a frozen or cancelled membership, and it is right to — letting the
   * kiosk write visits for cancelled members is how the attendance numbers stop
   * meaning anything. The override is still recorded on the feed, which is what
   * an override is: a note that a human decided, not a normal check-in.
   */
  const commit = React.useCallback(
    (m: Member, opts: { visit: boolean; payment?: { amount: number; description: string; againstPlan: boolean }; reactivate?: boolean }) => {
      if (connection !== 'live') return
      void mutate(
        async () => {
          if (opts.reactivate) {
            await api.ops.setMemberStatus.mutate({ memberId: m.id, status: 'active' })
          }
          if (opts.payment) {
            await api.ops.takePayment.mutate({
              memberId: m.id,
              amount: opts.payment.amount,
              method: 'card',
              description: opts.payment.description,
              planId: opts.payment.againstPlan ? m.planId : null,
            })
          }
          if (opts.visit) {
            await api.ops.checkIn.mutate({
              memberId: m.id,
              location: m.homeLocation as LocationId,
              classId: null,
            })
          }
          return true
        },
        {
          success: () => ({
            title: `${m.firstName} — saved`,
            detail: [
              opts.reactivate ? 'membership reactivated' : null,
              opts.payment ? `₹${opts.payment.amount} taken` : null,
              opts.visit ? 'visit recorded' : null,
            ]
              .filter(Boolean)
              .join(' · '),
          }),
        },
      )
    },
    [connection, mutate],
  )

  /** Commit an admission: decrement credits, log the event, return to idle. */
  const admit = React.useCallback(
    (m: Member, decision: Decision, note?: string) => {
      if (m.metrics.creditsRemaining !== null) {
        setSpent((prev) => ({ ...prev, [m.id]: (prev[m.id] ?? 0) + 1 }))
      }
      // `note` is set only on a staff override, where the membership itself is
      // what blocked them — see `commit`.
      commit(m, { visit: !note })
      record({
        memberId: m.id,
        name: m.name,
        outcome: decision.outcome,
        action: note ?? (decision.outcome === 'green' ? 'Admitted' : `Admitted · ${decision.headline.toLowerCase()}`),
        amount: null,
        resolved: Boolean(note),
      })
      reset()
    },
    [commit, record, reset],
  )

  /** Apply an in-place resolution, then admit. */
  const resolveAndAdmit = React.useCallback(
    (m: Member, decision: Decision) => {
      if (decision.resolve === 'sign-waiver') {
        setWaivers((prev) => [...prev, { memberId: m.id, signedAt: new Date(NOW) }])
      }
      const paid = decision.resolve === 'take-payment' || decision.resolve === 'sell-drop-in'
      const reactivate = decision.resolve === 'unfreeze' || decision.resolve === 'renew'

      commit(m, {
        // A day pass is a sale to somebody the membership rules would refuse, so
        // it buys entry without becoming a membership visit.
        visit: decision.resolve !== 'sell-drop-in',
        payment:
          paid && decision.amountDue
            ? {
                amount: decision.amountDue,
                description:
                  decision.resolve === 'sell-drop-in'
                    ? 'Day pass at the door'
                    : 'Membership dues taken at the door',
                againstPlan: decision.resolve !== 'sell-drop-in',
              }
            : undefined,
        reactivate,
      })

      // A day pass is bought access, so it does not eat a plan credit.
      if (!paid && m.metrics.creditsRemaining !== null) {
        setSpent((prev) => ({ ...prev, [m.id]: (prev[m.id] ?? 0) + 1 }))
      }
      record({
        memberId: m.id,
        name: m.name,
        outcome: decision.outcome === 'red' ? 'amber' : decision.outcome,
        action: PAST_TENSE[decision.resolve],
        amount: paid ? decision.amountDue : null,
        resolved: true,
      })
      reset()
    },
    [commit, record, reset],
  )

  /** Turn a held member away — recorded, because a refusal is an event too. */
  const turnAway = React.useCallback(
    (m: Member, decision: Decision) => {
      record({
        memberId: m.id,
        name: m.name,
        outcome: 'red',
        action: `Not admitted · ${decision.headline.toLowerCase()}`,
        amount: null,
        resolved: false,
      })
      reset()
    },
    [record, reset],
  )

  const admitGuest = React.useCallback(
    (name: string, amount: number | null) => {
      record({
        memberId: null,
        name: name.trim() || 'Guest',
        outcome: 'amber',
        action: amount ? 'Day pass sold at door' : 'Guest admitted on a member pass',
        amount,
        resolved: true,
      })
      reset()
    },
    [record, reset],
  )

  return {
    stage,
    feed,
    waivers,
    announcement,
    creditsFor,
    waiverSigned,
    evaluate,
    present,
    presentGuest,
    admit,
    resolveAndAdmit,
    turnAway,
    admitGuest,
    reset,
  }
}

/** Count of members still missing a waiver — shown on the console. */
export function unsignedWaiverCount(): number {
  return members.filter((m) => needsWaiver(m)).length
}

export { seedFeed }
