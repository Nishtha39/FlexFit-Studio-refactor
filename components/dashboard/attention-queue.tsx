'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  CreditCard,
  Dumbbell,
  Filter,
  HeartPulse,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardFooter } from '@/components/ui/card'
import { StatusChip, type Tone } from '@/components/ui/status-chip'
import { ConfirmDialog } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { api } from '@/lib/api/client'
import { useDataVersion, useStudio } from '@/lib/store/studio-store'
import { stateOf } from '@/lib/data/work-items'
import { compactMoney, num, pluralize } from '@/lib/format'
import {
  attentionItems,
  attentionValue,
  type AttentionItem,
  type AttentionKind,
  type AttentionResolution,
  type AttentionSeverity,
} from './dashboard-data'

/**
 * "Needs your attention". The dashboard opens with work, not with numbers:
 * a ranked queue where every row states the evidence, the money at stake and
 * the single action that clears it. Nothing here is a dead-end metric.
 */

const KIND_META: Record<AttentionKind, { label: string; icon: React.ElementType }> = {
  billing: { label: 'Billing', icon: CreditCard },
  retention: { label: 'Retention', icon: HeartPulse },
  capacity: { label: 'Capacity', icon: CalendarClock },
  corporate: { label: 'Corporate', icon: Building2 },
  lead: { label: 'Leads', icon: Filter },
  staffing: { label: 'Staffing', icon: Dumbbell },
}

const SEVERITY_META: Record<AttentionSeverity, { tone: Tone; label: string }> = {
  critical: { tone: 'danger', label: 'Act today' },
  warning: { tone: 'warn', label: 'This week' },
  info: { tone: 'info', label: 'Opportunity' },
}

interface PendingConfirm {
  item: AttentionItem
  resolution: AttentionResolution
}

/**
 * Resolution state lives above the queue because the page header reports the
 * same three numbers ("N to act on · ₹X/mo at stake"). Kept local to the queue,
 * clearing an item silently disagreed with the header directly above it.
 *
 * It is stored now rather than held in `useState`. The items themselves stay
 * derived — a failed payment is on this list because it failed — but "the owner
 * has dealt with this" is a fact about a person, not about the data, so it lives
 * in `work_items` and survives a reload. Previously the whole morning's work
 * reappeared on the queue the moment the page was refreshed.
 */
interface AttentionState {
  open: AttentionItem[]
  done: AttentionItem[]
  resolvedIds: string[]
  criticalCount: number
  valueAtStake: number
  markResolved: (item: AttentionItem, resolution: string) => void
  markUnresolved: (id: string) => void
  /** False when the API is unreachable — the buttons disable off this. */
  canWrite: boolean
}

const AttentionContext = React.createContext<AttentionState | null>(null)

