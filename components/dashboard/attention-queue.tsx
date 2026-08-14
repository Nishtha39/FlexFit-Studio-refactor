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
import { useToast } from '@/components/ui/toast'
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
 */
interface AttentionState {
  open: AttentionItem[]
  done: AttentionItem[]
  resolvedIds: string[]
  criticalCount: number
  valueAtStake: number
  markResolved: (id: string) => void
  markUnresolved: (id: string) => void
}

const AttentionContext = React.createContext<AttentionState | null>(null)

export function AttentionProvider({ children }: { children: React.ReactNode }) {
  const [resolvedIds, setResolvedIds] = React.useState<string[]>([])

  const value = React.useMemo<AttentionState>(() => {
    const open = attentionItems.filter((i) => !resolvedIds.includes(i.id))
    return {
      open,
      done: attentionItems.filter((i) => resolvedIds.includes(i.id)),
      resolvedIds,
      criticalCount: open.filter((i) => i.severity === 'critical').length,
      valueAtStake: attentionValue(open),
      markResolved: (id) => setResolvedIds((prev) => (prev.includes(id) ? prev : [...prev, id])),
      markUnresolved: (id) => setResolvedIds((prev) => prev.filter((x) => x !== id)),
    }
  }, [resolvedIds])

  return <AttentionContext.Provider value={value}>{children}</AttentionContext.Provider>
}

export function useAttention(): AttentionState {
  const ctx = React.useContext(AttentionContext)
  if (!ctx) throw new Error('useAttention must be used inside <AttentionProvider>')
  return ctx
}

export function AttentionQueue() {
  const { toast } = useToast()
  const { open, done, resolvedIds, criticalCount, valueAtStake, markResolved, markUnresolved } =
    useAttention()
  const [pending, setPending] = React.useState<PendingConfirm | null>(null)
  const [showResolved, setShowResolved] = React.useState(false)

  const visible = showResolved ? attentionItems : open
  const critical = criticalCount

  const resolve = React.useCallback(
    (item: AttentionItem, resolution: AttentionResolution) => {
      markResolved(item.id)
      toast({
        tone: 'good',
        title: resolution.result,
        detail: `${item.title} cleared from the queue.`,
        action: {
          label: 'Undo',
          onClick: () => markUnresolved(item.id),
        },
      })
    },
    [toast, markResolved, markUnresolved],
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
}: {
  item: AttentionItem
  rank: number
  resolved: boolean
  onAct: (item: AttentionItem, resolution: AttentionResolution) => void
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
              <Button variant="primary" size="sm" onClick={() => onAct(item, item.primary)}>
                {item.primary.label}
              </Button>
              {item.secondary ? (
                <Button
                  variant="secondary"
                  size="sm"
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
