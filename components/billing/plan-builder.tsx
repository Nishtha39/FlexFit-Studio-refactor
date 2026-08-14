'use client'

import * as React from 'react'
import { Plus, X } from 'lucide-react'
import { PageHeader, PageBody } from '@/components/shell/page-header'
import { RequireScreen } from '@/components/shell/app-shell'
import { Card, CardBody, CardHeader, CardFooter, DataPoint } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/input'
import { ConfirmDialog, ConsequenceNotice } from '@/components/ui/modal'
import { DeltaText, StatusChip } from '@/components/ui/status-chip'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { compactMoney, money, num } from '@/lib/format'
import type { Plan } from '@/lib/types'
import { BillingTabs } from './billing-tabs'
import {
  draftFromPlan,
  invoices,
  monthlyEquivalent,
  planCatalog,
  planImpact,
  type PlanDraft,
} from './billing-data'

/**
 * Plan builder. A price change is a revenue decision, so the impact on the
 * members already holding the plan is computed live and shown before publish —
 * including how many would be pushed over their visit allowance.
 */
export function PlanBuilder() {
  const { toast } = useToast()
  const [selectedId, setSelectedId] = React.useState(planCatalog[2].id)
  const selected = planCatalog.find((p) => p.id === selectedId) as Plan
  const [draft, setDraft] = React.useState<PlanDraft>(() => draftFromPlan(selected))
  const [publishOpen, setPublishOpen] = React.useState(false)

  React.useEffect(() => {
    setDraft(draftFromPlan(selected))
  }, [selected])

  const impact = React.useMemo(() => planImpact(draft), [draft])
  const dirty =
    draft.name !== selected.name ||
    draft.price !== selected.price ||
    draft.interval !== selected.interval ||
    draft.visitsPerMonth !== selected.visitsPerMonth ||
    draft.active !== selected.active ||
    draft.perks.join('|') !== selected.perks.join('|')

  const set = <K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  return (
    <RequireScreen screen="billing">
      <PageHeader
        title="Plans"
        crumbs={[
          { label: 'FlexFit Studio', href: '/dashboard' },
          { label: 'Billing', href: '/billing' },
          { label: 'Plans' },
        ]}
        meta={
          <>
            <span className="tnum">{planCatalog.length} plans</span>
            <span aria-hidden>·</span>
            <span className="tnum">{num(impact.members)} members on {selected.name}</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" disabled={!dirty} onClick={() => setDraft(draftFromPlan(selected))}>
              Discard
            </Button>
            <Button variant="primary" size="sm" disabled={!dirty} onClick={() => setPublishOpen(true)}>
              Publish changes
            </Button>
          </>
        }
        sticky={false}
      >
        <BillingTabs counts={{ '/billing': invoices.length }} />
      </PageHeader>

      <PageBody>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)_minmax(0,300px)]">
          <Card className="overflow-hidden">
            <CardHeader title="Catalog" description="Pick a plan to edit." />
            <ul className="divide-y divide-border">
              {planCatalog.map((plan) => {
                const active = plan.id === selectedId
                return (
                  <li key={plan.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(plan.id)}
                      aria-current={active ? 'true' : undefined}
                      className={cn(
                        'flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors duration-150',
                        active ? 'bg-primary-soft' : 'hover:bg-subtle',
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{plan.name}</span>
                        <span className="shrink-0 text-sm text-foreground tnum">{money(plan.price)}</span>
                      </span>
                      <span className="text-micro text-muted-foreground">
                        {plan.interval === 'per-visit'
                          ? 'per visit'
                          : plan.interval === 'annual'
                            ? 'per year'
                            : 'per month'}
                        {' · '}
                        {plan.visitsPerMonth === null ? 'unlimited' : `${plan.visitsPerMonth} visits`}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title={`Edit ${selected.name}`}
              description="Changes apply on the member's next renewal, never mid-cycle."
              actions={dirty ? <StatusChip tone="warn" label="Unpublished draft" /> : <StatusChip tone="good" label="Published" />}
            />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Plan name" htmlFor="plan-name" className="sm:col-span-2">
                <Input
                  id="plan-name"
                  value={draft.name}
                  onChange={(e) => set('name', e.currentTarget.value)}
                />
              </Field>

              <Field label="Billing interval" htmlFor="plan-interval">
                <Select
                  id="plan-interval"
                  value={draft.interval}
                  onChange={(e) => set('interval', e.currentTarget.value as Plan['interval'])}
                >
                  <option value="per-visit">Per visit</option>
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </Select>
              </Field>

              <Field
                label="Price"
                hint="INR"
                htmlFor="plan-price"
                help={`Monthly equivalent ${money(monthlyEquivalent(draft.price, draft.interval))}`}
              >
                <Input
                  id="plan-price"
                  type="number"
                  min={0}
                  step={100}
                  value={draft.price}
                  onChange={(e) => set('price', Number(e.currentTarget.value || 0))}
                  className="tnum"
                />
              </Field>

              <Field
                label="Visits per month"
                htmlFor="plan-visits"
                help={draft.visitsPerMonth === null ? 'Unlimited — no credit decrement at the kiosk.' : 'Credits decrement on each check-in.'}
              >
                <div className="flex items-center gap-2">
                  <Input
                    id="plan-visits"
                    type="number"
                    min={1}
                    disabled={draft.visitsPerMonth === null}
                    value={draft.visitsPerMonth ?? ''}
                    onChange={(e) => set('visitsPerMonth', Number(e.currentTarget.value || 1))}
                    className="tnum"
                  />
                  <Button
                    variant={draft.visitsPerMonth === null ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => set('visitsPerMonth', draft.visitsPerMonth === null ? 12 : null)}
                  >
                    Unlimited
                  </Button>
                </div>
              </Field>

              <Field label="Availability" htmlFor="plan-active">
                <Select
                  id="plan-active"
                  value={draft.active ? 'active' : 'retired'}
                  onChange={(e) => set('active', e.currentTarget.value === 'active')}
                >
                  <option value="active">Sold to new members</option>
                  <option value="retired">Retired — existing members keep it</option>
                </Select>
              </Field>

              <div className="sm:col-span-2">
                <Field label="Perks" help="Shown on the member portal and on the invoice line.">
                  <div className="flex flex-wrap gap-1.5">
                    {draft.perks.map((perk, i) => (
                      <span
                        key={`${perk}-${i}`}
                        className="inline-flex h-6 items-center gap-1 rounded-sm border border-border bg-muted pl-2 pr-1 text-micro text-foreground"
                      >
                        {perk}
                        <button
                          type="button"
                          aria-label={`Remove ${perk}`}
                          onClick={() => set('perks', draft.perks.filter((_, j) => j !== i))}
                          className="flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:bg-surface hover:text-foreground"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                    <PerkInput onAdd={(perk) => set('perks', [...draft.perks, perk])} />
                  </div>
                </Field>
              </div>
            </CardBody>
            <CardFooter>
              <span>{selected.description}</span>
              <span className="tnum">{draft.id}</span>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader title="Impact" description="Members already on this plan." />
            <CardBody className="flex flex-col gap-4">
              <DataPoint label="Members holding it" value={num(impact.members)} sub={selected.name} />
              <DataPoint
                label="Recurring revenue"
                value={compactMoney(impact.draftMrr)}
                sub={`Now ${compactMoney(impact.currentMrr)}`}
              />
              <div className="flex items-center gap-2">
                <DeltaText
                  value={impact.deltaMrr}
                  formatted={`${compactMoney(Math.abs(impact.deltaMrr))}/mo`}
                />
                <span className="text-micro text-muted-foreground">at next renewal</span>
              </div>

              {impact.overAllowance > 0 ? (
                <ConsequenceNotice
                  tone="warn"
                  headline={`${impact.overAllowance} members already exceed ${draft.visitsPerMonth} visits`}
                  detail="They would hit the cap mid-month and be turned away at the kiosk. Grandfather them or raise the cap."
                />
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  No current holder exceeds this allowance, so nobody gets turned away at the desk
                  after the change.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </PageBody>

      <ConfirmDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        onConfirm={() =>
          toast({
            tone: 'good',
            title: `${draft.name} published`,
            detail: `${num(impact.members)} members move to ${money(draft.price)} at their next renewal.`,
          })
        }
        title={`Publish ${draft.name}?`}
        description="Applies at each member's next renewal date."
        consequenceTone={impact.deltaMrr < 0 || impact.overAllowance > 0 ? 'danger' : 'warn'}
        consequence={`${num(impact.members)} members are on this plan. Recurring revenue moves ${impact.deltaMrr >= 0 ? 'up' : 'down'} ${compactMoney(Math.abs(impact.deltaMrr))}/mo${impact.overAllowance > 0 ? `, and ${impact.overAllowance} would exceed the new visit cap` : ''}.`}
        confirmLabel="Publish plan"
        destructive={false}
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Members are emailed 14 days before their renewal, as required. Nothing changes mid-cycle
          and no card is charged today.
        </p>
      </ConfirmDialog>
    </RequireScreen>
  )
}

function PerkInput({ onAdd }: { onAdd: (perk: string) => void }) {
  const [value, setValue] = React.useState('')
  const commit = () => {
    const next = value.trim()
    if (!next) return
    onAdd(next)
    setValue('')
  }
  return (
    <span className="flex items-center gap-1">
      <input
        value={value}
        placeholder="Add a perk"
        aria-label="Add a perk"
        onChange={(e) => setValue(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
        }}
        className="h-6 w-28 rounded-sm border border-input bg-surface px-1.5 text-micro placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <Button variant="ghost" size="icon-sm" aria-label="Add perk" onClick={commit}>
        <Plus className="size-3" />
      </Button>
    </span>
  )
}
