'use client'

import * as React from 'react'
import { PageHeader, PageBody } from '@/components/shell/page-header'
import { RequireScreen } from '@/components/shell/app-shell'
import { Card, CardBody, CardHeader, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Checkbox } from '@/components/ui/input'
import { Tabs, TabPanel } from '@/components/ui/tabs'
import { StatusChip } from '@/components/ui/status-chip'
import { ConfirmDialog, ConsequenceNotice } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { locations } from '@/lib/data'
import { staff } from '@/lib/data/staff'
import { PERMISSIONS, ROLES, type Role, type ScreenKey } from '@/components/shell/role-context'
import { num } from '@/lib/format'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'studio', label: 'Studio' },
  { id: 'policies', label: 'Booking policy' },
  { id: 'team', label: 'Team & roles' },
  { id: 'notifications', label: 'Notifications' },
]

const SCREENS: ScreenKey[] = [
  'dashboard',
  'members',
  'retention',
  'schedule',
  'my_schedule',
  'check_in',
  'kiosk',
  'billing',
  'payments',
  'corporate',
  'leads',
  'trainers',
  'reports',
  'notifications',
  'portal',
  'settings',
]

/**
 * Settings. Only the values that change behaviour elsewhere in the product are
 * editable here — the cancellation window, the dunning ladder and role access
 * are all read by other screens, so each field says what it affects.
 */
