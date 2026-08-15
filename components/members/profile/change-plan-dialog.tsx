'use client'

import * as React from 'react'
import { api } from '@/lib/api/client'
import { useDataVersion, useStudio } from '@/lib/store/studio-store'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { ConsequenceNotice, Modal } from '@/components/ui/modal'
import { DeltaText, StatusChip } from '@/components/ui/status-chip'
import { cn } from '@/lib/utils'
import { money } from '@/lib/format'
import { plans as allPlans, getPlan } from '@/lib/data/plans'
import type { Member, Plan } from '@/lib/types'

/**
 * Move a member onto a different plan.
 *
 * A plan change is a revenue decision made one member at a time, so the two
 * things that actually matter are shown before confirming: what their monthly
 * value becomes, and whether the new allowance is smaller than what they are
 * already using this month. The second one is the trap — a member switched onto
 * a 12-visit plan halfway through a 20-visit month is turned away at the kiosk
 * the same afternoon, and nobody connects that to this dialog.
 *
 * The server refuses a closed plan, a corporate-only plan for a member with no
 * company, and a no-op change. Those are enforced there because they are rules
 * about the data, not about this screen; the list here filters to what is
 * actually offerable so the refusals are rarely reached.
 */
export function ChangePlanDialog({
  open,
  onClose,
  member,
}: {
  open: boolean
  onClose: () => void
  member: Member
}) {
  const { mutate, busy, connection } = useStudio()
  const version = useDataVersion()
  const current = getPlan(member.planId)
  const [planId, setPlanId] = React.useState(member.planId)
  const [note, setNote] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    setPlanId(member.planId)
    setNote('')
  }, [open, member.planId])

  /**
   * What can this member actually be moved to: plans still sold, plus their own
   * one so it can be shown as current. A corporate plan is only offerable to
   * somebody attached to a company.
   */
  const offerable = React.useMemo(
    () =>
      allPlans.filter(
        (p) => (p.active && (!p.corporateOnly || member.companyId !== null)) || p.id === member.planId,
      ),
    [member.companyId, member.planId, version],
  )

  const next = offerable.find((p) => p.id === planId)
  const changed = planId !== member.planId

  const monthlyFor = (plan: Plan): number =>
    plan.interval === 'per-visit'
      ? plan.price * Math.max(1, member.metrics.visitsLast30)
      : plan.interval === 'annual'
        ? Math.round(plan.price / 12)
        : plan.price

  const nextMonthly = next ? monthlyFor(next) : member.metrics.monthlyValue
  const delta = nextMonthly - member.metrics.monthlyValue

  // The allowance they would have left this month, computed the way the server
  // computes it, so the number in the warning is the number that gets stored.
  const nextCredits =
    next && next.visitsPerMonth !== null
      ? Math.max(0, next.visitsPerMonth - member.metrics.visitsLast30)
      : null
  const alreadyOver =
    next !== undefined &&
    next.visitsPerMonth !== null &&
    member.metrics.visitsLast30 > next.visitsPerMonth

  async function submit() {
    if (!changed || connection !== 'live') return
    const result = await mutate(
      () =>
        api.ops.setMemberPlan.mutate({
          memberId: member.id,
          planId,
          note: note.trim() || undefined,
        }),
      {
        success: (r) => ({
          title: `${member.name} moved to ${next?.name ?? planId}`,
          detail: `Monthly value ${money(member.metrics.monthlyValue)} → ${money(r.monthlyValue)}.`,
        }),
      },
    )
    if (result) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Change plan — ${member.name}`}
      description={`Currently on ${current?.name ?? member.planId}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!changed || busy || connection !== 'live'}
            onClick={submit}
          >
            {busy ? 'Saving…' : next ? `Move to ${next.name}` : 'Change plan'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-1.5">
          {offerable.map((plan) => {
            const isCurrent = plan.id === member.planId
            const selected = plan.id === planId
            return (
              <li key={plan.id}>
                <button
                  type="button"
                  onClick={() => setPlanId(plan.id)}
                  aria-pressed={selected}
                  className={cn(
                    'flex w-full flex-col gap-0.5 rounded-md border p-2.5 text-left transition-colors duration-150',
                    selected ? 'border-primary bg-primary-soft' : 'border-border hover:bg-subtle',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-foreground">{plan.name}</span>
                      {isCurrent ? <StatusChip tone="neutral" label="Current" /> : null}
                      {!plan.active ? <StatusChip tone="warn" label="Retired" /> : null}
                    </span>
                    <span className="shrink-0 text-sm text-foreground tnum">{money(plan.price)}</span>
                  </span>
                  <span className="text-micro text-muted-foreground">
                    {plan.interval === 'per-visit'
                      ? 'per visit'
                      : plan.interval === 'annual'
                        ? 'per year'
                        : 'per month'}
                    {' · '}
                    {plan.visitsPerMonth === null ? 'unlimited visits' : `${plan.visitsPerMonth} visits / month`}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {changed && next ? (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-subtle p-2.5 text-sm">
              <span className="text-muted-foreground">Monthly value</span>
              <span className="font-medium text-foreground tnum">
                {money(member.metrics.monthlyValue)} → {money(nextMonthly)}
              </span>
              <DeltaText value={delta} formatted={`${money(Math.abs(delta))}/mo`} />
              {nextCredits !== null ? (
                <span className="ml-auto text-micro text-muted-foreground tnum">
                  {nextCredits} credit{nextCredits === 1 ? '' : 's'} left this month
                </span>
              ) : (
                <span className="ml-auto text-micro text-muted-foreground">Unlimited visits</span>
              )}
            </div>

            {alreadyOver ? (
              <ConsequenceNotice
                tone="danger"
                headline={`${member.firstName} has already used ${member.metrics.visitsLast30} visits this month — more than ${next.name} allows`}
                detail={`They would have no credits left and be turned away at the kiosk until the next cycle. Move them at the start of a cycle, or pick a plan with at least ${member.metrics.visitsLast30} visits.`}
              />
            ) : null}
          </>
        ) : null}

        <Field
          label="Reason"
          htmlFor="plan-note"
          hint="Optional"
          help="Recorded on the member's timeline so the next person knows why the price moved."
        >
          <Input
            id="plan-note"
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
            placeholder="e.g. Downgrading while travelling for work until December."
          />
        </Field>

        <p className="text-micro text-muted-foreground">
          The change applies now. Nothing is charged today — the new price is collected on their next
          billing date.
        </p>
      </div>
    </Modal>
  )
}
