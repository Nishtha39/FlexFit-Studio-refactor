'use client'

import * as React from 'react'
import { Mail, Phone, MessageSquare, Snowflake, CreditCard, Play, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shell/page-header'
import { Button } from '@/components/ui/button'
import { MemberStatus, RiskScore, StatusChip } from '@/components/ui/status-chip'
import { Tag } from '@/components/ui/filter-chip'
import type { Member } from '@/lib/types'
import { compactMoney, daysAgo, fullDate, money } from '@/lib/format'
import { NOW } from '@/lib/seed'
import { toMemberView } from '../member-view'
import { MemberStatusDialog, MessageMemberDialog, TakePaymentDialog } from './member-actions'
import { useStudio } from '@/lib/store/studio-store'

/**
 * Profile header. Identity, the operational facts a staff member needs before
 * speaking to this person, and the actions they can take — all above the fold.
 */
export function ProfileHeader({ member }: { member: Member }) {
  const { busy } = useStudio()
  const [dialog, setDialog] = React.useState<'message' | 'payment' | null>(null)
  const [statusTarget, setStatusTarget] = React.useState<Member['status'] | null>(null)
  const view = toMemberView(member)
  const m = member.metrics
  const frozen = member.status === 'frozen'
  const ended = member.status === 'cancelled' || member.status === 'expired'

  const stale = m.daysSinceLastVisit !== null && m.daysSinceLastVisit >= 14

  return (
    <>
      <PageHeader
        sticky={false}
        crumbs={[
          { label: 'FlexFit Studio', href: '/dashboard' },
          { label: 'Members', href: '/members' },
          { label: member.name },
        ]}
        title={
          <span className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground"
            >
              {member.initials}
            </span>
            {member.name}
          </span>
        }
        meta={
          <>
            <span className="font-mono text-micro">{member.id}</span>
            <span aria-hidden>·</span>
            <a
              href={`mailto:${member.email}`}
              className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            >
              <Mail aria-hidden className="size-3" />
              {member.email}
            </a>
            <span aria-hidden>·</span>
            <a
              href={`tel:${member.phone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-1 transition-colors hover:text-foreground tnum"
            >
              <Phone aria-hidden className="size-3" />
              {member.phone}
            </a>
            <span aria-hidden>·</span>
            <span>
              Joined {fullDate(member.joinedDate)} ·{' '}
              <span className="tnum">
                {m.tenureMonths < 1 ? 'new' : `${m.tenureMonths} mo`}
              </span>
            </span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => setDialog('message')}>
              <MessageSquare className="size-3.5" />
              <span className="hidden sm:inline">Message</span>
            </Button>
            {/* Freeze and Reactivate are the same button in two states. Showing
                "Freeze" on an already-frozen member is what made it look broken:
                pressing it changed nothing anyone could see. */}
            {frozen || ended ? (
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => setStatusTarget('active')}>
                <Play className="size-3.5" />
                <span className="hidden sm:inline">Reactivate</span>
              </Button>
            ) : (
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => setStatusTarget('frozen')}>
                <Snowflake className="size-3.5" />
                <span className="hidden sm:inline">Freeze</span>
              </Button>
            )}
            <Button variant="primary" size="sm" disabled={busy} onClick={() => setDialog('payment')}>
              <CreditCard className="size-3.5" />
              <span className="hidden sm:inline">Take payment</span>
            </Button>
            {ended ? null : (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Cancel membership"
                title="Cancel membership"
                disabled={busy}
                onClick={() => setStatusTarget('cancelled')}
              >
                <XCircle className="size-4" />
              </Button>
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <MemberStatus status={view.chipStatus} />
          <RiskScore score={member.risk.score} />
          {m.failedPayments > 0 ? (
            <StatusChip
              tone="danger"
              label={`${m.failedPayments} failed payment${m.failedPayments > 1 ? 's' : ''}`}
            />
          ) : null}
          {stale ? (
            <StatusChip
              tone={m.daysSinceLastVisit! >= 21 ? 'danger' : 'warn'}
              label={`${m.daysSinceLastVisit}d since visit`}
            />
          ) : null}
          {view.companyName ? <StatusChip tone="info" label={view.companyName} /> : null}
          <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
          {member.tags.map((tag) => (
            <Tag key={tag} label={tag} />
          ))}
        </div>
      </PageHeader>

      {/* Facts strip — one row of the numbers a conversation actually needs. */}
      <div className="grid grid-cols-2 border-b border-border bg-surface sm:grid-cols-3 lg:grid-cols-6">
        <Fact label="Plan" value={view.planName} sub={`${money(m.monthlyValue)} / mo`} />
        <Fact
          label="Last visit"
          value={m.lastVisit ? daysAgo(m.lastVisit, NOW) : 'Never'}
          sub={m.lastVisit ? fullDate(m.lastVisit) : 'No check-ins on record'}
          tone={m.lastVisit === null || (m.daysSinceLastVisit ?? 0) >= 21 ? 'danger' : stale ? 'warn' : undefined}
        />
        <Fact
          label="Visits 30d"
          value={String(m.visitsLast30)}
          sub={`was ${m.visitsPrev30} the month before`}
          tone={m.visitsLast30 < m.visitsPrev30 ? 'warn' : undefined}
        />
        <Fact
          label="Allowance"
          value={m.planVisitsPerMonth === null ? 'Unlimited' : `${m.planVisitsPerMonth} / mo`}
          sub={
            view.utilization === null
              ? 'No cap'
              : `${Math.round(view.utilization * 100)}% used${
                  m.creditsRemaining !== null ? ` · ${m.creditsRemaining} left` : ''
                }`
          }
          tone={view.utilization !== null && view.utilization < 0.4 ? 'warn' : undefined}
        />
        <Fact label="Lifetime value" value={compactMoney(m.lifetimeValue)} sub="Since joining" />
        <Fact
          label="Trainer"
          value={view.trainerName ?? 'Unassigned'}
          sub={view.trainerName ? 'Personal training' : 'No trainer assigned'}
        />
      </div>

      <MessageMemberDialog open={dialog === 'message'} member={member} onClose={() => setDialog(null)} />
      <TakePaymentDialog open={dialog === 'payment'} member={member} onClose={() => setDialog(null)} />
      <MemberStatusDialog
        open={statusTarget !== null}
        member={member}
        target={statusTarget ?? 'frozen'}
        onClose={() => setStatusTarget(null)}
      />
    </>
  )
}

function Fact({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'warn' | 'danger'
}) {
  return (
    <div className="min-w-0 border-b border-r border-border px-4 py-2.5 last:border-r-0 sm:border-b-0">
      <p className="truncate text-micro font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 truncate text-base font-medium tnum',
          tone === 'danger' ? 'text-danger' : tone === 'warn' ? 'text-warn' : 'text-foreground',
        )}
      >
        {value}
      </p>
      {sub ? <p className="truncate text-micro text-muted-foreground">{sub}</p> : null}
    </div>
  )
}
