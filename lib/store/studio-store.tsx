'use client'

/**
 * The live data store.
 *
 * Before this existed, the buttons in this app popped a toast and changed
 * nothing: the screens rendered constants baked in at build time, and the tRPC
 * API — which had been deployed and tested — had no consumer. This is the piece
 * that connects them.
 *
 * Three responsibilities, and no more:
 *
 *  1. On mount, fetch `read.bootstrap` and hand it to `hydrate()`, which swaps
 *     the seed arrays for the database's copy and recomputes every derivation.
 *  2. Expose `mutate()`, which runs an API call, re-reads the dataset, and
 *     bumps a version so React re-renders the screens that depend on it.
 *  3. Say honestly whether it is connected. If the API is unreachable — a plain
 *     `next dev` with no Worker, or the export served as flat files — the app
 *     still works off the seed, but every write button says it cannot save
 *     rather than showing a green toast over a change that did not happen.
 *
 * Re-reading the whole dataset after each mutation is deliberate rather than
 * lazy. The alternative, patching one entity locally, is how the totals on one
 * screen start disagreeing with the rows on another: freezing a member has to
 * move their status, the MRR, the churn rate, the risk pool and their trainer's
 * client count together. Mutations are user-initiated and rare; a re-read costs
 * one request and makes disagreement impossible by construction.
 */

import * as React from 'react'
import { api, setActor } from '@/lib/api/client'
import { hydrate, type StudioSnapshot } from '@/lib/data/hydrate'
import { useToast } from '@/components/ui/toast'

export type ConnectionState = 'connecting' | 'live' | 'offline'

interface StudioValue {
  connection: ConnectionState
  /** Increments on every hydrate. Read it to make a component re-render. */
  version: number
  /** Why the API is unreachable, when it is. */
  error: string | null
  refresh: () => Promise<void>
  /**
   * Run a write. Returns the procedure's result, or null if it failed — the
   * caller does not need a try/catch, and a refusal from the server is shown
   * with the server's own message rather than a generic one.
   */
  mutate: <T>(
    fn: () => Promise<T>,
    opts?: {
      pending?: string
      /**
       * An `action` here becomes the toast's inline Undo — which must itself be
       * a write, since the change it is undoing is now stored.
       *
       * Omit `success` entirely for a write nobody asked for as an action —
       * marking a notification read is a side effect of looking at it, and a
       * toast for each one is noise. Failures are still reported either way.
       */
      success?: (result: T) => { title: string; detail?: string; action?: { label: string; onClick: () => void } }
    },
  ) => Promise<T | null>
  /** True while a write is in flight — buttons disable off this. */
  busy: boolean
}

const StudioContext = React.createContext<StudioValue | null>(null)

export function useStudio(): StudioValue {
  const ctx = React.useContext(StudioContext)
  if (!ctx) throw new Error('useStudio must be used inside <StudioProvider>')
  return ctx
}

/**
 * Bootstrap returns entities in the shape lib/types.ts describes; `hydrate`
 * wants them under the names the data modules use. This is the only place that
 * mapping lives.
 */
function toSnapshot(b: Awaited<ReturnType<typeof api.read.bootstrap.query>>): StudioSnapshot {
  return {
    locations: b.locations,
    members: b.members,
    staff: b.staff,
    plans: b.plans,
    companies: b.companies,
    classes: b.classes,
    payments: b.payments,
    leads: b.leads,
    notifications: b.notifications,
    dailyAttendance: b.dailyAttendance,
    equipment: b.equipment,
    equipmentFaults: b.equipmentFaults,
    equipmentServices: b.equipmentServices,
    equipmentReservations: b.equipmentReservations,
    memberNotes: b.memberNotes,
    workItems: b.workItems,
    classMoves: b.classMoves,
  }
}

export function StudioProvider({
  children,
  actor = 'system',
}: {
  children: React.ReactNode
  actor?: string
}) {
  const { toast } = useToast()
  const [connection, setConnection] = React.useState<ConnectionState>('connecting')
  const [version, setVersion] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    setActor(actor)
  }, [actor])

  const refresh = React.useCallback(async () => {
    try {
      const bootstrap = await api.read.bootstrap.query()
      hydrate(toSnapshot(bootstrap))
      setConnection('live')
      setError(null)
      setVersion((v) => v + 1)
    } catch (e) {
      // Falling back to the seed is not a failure state for reading — the two
      // are the same data — so the screens stay usable. It IS a failure state
      // for writing, which is what `connection` tells the buttons.
      setConnection('offline')
      setError(e instanceof Error ? e.message : 'The API did not respond.')
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const mutate = React.useCallback<StudioValue['mutate']>(
    async (fn, opts) => {
      if (connection === 'offline') {
        toast({
          tone: 'danger',
          title: 'Not saved — no connection to the server',
          detail: 'This build cannot reach /api/trpc, so nothing was written. Run `pnpm preview` or use the deployed site.',
        })
        return null
      }
      setBusy(true)
      try {
        const result = await fn()
        // Re-read before the toast: the toast claims the change happened, so
        // the screen behind it should already be showing it.
        await refresh()
        if (opts?.success) {
          const { title, detail, action } = opts.success(result)
          toast({ tone: 'good', title, detail, action })
        }
        return result
      } catch (e) {
        // tRPC refusals carry a real reason ("This payment has already been
        // refunded"). Showing it beats a generic failure message.
        const message = e instanceof Error ? e.message : 'The server refused the change.'
        toast({ tone: 'danger', title: 'Not saved', detail: message })
        return null
      } finally {
        setBusy(false)
      }
    },
    [connection, refresh, toast],
  )

  const value = React.useMemo<StudioValue>(
    () => ({ connection, version, error, refresh, mutate, busy }),
    [connection, version, error, refresh, mutate, busy],
  )

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
}

/**
 * Subscribe a component to the dataset without caring what changed.
 *
 * The data modules are mutated in place, so React has no way to know a value it
 * read is now stale. Reading `version` here puts the component in the render
 * path of every hydration, which is what makes a list rebuilt by `rebuild()`
 * actually appear.
 */
export function useDataVersion(): number {
  return useStudio().version
}