export function SettingsView() {
  const { toast } = useToast()
  const [tab, setTab] = React.useState('studio')
  const [cancelWindow, setCancelWindow] = React.useState(12)
  const [waitlistWindow, setWaitlistWindow] = React.useState(2)
  const [noShowFee, setNoShowFee] = React.useState(200)
  const [resetOpen, setResetOpen] = React.useState(false)

  return (
    <RequireScreen screen="settings">
      <PageHeader
        title="Settings"
        crumbs={[{ label: 'FlexFit Studio', href: '/dashboard' }, { label: 'Settings' }]}
        meta={
          <>
            <span className="tnum">{locations.length} locations</span>
            <span aria-hidden>·</span>
            <span className="tnum">{num(staff.length)} staff</span>
          </>
        }
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              toast({
                tone: 'good',
                title: 'Settings saved',
                detail: `Free-cancel window is now ${cancelWindow}h. Booking dialogs use it immediately.`,
              })
            }
          >
            Save changes
          </Button>
        }
        sticky={false}
      />

      <Tabs items={TABS} value={tab} onChange={setTab} />

      <PageBody>
        <TabPanel id="studio" active={tab === 'studio'} className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Studio" description="Shown on invoices, the kiosk and member emails." />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Business name" htmlFor="s-name" className="sm:col-span-2">
                <Input id="s-name" defaultValue="FlexFit Studio" />
              </Field>
              <Field label="Currency" htmlFor="s-currency" help="Locale is fixed to en-IN so lakh grouping is correct.">
                <Select id="s-currency" defaultValue="INR">
                  <option value="INR">INR — ₹</option>
                  <option value="AED">AED — د.إ</option>
                  <option value="GBP">GBP — £</option>
                </Select>
              </Field>
              <Field label="Timezone" htmlFor="s-tz" help="Every timestamp in the product renders in this zone.">
                <Select id="s-tz" defaultValue="Asia/Kolkata">
                  <option value="Asia/Kolkata">Asia/Kolkata</option>
                  <option value="Asia/Dubai">Asia/Dubai</option>
                  <option value="Europe/London">Europe/London</option>
                </Select>
              </Field>
              <Field label="GST number" htmlFor="s-gst" hint="Optional">
                <Input id="s-gst" defaultValue="29ABCDE1234F1Z5" className="font-mono" />
              </Field>
              <Field label="Support number" htmlFor="s-phone">
                <Input id="s-phone" defaultValue="+91 98200 10000" className="tnum" />
              </Field>
            </CardBody>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Locations" description="Each location has its own kiosk and roster." />
            <ul className="divide-y divide-border">
              {locations.map((location) => (
                <li key={location.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">{location.name}</span>
                    <span className="block text-micro text-muted-foreground">
                      {location.shortName} · {location.timezone}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <StatusChip tone="good" label="Open" />
                    <Button variant="ghost" size="xs">
                      Edit
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
            <CardFooter>
              <span>Closing a location does not cancel its memberships — they transfer.</span>
            </CardFooter>
          </Card>
        </TabPanel>

        <TabPanel id="policies" active={tab === 'policies'} className="flex flex-col gap-4">
          <Card>
            <CardHeader
              title="Booking and cancellation"
              description="These numbers are read by every booking dialog in the product."
            />
            <CardBody className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Free-cancel window"
                hint="hours"
                htmlFor="p-cancel"
                help="Cancel earlier: credit returned. Later: credit forfeited, with the deadline shown."
              >
                <Input
                  id="p-cancel"
                  type="number"
                  min={0}
                  max={72}
                  value={cancelWindow}
                  onChange={(e) => setCancelWindow(Number(e.currentTarget.value || 0))}
                  className="tnum"
                />
              </Field>
              <Field
                label="Waitlist promotion cut-off"
                hint="hours"
                htmlFor="p-waitlist"
                help="Inside this window the desk promotes manually so nobody arrives to a taken spot."
              >
                <Input
                  id="p-waitlist"
                  type="number"
                  min={0}
                  max={24}
                  value={waitlistWindow}
                  onChange={(e) => setWaitlistWindow(Number(e.currentTarget.value || 0))}
                  className="tnum"
                />
              </Field>
              <Field label="No-show fee" hint="INR" htmlFor="p-fee" help="Charged on the next invoice, never at the door.">
                <Input
                  id="p-fee"
                  type="number"
                  min={0}
                  step={50}
                  value={noShowFee}
                  onChange={(e) => setNoShowFee(Number(e.currentTarget.value || 0))}
                  className="tnum"
                />
              </Field>
            </CardBody>
            <CardFooter>
              <span>
                A member cancelling inside {cancelWindow}h sees the exact forfeit deadline before they
                confirm.
              </span>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader title="Dunning" description="The failed-payment ladder used on the billing screens." />
            <CardBody className="flex flex-col gap-2.5">
              {[
                ['Day 1', 'Automatic card retry'],
                ['Day 3', 'SMS with a payment link'],
                ['Day 7', 'Front-desk call'],
                ['Day 12', 'Final automatic retry'],
                ['Day 18', 'Check-in access paused'],
              ].map(([day, action]) => (
                <div key={day} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-micro font-medium tracking-wide text-muted-foreground uppercase">
                    {day}
                  </span>
                  <span className="flex-1 text-sm text-foreground">{action}</span>
                  <Checkbox defaultChecked aria-label={`Enable ${action}`} />
                </div>
              ))}
            </CardBody>
            <CardFooter>
              <span>Access is paused, never cancelled — reinstatement is automatic on payment.</span>
            </CardFooter>
          </Card>
        </TabPanel>

        <TabPanel id="team" active={tab === 'team'} className="flex flex-col gap-4">
          <Card className="overflow-x-auto">
            <CardHeader
              title="Role access"
              description="What each role can reach. A blocked screen shows the designed no-access state, never a redirect."
            />
            <CardBody>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="h-8 px-2 text-left text-micro font-medium tracking-wide text-muted-foreground uppercase">
                      Screen
                    </th>
                    {ROLES.map((role) => (
                      <th
                        key={role.id}
                        className="h-8 px-2 text-center text-micro font-medium tracking-wide text-muted-foreground uppercase"
                      >
                        {role.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {SCREENS.map((screen) => (
                    <tr key={screen}>
                      <td className="h-8 px-2 text-foreground">{screen.replace(/_/g, ' ')}</td>
                      {ROLES.map((role) => {
                        const allowed = PERMISSIONS[role.id as Role].includes(screen)
                        return (
                          <td key={role.id} className="h-8 px-2 text-center">
                            <span
                              aria-label={allowed ? 'Allowed' : 'Blocked'}
                              className={cn(
                                'inline-block size-2 rounded-full',
                                allowed ? 'bg-primary' : 'border border-border-strong bg-transparent',
                              )}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Staff" description={`${num(staff.length)} people on record.`} />
            <ul className="divide-y divide-border">
              {staff.map((person) => (
                <li key={person.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">{person.name}</span>
                    <span className="block truncate text-micro text-muted-foreground">
                      {person.role.replace('-', ' ')} · {person.email}
                    </span>
                  </span>
                  {person.active ? (
                    <StatusChip tone="good" label="Active" />
                  ) : (
                    <StatusChip tone="neutral" label="Departed" />
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </TabPanel>

        <TabPanel id="notifications" active={tab === 'notifications'} className="flex flex-col gap-4">
          <Card>
            <CardHeader title="What the studio gets told" description="Owner and manager alerts." />
            <CardBody className="flex flex-col gap-2.5">
              {[
                ['Payment failed', 'Immediately, per invoice'],
                ['Member enters high risk', 'Daily digest at 7am'],
                ['Corporate pool under 4 weeks', 'Immediately, once per pool'],
                ['Class waitlist above 5', 'Daily digest at 7am'],
                ['Weekly summary', 'Mondays at 7am'],
              ].map(([label, cadence]) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-foreground">{label}</span>
                    <span className="block text-micro text-muted-foreground">{cadence}</span>
                  </span>
                  <Checkbox defaultChecked aria-label={`Enable ${label}`} />
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Danger zone" description="Actions that cannot be undone from the interface." />
            <CardBody className="flex flex-col gap-3">
              <ConsequenceNotice
                tone="danger"
                headline="Resetting demo data rebuilds all 380 members"
                detail="Every locally-made change in this session — moved classes, cleared dunning rows, added reversals — is discarded. The seeded dataset itself is deterministic, so it comes back identical."
              />
              <Button variant="danger" size="sm" className="self-start" onClick={() => setResetOpen(true)}>
                Reset demo data
              </Button>
            </CardBody>
          </Card>
        </TabPanel>
      </PageBody>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => window.location.reload()}
        title="Reset all session changes?"
        consequence="Everything you changed in this session is discarded and the page reloads."
        confirmLabel="Reset and reload"
      />
    </RequireScreen>
  )
}