export function AttentionProvider({ children }: { children: React.ReactNode }) {
  const { mutate, connection } = useStudio()
  const version = useDataVersion()

  const value = React.useMemo<AttentionState>(() => {
    const resolvedIds = attentionItems.filter((i) => stateOf(i.id).status === 'done').map((i) => i.id)
    const open = attentionItems.filter((i) => !resolvedIds.includes(i.id))
    return {
      open,
      done: attentionItems.filter((i) => resolvedIds.includes(i.id)),
      resolvedIds,
      criticalCount: open.filter((i) => i.severity === 'critical').length,
      valueAtStake: attentionValue(open),
      canWrite: connection === 'live',
      markResolved: (item, resolution) => {
        if (connection !== 'live') return
        void mutate(
          () =>
            api.queue.setState.mutate({
              id: item.id,
              queue: 'attention',
              status: 'done',
              resolution,
            }),
          {
            success: () => ({
              title: resolution,
              detail: `${item.title} cleared from the queue.`,
              action: {
                label: 'Undo',
                onClick: () => {
                  void mutate(
                    () =>
                      api.queue.setState.mutate({
                        id: item.id,
                        queue: 'attention',
                        status: 'open',
                      }),
                    { success: () => ({ title: 'Back on the queue', detail: item.title }) },
                  )
                },
              },
            }),
          },
        )
      },
      markUnresolved: (id) => {
        if (connection !== 'live') return
        void mutate(() => api.queue.setState.mutate({ id, queue: 'attention', status: 'open' }), {
          success: () => ({ title: 'Back on the queue' }),
        })
      },
    }
    // stateOf and attentionItems are module state that hydrate() rebuilds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, connection, mutate])

  return <AttentionContext.Provider value={value}>{children}</AttentionContext.Provider>
}

export function useAttention(): AttentionState {
  const ctx = React.useContext(AttentionContext)
  if (!ctx) throw new Error('useAttention must be used inside <AttentionProvider>')
  return ctx
}

export function AttentionQueue() {
  const { open, done, resolvedIds, criticalCount, valueAtStake, markResolved, canWrite } =
    useAttention()
  const [pending, setPending] = React.useState<PendingConfirm | null>(null)
  const [showResolved, setShowResolved] = React.useState(false)

  const visible = showResolved ? attentionItems : open
  const critical = criticalCount

  // The toast comes from `mutate` now, so the success message can only appear
  // once the row is actually stored — and its Undo is a write of its own.
  const resolve = React.useCallback(
    (item: AttentionItem, resolution: AttentionResolution) => {
      markResolved(item, resolution.result)
    },
    [markResolved],
  )

  const act = (item: AttentionItem, resolution: AttentionResolution) => {
    if (resolution.consequence) setPending({ item, resolution })
    else resolve(item, resolution)
  }

  return (
    <Card>
      <CardHeader
        title="Needs your attention"
        description={
          open.length > 0
            ? `${pluralize(open.length, 'item')} · ${critical} to act on today · ${compactMoney(
                valueAtStake,
              )}/mo at stake`
            : 'Queue clear. Ranked by severity, money at stake, and how long it has been waiting.'
        }
        actions={
          done.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowResolved((s) => !s)}
              aria-pressed={showResolved}
            >
              {showResolved ? 'Hide' : 'Show'} {num(done.length)} resolved
            </Button>
          ) : null
        }
      />

      {visible.length === 0 ? (
        <EmptyState
          title="Nothing needs you right now"
          description="No failed payments, no pools running dry, no leads going cold. The queue refills itself as the data changes — it is not a to-do list you maintain."
        />
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((item, index) => (
            <AttentionRow
              key={item.id}
              item={item}
              rank={index + 1}
              resolved={resolvedIds.includes(item.id)}
              onAct={act}
              disabled={!canWrite}
            />
          ))}
        </ul>
      )}

      <CardFooter>
        <span>Ranked by severity × value × age. The same rules drive the bell menu.</span>
        <Link
          href="/reports"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          How ranking works
        </Link>
      </CardFooter>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending) resolve(pending.item, pending.resolution)
        }}
        title={pending?.resolution.label ?? ''}
        description={pending?.item.title}
        consequence={pending?.resolution.consequence}
        consequenceTone="warn"
        confirmLabel={pending?.resolution.label ?? 'Confirm'}
        destructive={false}
      />
    </Card>
  )
}

function AttentionRow({
  item,
  rank,
  resolved,
  onAct,
  disabled,
}: {
  item: AttentionItem
  rank: number
  resolved: boolean
  onAct: (item: AttentionItem, resolution: AttentionResolution) => void
  disabled: boolean
}) {
  const kind = KIND_META[item.kind]
  const severity = SEVERITY_META[item.severity]
  const Icon = kind.icon

  return (
    <li className={cn('px-4 py-3 transition-colors duration-150', resolved && 'bg-subtle')}>
      <div className="flex gap-3">
        <span
          aria-hidden
          className={cn(
            'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm border',
            resolved
              ? 'border-good-border bg-good-soft text-good'
              : 'border-border bg-muted text-muted-foreground',
          )}
        >
          {resolved ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-micro font-medium text-muted-foreground tnum">
              {String(rank).padStart(2, '0')}
            </span>
            <h3
              className={cn(
                'text-sm font-semibold text-foreground text-pretty',
                resolved && 'text-muted-foreground line-through',
              )}
            >
              {item.title}
            </h3>
            {resolved ? (
              <StatusChip tone="good" label="Resolved" />
            ) : (
              <StatusChip tone={severity.tone} label={severity.label} />
            )}
            <StatusChip tone="neutral" label={kind.label} />
          </div>

          <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
            {item.detail}
          </p>

          <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-micro text-muted-foreground">
            {item.evidence.map((line) => (
              <div key={line} className="flex items-center gap-1.5">
                <span aria-hidden className="size-1 rounded-full bg-border-strong" />
                <dd className="tnum">{line}</dd>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span aria-hidden className="size-1 rounded-full bg-border-strong" />
              <dd className="tnum">waiting {item.ageDays}d</dd>
            </div>
          </dl>

          {!resolved ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                disabled={disabled}
                onClick={() => onAct(item, item.primary)}
              >
                {item.primary.label}
              </Button>
              {item.secondary ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={disabled}
                  onClick={() => item.secondary && onAct(item, item.secondary)}
                >
                  {item.secondary.label}
                </Button>
              ) : null}
              <Link
                href={item.href}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                {item.hrefLabel}
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </div>
          ) : null}
        </div>

        <div className="hidden shrink-0 flex-col items-end gap-0.5 sm:flex">
          <span className="text-base font-semibold text-foreground tnum">
            {item.valuePerMonth > 0 ? compactMoney(item.valuePerMonth) : '—'}
          </span>
          <span className="text-micro text-muted-foreground">
            {item.valuePerMonth > 0 ? 'per month' : 'no direct value'}
          </span>
        </div>
      </div>
    </li>
  )
}
