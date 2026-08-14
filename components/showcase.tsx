'use client'

import * as React from 'react'
import { Download, Plus, Search, Trash2, Pencil } from 'lucide-react'
import { PageHeader, PageBody, SectionTitle } from '@/components/shell/page-header'
import { Button, ButtonGroup, RowAction } from '@/components/ui/button'
import { Input, Textarea, Select, Field } from '@/components/ui/input'
import {
  StatusChip,
  MemberStatus,
  PaymentStatus,
  BookingStatus,
  RiskScore,
  DeltaText,
  AgingChip,
} from '@/components/ui/status-chip'
import { FilterBar, FilterTrigger, AddFilterButton, Tag, type FilterValue } from '@/components/ui/filter-chip'
import { Card, CardHeader, CardBody, CardFooter, KpiTile, CapacityBar, DataPoint } from '@/components/ui/card'
import {
  TableWrap,
  Table,
  Thead,
  Tbody,
  Th,
  Tr,
  Td,
  SelectCell,
  SelectAllCell,
  BulkActionBar,
  CellStack,
} from '@/components/ui/table'
import { Modal, ConfirmDialog, ConsequenceNotice, Sheet } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { EmptyState, NullResultState, ErrorState, TableSkeleton } from '@/components/ui/empty-state'
import { Tabs, TabPanel, ViewToggle } from '@/components/ui/tabs'
import { money, compactMoney, delta, percent, deadlineStamp, num } from '@/lib/format'

/** Plan catalogue — priced in rupees, formatted through `money()` so the
 *  lakh grouping and the ₹ symbol come from one place. */
const PLANS = [
  { id: 'unlimited', label: 'Unlimited', price: 4999, period: '/mo' },
  { id: '8x', label: 'Monthly 8x', price: 3299, period: '/mo' },
  { id: 'pack', label: '10-class pack', price: 5650, period: '' },
]

const planLabel = (id: string) => {
  const plan = PLANS.find((p) => p.id === id)
  return plan ? `${plan.label} — ${money(plan.price)}${plan.period}` : ''
}

/** Ordered by member name ascending — the header claims that sort, so the
 *  data has to actually be in that order. */
const ROWS = [
  { id: 'm3', name: 'Adaeze Nwachukwu', plan: 'Monthly 8x', status: 'past_due', risk: 64, visits: 1.9, ltv: 187600, joined: 'Feb 2022' },
  { id: 'm4', name: 'Hiroshi Tanabe', plan: 'Monthly 8x', status: 'frozen', risk: 41, visits: 0, ltv: 81300, joined: 'Sep 2024' },
  { id: 'm1', name: 'Priya Raghunathan', plan: 'Unlimited', status: 'active', risk: 12, visits: 3.4, ltv: 258900, joined: 'Mar 2023' },
  { id: 'm5', name: 'Sofia Marchetti', plan: 'Unlimited', status: 'active', risk: 8, visits: 4.1, ltv: 365600, joined: 'Jul 2021' },
  { id: 'm2', name: 'Tomás Lindqvist', plan: '10-class pack', status: 'at_risk', risk: 78, visits: 0.6, ltv: 152700, joined: 'Nov 2023' },
]

