'use client'

import * as React from 'react'
import type { ID, Member } from '@/lib/types'
import { members } from '@/lib/data/members'
import { checkIns } from '@/lib/data/attendance'
import { NOW } from '@/lib/seed'
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

export function useKioskSession() {
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

  /** Commit an admission: decrement credits, log the event, return to idle. */
  const admit = React.useCallback(
    (m: Member, decision: Decision, note?: string) => {
      if (m.metrics.creditsRemaining !== null) {
        setSpent((prev) => ({ ...prev, [m.id]: (prev[m.id] ?? 0) + 1 }))
      }
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
    [record, reset],
  )

  /** Apply an in-place resolution, then admit. */
  const resolveAndAdmit = React.useCallback(
    (m: Member, decision: Decision) => {
      if (decision.resolve === 'sign-waiver') {
        setWaivers((prev) => [...prev, { memberId: m.id, signedAt: new Date(NOW) }])
      }
      const paid = decision.resolve === 'take-payment' || decision.resolve === 'sell-drop-in'
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
    [record, reset],
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
