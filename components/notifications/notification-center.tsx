'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Megaphone, Check, Bell } from 'lucide-react'
import { PageHeader, PageBody } from '@/components/shell/page-header'
import { RequireScreen } from '@/components/shell/app-shell'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FilterBar, FilterTrigger } from '@/components/ui/filter-chip'
import { StatusChip, type Tone } from '@/components/ui/status-chip'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { notifications as seedNotifications } from '@/lib/data/notifications'
import { clock, daysAgo, shortDate } from '@/lib/format'
import type { AppNotification, NotificationKind, NotificationSeverity } from '@/lib/types'
import { useListTraversal, TraversalHint } from '@/components/command/use-list-traversal'
import { BroadcastComposer } from './broadcast-composer'

const SEVERITY_TONE: Record<NotificationSeverity, Tone> = {
  info: 'info',
  success: 'good',
  warning: 'warn',
  critical: 'danger',
}

const KIND_LABELS: Record<NotificationKind, string> = {
  payment: 'Payments',
  retention: 'Retention',
  class: 'Classes',
  corporate: 'Corporate',
  lead: 'Leads',
  system: 'System',
}

function hrefFor(entity: AppNotification['entity']): string | null {
  if (!entity) return null
  if (entity.type === 'member') return `/members/${entity.id}`
  if (entity.type === 'company') return `/corporate/${entity.id}`
  if (entity.type === 'class') return '/schedule'
  if (entity.type === 'payment') return '/payments'
  if (entity.type === 'lead') return '/leads'
  return null
}

/**
 * Notification centre. Every row answers "what happened, to whom, and where do
 * I go" — a notification that can't be acted on doesn't belong in the list.
 */
export function NotificationCenter() {
  const { toast } = useToast()
  const router = useRouter()
  const [rows, setRows] = React.useState<AppNotification[]>(seedNotifications)
  const [kind, setKind] = React.useState<'all' | NotificationKind>('all')
  const [unreadOnly, setUnreadOnly] = React.useState(false)
  const [composeOpen, setComposeOpen] = React.useState(false)

  // The ⌘K palette links here with ?compose=1.
  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get('compose') === '1') setComposeOpen(true)
  }, [])

  const visible = rows.filter(
    (n) => (kind === 'all' || n.kind === kind) && (!unreadOnly || !n.read),
  )
  const unread = rows.filter((n) => !n.read).length

  const open = React.useCallback(
    (n: AppNotification) => {
      setRows((prev) => prev.map((r) => (r.id === n.id ? { ...r, read: true } : r)))
      const href = hrefFor(n.entity)
      if (href) router.push(href)
    },
    [router],
  )

  const { rowProps } = useListTraversal({ items: visible, onOpen: open, enabled: !composeOpen })

  return (
    <RequireScreen screen="notifications">
      <PageHeader
        title="Notifications"
        crumbs={[{ label: 'FlexFit Studio', href: '/dashboard' }, { label: 'Notifications' }]}
        meta={
          <>
            <span className="tnum">{unread} unread</span>
            <span aria-hidden>·</span>
            <TraversalHint />
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              disabled={unread === 0}
              onClick={() => {
                setRows((prev) => prev.map((r) => ({ ...r, read: true })))
                toast({ tone: 'neutral', title: 'All caught up', detail: `${unread} notifications marked read.` })
              }}
            >
              <Check />
              Mark all read
            </Button>
            <Button variant="primary" size="sm" onClick={() => setComposeOpen(true)}>
              <Megaphone />
              New broadcast
            </Button>
          </>
        }
        sticky={false}
      />

      <PageBody>
        <Card className="overflow-hidden">
          <FilterBar resultCount={visible.length} totalCount={rows.length}>
            <FilterTrigger label="All" active={kind === 'all'} onClick={() => setKind('all')} />
            {(Object.keys(KIND_LABELS) as NotificationKind[]).map((k) => (
              <FilterTrigger key={k} label={KIND_LABELS[k]} active={kind === k} onClick={() => setKind(kind === k ? 'all' : k)} />
            ))}
            <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
            <FilterTrigger label="Unread only" active={unreadOnly} onClick={() => setUnreadOnly((v) => !v)} />
          </FilterBar>

          {visible.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Bell}
                title={unreadOnly ? 'Nothing unread' : 'No notifications of this kind'}
                description="Notifications are generated from real events — failed payments, risk moves, pools running low."
                action={{ label: 'Show everything', onClick: () => { setKind('all'); setUnreadOnly(false) } }}
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((n, i) => {
                const href = hrefFor(n.entity)
                return (
                  <li
                    key={n.id}
                    {...rowProps(i)}
                    className={cn(
                      'group/row flex gap-3 px-4 py-3 transition-colors duration-150',
                      'data-[focused]:ring-1 data-[focused]:ring-inset data-[focused]:ring-primary',
                      n.read ? 'bg-surface' : 'bg-subtle',
                    )}
                  >
                    <span className="mt-1 shrink-0">
                      {n.read ? (
                        <span aria-hidden className="block size-2 rounded-full border border-border-strong" />
                      ) : (
                        <span aria-label="Unread" className="block size-2 rounded-full bg-primary" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{n.title}</p>
                        <StatusChip tone={SEVERITY_TONE[n.severity]} label={KIND_LABELS[n.kind]} />
                      </div>
                      <p className="mt-0.5 max-w-prose text-sm leading-relaxed text-muted-foreground">{n.body}</p>
                      <p className="mt-1 text-micro text-muted-foreground tnum">
                        {shortDate(n.timestamp)} · {clock(n.timestamp)} · {daysAgo(n.timestamp)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {href ? (
                        <Link
                          href={href}
                          onClick={() => setRows((prev) => prev.map((r) => (r.id === n.id ? { ...r, read: true } : r)))}
                          className="text-micro font-medium text-primary underline-offset-2 hover:underline"
                        >
                          Open
                        </Link>
                      ) : null}
                      {!n.read ? (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setRows((prev) => prev.map((r) => (r.id === n.id ? { ...r, read: true } : r)))}
                        >
                          Mark read
                        </Button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </PageBody>

      <BroadcastComposer open={composeOpen} onClose={() => setComposeOpen(false)} />
    </RequireScreen>
  )
}