export function SystemShowcase() {
  const { toast } = useToast()
  const [selected, setSelected] = React.useState<string[]>([])
  const [tab, setTab] = React.useState('components')
  const [view, setView] = React.useState('week')
  const [modal, setModal] = React.useState(false)
  const [confirm, setConfirm] = React.useState(false)
  const [sheet, setSheet] = React.useState(false)
  const [filters, setFilters] = React.useState<FilterValue[]>([
    { id: 'f1', field: 'Status', operator: 'is', value: 'At risk' },
    { id: 'f2', field: 'Last visit', operator: 'before', value: '14 days ago' },
    { id: 'f3', field: 'Plan', operator: 'is not', value: 'Drop-in' },
  ])

  // A fixed instant, not `new Date()` + setHours. setHours works in the
  // machine's local zone, so the server (UTC) and the browser (IST) produced
  // two different strings for "6:30pm" and React threw a hydration mismatch.
  // 13:00Z === 6:30pm Asia/Kolkata, which is the zone every formatter is pinned to.
  const deadline = React.useMemo(() => new Date('2026-08-12T13:00:00.000Z'), [])

  const allSelected = selected.length === ROWS.length

  return (
    <>
      <PageHeader
        title="Design system"
        crumbs={[{ label: 'FlexFit Studio', href: '/' }, { label: 'Design system' }]}
        meta={
          <>
            <span>Batch 1 of 8</span>
            <span>One accent · 6 type sizes · 4px base</span>
            <span>Status is never color alone</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="sm">
              <Download />
              Export tokens
            </Button>
            <Button variant="primary" size="sm" onClick={() => setModal(true)}>
              <Plus />
              New member
            </Button>
          </>
        }
      >
        <Tabs
          items={[
            { id: 'components', label: 'Components' },
            { id: 'foundations', label: 'Foundations' },
            { id: 'states', label: 'States', count: 5 },
          ]}
          value={tab}
          onChange={setTab}
          className="-mx-4 -mb-3 border-b-0 px-4"
        />
      </PageHeader>

      <PageBody>
        <TabPanel id="components" active={tab === 'components'}>
          <div className="flex flex-col gap-4">
            {/* KPI strip */}
            <Card className="overflow-hidden">
              <div className="grid grid-cols-2 divide-y divide-border sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-6">
                <KpiTile
                  label="MRR"
                  value={compactMoney(4012000)}
                  delta={<DeltaText value={3.2} formatted={delta(3.2)} />}
                  footnote={`${money(4012000)} vs. prior 30 days`}
                />
                <KpiTile
                  label="Active members"
                  value={num(380)}
                  delta={<DeltaText value={-1.4} formatted={delta(-1.4)} />}
                  footnote="25 lapsed, 8 frozen"
                />
                <KpiTile
                  label="Net change 30d"
                  value="+11"
                  delta={<DeltaText value={11} formatted="+11" />}
                  footnote="34 joined, 23 left"
                />
                <KpiTile
                  label="Visits / member / wk"
                  value="2.31"
                  delta={<DeltaText value={-0.4} formatted={delta(-0.4)} />}
                  footnote="8-week rolling"
                />
                <KpiTile
                  label="Class fill rate"
                  value={percent(71)}
                  delta={<DeltaText value={2.6} formatted={delta(2.6)} />}
                  footnote="42 weekly classes"
                />
                <KpiTile
                  label="90-day churn"
                  value={percent(6.8, 1)}
                  delta={<DeltaText value={0.9} formatted={delta(0.9)} inverse />}
                  footnote="down is better"
                />
              </div>
            </Card>

            <SectionTitle
              title="Controls"
              description="Primary uses the single saturated accent. Everything else is neutral."
            />
            <Card>
              <CardBody className="flex flex-wrap items-center gap-2">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">
                  <Trash2 />
                  Delete
                </Button>
                <Button variant="link">Link action</Button>
                <Button variant="secondary" disabled>
                  Disabled
                </Button>
                <ButtonGroup>
                  <Button variant="secondary" size="sm">
                    Day
                  </Button>
                  <Button variant="secondary" size="sm">
                    Week
                  </Button>
                  <Button variant="secondary" size="sm">
                    Month
                  </Button>
                </ButtonGroup>
                <ViewToggle
                  items={[
                    { id: 'week', label: 'Week' },
                    { id: 'day', label: 'Day' },
                    { id: 'list', label: 'List' },
                  ]}
                  value={view}
                  onChange={setView}
                />
              </CardBody>
              <CardBody className="grid gap-4 border-t border-border sm:grid-cols-3">
                <Field label="Member name" htmlFor="sc-name" help="Searches all locations">
                  <Input id="sc-name" placeholder="Search by name or ID" />
                </Field>
                <Field label="Plan" htmlFor="sc-plan">
                  <Select id="sc-plan" defaultValue="unlimited">
                    {PLANS.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {planLabel(plan.id)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Card"
                  htmlFor="sc-card"
                  error="Card ending 4412 was declined on 2 Aug."
                >
                  <Input id="sc-card" defaultValue="4412" aria-invalid />
                </Field>
                <Field label="Staff note" htmlFor="sc-note" className="sm:col-span-3">
                  <Textarea
                    id="sc-note"
                    defaultValue="Shoulder rehab — avoid overhead pressing until cleared by physio."
                  />
                </Field>
              </CardBody>
            </Card>

            <SectionTitle title="Status vocabulary" description="Shape + border + label on every chip." />
            <Card>
              <CardBody className="flex flex-wrap items-center gap-2">
                <MemberStatus status="active" />
                <MemberStatus status="at_risk" />
                <MemberStatus status="past_due" />
                <MemberStatus status="frozen" />
                <MemberStatus status="lapsed" />
                <PaymentStatus status="paid" />
                <PaymentStatus status="pending" />
                <PaymentStatus status="failed" />
                <PaymentStatus status="refunded" />
                <BookingStatus status="waitlisted" />
                <BookingStatus status="no_show" />
                <BookingStatus status="late_cancel" />
                <StatusChip tone="info" label="Corporate — Meridian Health" />
                <RiskScore score={78} />
                <RiskScore score={52} />
                <RiskScore score={11} />
                <AgingChip days={18} />
                <Tag label="rehab" />
                <Tag label="referred by S. Marchetti" />
              </CardBody>
              <CardFooter>
                <span>Capacity pressure changes bar tone, and the count is always printed.</span>
                <div className="flex w-64 flex-col gap-1.5">
                  <CapacityBar filled={20} capacity={20} showLabel />
                  <CapacityBar filled={17} capacity={20} showLabel />
                  <CapacityBar filled={3} capacity={20} showLabel />
                </div>
              </CardFooter>
            </Card>

            <SectionTitle title="Table + filter chips" description="32px rows, sticky header, bulk actions on selection." />
            <Card className="overflow-hidden">
              <FilterBar
                filters={filters}
                onRemove={(id) => setFilters((f) => f.filter((x) => x.id !== id))}
                onClearAll={() => setFilters([])}
                resultCount={5}
                totalCount={380}
              >
                <FilterTrigger label="Status" value="At risk" active />
                <FilterTrigger label="Tenure" />
                <FilterTrigger label="Trainer" />
                <AddFilterButton />
              </FilterBar>
              <TableWrap>
                <Table>
                  <Thead>
                    <Tr>
                      <SelectAllCell
                        checked={allSelected}
                        indeterminate={selected.length > 0}
                        onChange={(next) => setSelected(next ? ROWS.map((r) => r.id) : [])}
                      />
                      <Th sortable sortDir="asc">
                        Member
                      </Th>
                      <Th>Plan</Th>
                      <Th>Status</Th>
                      <Th align="right" sortable>
                        Risk
                      </Th>
                      <Th align="right">Visits / wk</Th>
                      {/* Only one column carries a sortDir — two active sort
                          arrows told the user the table was sorted twice. */}
                      <Th align="right" sortable>
                        Lifetime value
                      </Th>
                      <Th width={72} />
                    </Tr>
                  </Thead>
                  <Tbody>
                    {ROWS.map((row) => (
                      <Tr key={row.id} interactive selected={selected.includes(row.id)}>
                        <SelectCell
                          label={row.name}
                          checked={selected.includes(row.id)}
                          onChange={(next) =>
                            setSelected((prev) =>
                              next ? [...prev, row.id] : prev.filter((id) => id !== row.id),
                            )
                          }
                        />
                        <Td>
                          <CellStack primary={row.name} secondary={`Riverside · joined ${row.joined}`} />
                        </Td>
                        <Td muted>{row.plan}</Td>
                        <Td>
                          <MemberStatus status={row.status} />
                        </Td>
                        <Td align="right">
                          <RiskScore score={row.risk} />
                        </Td>
                        <Td align="right" muted>
                          {row.visits.toFixed(1)}
                        </Td>
                        <Td align="right">{money(row.ltv)}</Td>
                        <Td align="right">
                          <div className="flex justify-end gap-0.5">
                            <RowAction aria-label={`Message ${row.name}`}>
                              <Pencil />
                            </RowAction>
                            <RowAction aria-label={`Find ${row.name}`}>
                              <Search />
                            </RowAction>
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableWrap>
              <div className="p-3">
                <BulkActionBar count={selected.length} onClear={() => setSelected([])}>
                  <Button variant="secondary" size="xs">
                    Add tag
                  </Button>
                  <Button variant="secondary" size="xs">
                    Assign trainer
                  </Button>
                  <Button
                    variant="danger"
                    size="xs"
                    onClick={() => setConfirm(true)}
                  >
                    Cancel memberships
                  </Button>
                </BulkActionBar>
              </div>
            </Card>

            <SectionTitle title="Overlays" description="Consequence text always sits above the confirm button." />
            <Card>
              <CardBody className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setModal(true)}>
                  Open modal
                </Button>
                <Button variant="secondary" onClick={() => setSheet(true)}>
                  Open sheet
                </Button>
                <Button variant="danger" onClick={() => setConfirm(true)}>
                  Destructive confirm
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    toast({
                      tone: 'good',
                      title: 'Credit returned to Tomás Lindqvist',
                      detail: 'Cancelled 14 hours before start — outside the 12-hour window.',
                      action: { label: 'Undo', onClick: () => undefined },
                    })
                  }
                >
                  Success toast
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    toast({
                      tone: 'danger',
                      title: 'Payment retry failed',
                      detail: 'Adaeze Nwachukwu · card ending 4412 · attempt 3 of 4.',
                    })
                  }
                >
                  Error toast
                </Button>
              </CardBody>
              <CardBody className="grid gap-3 border-t border-border lg:grid-cols-2">
                <ConsequenceNotice
                  tone="good"
                  headline="Your credit will be returned"
                  detail="You're cancelling 14 hours before this class starts."
                />
                <ConsequenceNotice
                  tone="danger"
                  headline="Your credit will be forfeited"
                  detail={`Cancellation closed at ${deadlineStamp(deadline)}. This class is inside the 12-hour window and the credit will not return to your account.`}
                />
                <ConsequenceNotice
                  tone="info"
                  headline="You'll join the waitlist at position 3"
                  detail="No credit is charged until you're promoted into the class."
                />
                <ConsequenceNotice
                  tone="warn"
                  headline="Membership expires in 4 days"
                  detail="Renewal will be offered at check-in."
                />
              </CardBody>
            </Card>
          </div>
        </TabPanel>

        <TabPanel id="foundations" active={tab === 'foundations'}>
          <div className="flex flex-col gap-4">
            <SectionTitle title="Palette" description="One accent. Status colors desaturated, always paired with a label." />
            <Card>
              <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {[
                  ['Accent', 'bg-primary'],
                  ['Accent soft', 'bg-primary-soft'],
                  ['Surface', 'bg-surface'],
                  ['Background', 'bg-background'],
                  ['Muted', 'bg-muted'],
                  ['Border strong', 'bg-border-strong'],
                  ['Good', 'bg-good'],
                  ['Warn', 'bg-warn'],
                  ['Danger', 'bg-danger'],
                  ['Info', 'bg-info'],
                  ['Chart 2', 'bg-chart-2'],
                  ['Chart 4', 'bg-chart-4'],
                ].map(([label, cls]) => (
                  <div key={label} className="flex flex-col gap-1.5">
                    <div className={`h-10 rounded-sm border border-border ${cls}`} />
                    <span className="text-micro text-muted-foreground">{label}</span>
                  </div>
                ))}
              </CardBody>
            </Card>

            <SectionTitle title="Type scale" description="Six sizes in the entire product. Tabular numerals in columns." />
            <Card>
              <CardBody className="flex flex-col gap-3">
                <p className="text-display font-semibold">Welcome back, Priya — 36px kiosk</p>
                <p className="text-xl font-semibold">Page title / KPI value — 24px</p>
                <p className="text-lg font-semibold">Section title — 18px</p>
                <p className="text-base">Body copy inside detail pages — 15px, leading-relaxed</p>
                <p className="text-sm">Dense table body and form controls — 13px</p>
                <p className="text-micro tracking-wide text-muted-foreground uppercase">
                  Labels, chips, table meta — 11px
                </p>
                <div className="mt-2 grid grid-cols-3 gap-4 border-t border-border pt-3">
                  <DataPoint label="Lifetime value" value={money(365600)} sub="Top 5% of members" />
                  <DataPoint label="Tenure" value="3.4 yr" sub="Joined Mar 2023" />
                  <DataPoint label="Current streak" value="11 weeks" sub="Best: 26 weeks" />
                </div>
              </CardBody>
            </Card>
          </div>
        </TabPanel>

        <TabPanel id="states" active={tab === 'states'}>
          <div className="flex flex-col gap-4">
            <EmptyState
              icon={Search}
              title="No members match these filters"
              description="Three filters are active. Remove the last-visit filter to widen the result set."
              action={{ label: 'Clear all filters', onClick: () => setFilters([]) }}
            />
            <NullResultState
              title="No measurable lift"
              description="Members who received the 'we miss you' email returned at 22% within 60 days. Members who received nothing returned at 21%. The difference is inside the margin of error for a sample this size — this intervention is not working."
            />
            <ErrorState
              title="Couldn't load the payment processor"
              description="The gateway returned a timeout. Card check-ins will still record; retries are queued."
              onRetry={() => undefined}
            />
            <Card>
              <CardHeader title="Loading skeleton" description="Table rows preserve their 32px height." />
              <TableSkeleton rows={6} />
            </Card>
          </div>
        </TabPanel>
      </PageBody>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Add member"
        description="Riverside · created by Dana Okonkwo"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setModal(false)}>
              Create member
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" htmlFor="m-name">
            <Input id="m-name" placeholder="e.g. Amara Diallo" />
          </Field>
          <Field label="Email" htmlFor="m-email">
            <Input id="m-email" type="email" placeholder="name@email.com" />
          </Field>
          <Field label="Plan" htmlFor="m-plan" className="sm:col-span-2">
            <Select id="m-plan">
              <option>{planLabel('unlimited')}</option>
              <option>{planLabel('8x')}</option>
              <option>{`${planLabel('pack')} (expires 90 days)`}</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() =>
          toast({ tone: 'warn', title: 'Memberships cancelled', detail: '3 members moved to lapsed.' })
        }
        title="Cancel 3 memberships?"
        description="Riverside · effective at the end of the current billing period."
        consequence={`Recurring billing stops and ${money(13297)} of MRR is removed.`}
        confirmLabel="Cancel memberships"
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Members keep access until their paid period ends. Remaining class credits expire on the same
          date and are not refunded.
        </p>
      </ConfirmDialog>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Broadcast announcement"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSheet(false)}>
              Discard
            </Button>
            <Button variant="primary" onClick={() => setSheet(false)}>
              Send to 214 members
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Audience" htmlFor="b-aud" hint="214 recipients">
            <Select id="b-aud">
              <option>Active members · Riverside</option>
              <option>At-risk members · all locations</option>
            </Select>
          </Field>
          <Field label="Message" htmlFor="b-msg">
            <Textarea
              id="b-msg"
              rows={6}
              defaultValue="Studio B floor is being resurfaced this Saturday. All 9:00 and 10:30 classes move to Studio A."
            />
          </Field>
        </div>
      </Sheet>
    </>
  )
}
