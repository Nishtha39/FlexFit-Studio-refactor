'use client'

import * as React from 'react'
import { PageHeader, PageBody } from '@/components/shell/page-header'
import { RequireScreen } from '@/components/shell/app-shell'
import { Card, CardBody, CardHeader, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Checkbox } from '@/components/ui/input'
import { Tabs, TabPanel } from '@/components/ui/tabs'
import { StatusChip } from '@/components/ui/status-chip'
import { ConfirmDialog, ConsequenceNotice, Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { locations } from '@/lib/data'
import type { Location } from '@/lib/types'
import { staff } from '@/lib/data/staff'
import { PERMISSIONS, ROLES, type Role, type ScreenKey } from '@/components/shell/role-context'
import { num } from '@/lib/format'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api/client'
import { useDataVersion, useStudio } from '@/lib/store/studio-store'
import { EmailSettingsCard } from './email-settings'

const TABS = [
  { id: 'studio', label: 'Studio' },
  { id: 'policies', label: 'Booking policy' },
  { id: 'team', label: 'Team & roles' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'email', label: 'Email' },
]

/**
 * The settings that are actually stored, and the key each is stored under.
 *
 * Settings live one row per key in D1 (`ops.saveSetting`), so a save writes
 * only what changed. The three booking numbers are the ones other screens read
 * back — the booking dialogs quote the cancel window at the member — which is
 * why they are the ones persisted rather than every field on the form.
 */
const SETTING_KEYS = {
  cancelWindow: 'booking.cancelWindowHours',
  waitlistWindow: 'booking.waitlistWindowHours',
  noShowFee: 'booking.noShowFee',
} as const

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
  'equipment',
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
  const { mutate, busy, connection } = useStudio()
  const version = useDataVersion()
  const sites = React.useMemo(() => locations, [version])
  const [tab, setTab] = React.useState('studio')
  const [cancelWindow, setCancelWindow] = React.useState(12)
  const [waitlistWindow, setWaitlistWindow] = React.useState(2)
  const [noShowFee, setNoShowFee] = React.useState(200)
  const [resetOpen, setResetOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Location | null>(null)
  const [draft, setDraft] = React.useState({ name: '', shortName: '', timezone: '' })

  React.useEffect(() => {
    if (!editing) return
    setDraft({ name: editing.name, shortName: editing.shortName, timezone: editing.timezone })
  }, [editing])

  /**
   * Rename a site. The id stays fixed — it is a foreign key on members, staff,
   * classes and every check-in, so "rename this gym" must not become "move
   * everybody out of it". The server enforces that too; this simply never
   * offers it.
   */
  function saveLocation() {
    if (!editing || connection !== 'live') return
    void mutate(
      () =>
        api.ops.saveLocation.mutate({
          locationId: editing.id,
          name: draft.name.trim(),
          shortName: draft.shortName.trim(),
          timezone: draft.timezone,
        }),
      {
        success: () => ({
          title: `${draft.name} saved`,
          detail:
            draft.name === editing.name
              ? 'Short name and timezone updated.'
              : `Renamed from ${editing.name}. It reads the new name everywhere it appears.`,
        }),
      },
    ).then((r) => {
      if (r) setEditing(null)
    })
  }

  /**
   * The values as they are stored, so "Save changes" can tell whether anything
   * changed and write only the keys that did. Without this it would re-write
   * all three on every press and report saving work it did not do.
   */
  const [saved, setSaved] = React.useState({ cancelWindow: 12, waitlistWindow: 2, noShowFee: 200 })

  /**
   * TYPING BEFORE THE LOAD RESOLVES MUST NOT LOSE WHAT YOU TYPED.
   *
   * The stored values arrive from an async read, and the first version of this
   * effect pushed them into the inputs unconditionally. Anyone quick enough to
   * change a field before that promise settled had their edit silently replaced
   * by the server's value — and then "Save changes" correctly reported there was
   * nothing to save, which reads exactly like a broken button. The real-browser
   * suite reproduced it on every run.
   *
   * A ref, not state: it must be readable inside the promise callback without
   * re-running the effect, and changing it must not itself cause a render.
   */
  const touched = React.useRef(false)
  const markTouched = () => {
    touched.current = true
  }

  React.useEffect(() => {
    if (connection !== 'live') return
    let cancelled = false
    api.read.bootstrap
      .query()
      .then((b) => {
        if (cancelled) return
        const s = b.settings as Record<string, unknown>
        const next = {
          cancelWindow: Number(s[SETTING_KEYS.cancelWindow] ?? 12),
          waitlistWindow: Number(s[SETTING_KEYS.waitlistWindow] ?? 2),
          noShowFee: Number(s[SETTING_KEYS.noShowFee] ?? 200),
        }
        // `saved` is the baseline the diff is taken against, so it is always
        // updated — that is what the stored values ARE. The inputs are only
        // filled in when the person has not started editing.
        setSaved(next)
        if (touched.current) return
        setCancelWindow(next.cancelWindow)
        setWaitlistWindow(next.waitlistWindow)
        setNoShowFee(next.noShowFee)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [connection])

  const pending = [
    { key: SETTING_KEYS.cancelWindow, value: cancelWindow, was: saved.cancelWindow, label: 'free-cancel window' },
    { key: SETTING_KEYS.waitlistWindow, value: waitlistWindow, was: saved.waitlistWindow, label: 'waitlist cut-off' },
    { key: SETTING_KEYS.noShowFee, value: noShowFee, was: saved.noShowFee, label: 'no-show fee' },
  ].filter((f) => f.value !== f.was)

  async function save() {
    if (pending.length === 0) {
      // Saying "saved" when nothing changed is how a button teaches people not
      // to trust it.
      toast({ tone: 'info', title: 'Nothing to save', detail: 'No settings have been changed.' })
      return
    }
    const result = await mutate(
      async () => {
        for (const field of pending) {
          await api.ops.saveSetting.mutate({ key: field.key, value: field.value })
        }
        return pending
      },
      {
        success: (fields) => ({
          title: `Saved ${fields.length} setting${fields.length === 1 ? '' : 's'}`,
          detail: fields.map((f) => `${f.label}: ${f.was} → ${f.value}`).join(' · '),
        }),
      },
    )
    if (result) {
      setSaved({ cancelWindow, waitlistWindow, noShowFee })
    }
  }

  return (
    <RequireScreen screen="settings">
      <PageHeader
        title="Settings"
        crumbs={[{ label: 'FlexFit Studio', href: '/dashboard' }, { label: 'Settings' }]}
        meta={
          <>
            <span className="tnum">{sites.length} locations</span>
            <span aria-hidden>·</span>
            <span className="tnum">{num(staff.length)} staff</span>
          </>
        }
        actions={
          <Button variant="primary" size="sm" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : pending.length > 0 ? `Save ${pending.length} change${pending.length === 1 ? '' : 's'}` : 'Save changes'}
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
              {sites.map((location) => (
                <li key={location.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">{location.name}</span>
                    <span className="block text-micro text-muted-foreground">
                      {location.shortName} · {location.timezone}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <StatusChip tone="good" label="Open" />
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={connection !== 'live'}
                      onClick={() => setEditing(location)}
                    >
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
                  onChange={(e) => {
                    markTouched()
                    setCancelWindow(Number(e.currentTarget.value || 0))
                  }}
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
                  onChange={(e) => {
                    markTouched()
                    setWaitlistWindow(Number(e.currentTarget.value || 0))
                  }}
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
                  onChange={(e) => {
                    markTouched()
                    setNoShowFee(Number(e.currentTarget.value || 0))
                  }}
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

        <TabPanel id="email" active={tab === 'email'} className="flex flex-col gap-4">
          <EmailSettingsCard />
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

      {/*
        Each handler reads `e.currentTarget.value` into a local BEFORE calling
        the setter. Reading it inside the updater callback crashes: React nulls
        `currentTarget` once the handler returns, and the updater runs later, so
        the page threw "Cannot read properties of null (reading 'value')" and
        every control on it — including Save — went dead. It only reproduced
        when React deferred the update, which is why it survived a hand test and
        was caught by the browser suite.
      */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.name}` : 'Edit location'}
        description="The name shows on invoices, the kiosk and every screen that names a site."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={
                busy ||
                connection !== 'live' ||
                draft.name.trim().length === 0 ||
                draft.shortName.trim().length === 0
              }
              onClick={saveLocation}
            >
              {busy ? 'Saving…' : 'Save location'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Name" htmlFor="loc-name">
            <Input
              id="loc-name"
              value={draft.name}
              onChange={(e) => {
                const v = e.currentTarget.value
                setDraft((d) => ({ ...d, name: v }))
              }}
            />
          </Field>
          <Field
            label="Short name"
            htmlFor="loc-short"
            help="Used where space is tight — table cells, chips, the kiosk header."
          >
            <Input
              id="loc-short"
              value={draft.shortName}
              onChange={(e) => {
                const v = e.currentTarget.value
                setDraft((d) => ({ ...d, shortName: v }))
              }}
            />
          </Field>
          <Field
            label="Timezone"
            htmlFor="loc-tz"
            help="Class times and check-in stamps for this site render in this zone."
          >
            <Select
              id="loc-tz"
              value={draft.timezone}
              onChange={(e) => {
                const v = e.currentTarget.value
                setDraft((d) => ({ ...d, timezone: v }))
              }}
            >
              <option value="Asia/Kolkata">Asia/Kolkata</option>
              <option value="Asia/Dubai">Asia/Dubai</option>
              <option value="Europe/London">Europe/London</option>
            </Select>
          </Field>
          <p className="text-micro text-muted-foreground">
            The location’s id (<span className="font-mono">{editing?.id}</span>) cannot change — it is
            recorded on every membership, class and check-in that belongs to this site.
          </p>
        </div>
      </Modal>
    </RequireScreen>
  )
}
