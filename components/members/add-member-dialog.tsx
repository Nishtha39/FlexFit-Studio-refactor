'use client'

import * as React from 'react'
import { api } from '@/lib/api/client'
import { useRouter } from 'next/navigation'
import { useStudio } from '@/lib/store/studio-store'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { money } from '@/lib/format'
import { plans } from '@/lib/data/plans'
import { activeTrainers } from '@/lib/data/staff'
import { companies } from '@/lib/data/companies'
import { locations } from '@/lib/data'
import type { LocationId } from '@/lib/types'

/**
 * Sign somebody up.
 *
 * The form asks for the eight things a member cannot exist without and nothing
 * else — everything the directory shows beyond that is either derived (risk,
 * tenure) or starts empty and fills in as they use the place (visits, credits).
 *
 * Two rules are enforced here as well as on the server, because a refusal after
 * the operator has typed a whole record is a worse experience than a disabled
 * button that says why: a corporate plan needs a company to draw against, and
 * a closed plan cannot be sold.
 */
export function AddMemberDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate, busy } = useStudio()
  const router = useRouter()

  const sellable = plans.filter((p) => p.active)
  const [firstName, setFirstName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [planId, setPlanId] = React.useState(sellable[0]?.id ?? '')
  const [homeLocation, setHomeLocation] = React.useState<LocationId>('downtown')
  const [status, setStatus] = React.useState<'active' | 'trial'>('active')
  const [trainerId, setTrainerId] = React.useState('')
  const [companyId, setCompanyId] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setPlanId(sellable[0]?.id ?? '')
    setHomeLocation('downtown')
    setStatus('active')
    setTrainerId('')
    setCompanyId('')
    // `sellable` is derived from the plan list, which only changes on hydrate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const plan = sellable.find((p) => p.id === planId)
  const needsCompany = plan?.corporateOnly === true && !companyId

  const emailLooksReal = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const valid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    emailLooksReal &&
    phone.trim().length >= 4 &&
    planId.length > 0 &&
    !needsCompany

  async function submit() {
    const result = await mutate(
      () =>
        api.ops.createMember.mutate({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          planId,
          homeLocation,
          status,
          assignedTrainerId: trainerId || null,
          companyId: companyId || null,
          tags: [],
        }),
      {
        success: (r) => ({
          title: `${r.name} added`,
          detail: `${plan?.name ?? 'Membership'} · ${money(plan?.price ?? 0)}/${plan?.interval === 'annual' ? 'yr' : plan?.interval === 'per-visit' ? 'visit' : 'mo'}`,
        }),
      },
    )
    if (result) {
      onClose()
      router.push(`/members/${result.id}`)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Add member"
      description="Creates the record for real. Visit history, credits and risk start empty and fill in as they use the studio."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid || busy} onClick={submit}>
            {busy ? 'Saving…' : 'Add member'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="am-first">
            <Input id="am-first" value={firstName} onChange={(e) => setFirstName(e.currentTarget.value)} autoFocus />
          </Field>
          <Field label="Last name" htmlFor="am-last">
            <Input id="am-last" value={lastName} onChange={(e) => setLastName(e.currentTarget.value)} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Email"
            htmlFor="am-email"
            help="Used for receipts and anything you send them from the app."
            error={email.length > 0 && !emailLooksReal ? 'That does not look like an email address.' : undefined}
          >
            <Input id="am-email" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
          </Field>
          <Field label="Phone" htmlFor="am-phone">
            <Input id="am-phone" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} placeholder="+91 98765 43210" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan" htmlFor="am-plan">
            <Select id="am-plan" value={planId} onChange={(e) => setPlanId(e.currentTarget.value)}>
              {sellable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {money(p.price)}
                  {p.interval === 'annual' ? '/yr' : p.interval === 'per-visit' ? ' a visit' : '/mo'}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Home location" htmlFor="am-loc">
            <Select
              id="am-loc"
              value={homeLocation}
              onChange={(e) => setHomeLocation(e.currentTarget.value as LocationId)}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starting status" htmlFor="am-status" help="A trial converts to active when they pay.">
            <Select id="am-status" value={status} onChange={(e) => setStatus(e.currentTarget.value as 'active' | 'trial')}>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
            </Select>
          </Field>
          <Field label="Assigned trainer" htmlFor="am-trainer" help="Optional — can be set later from the profile.">
            <Select id="am-trainer" value={trainerId} onChange={(e) => setTrainerId(e.currentTarget.value)}>
              <option value="">Nobody yet</option>
              {activeTrainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Company"
          htmlFor="am-company"
          help={
            plan?.corporateOnly
              ? 'Required — this plan is billed to a corporate pool, so it must name the pool it draws from.'
              : 'Optional — links them to a corporate pool.'
          }
          error={needsCompany ? `${plan?.name} is a corporate plan. Pick the company whose pool this draws from.` : undefined}
        >
          <Select id="am-company" value={companyId} onChange={(e) => setCompanyId(e.currentTarget.value)}>
            <option value="">Not a corporate member</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        {plan ? (
          <p className="text-micro leading-relaxed text-muted-foreground">
            Adds {money(plan.interval === 'annual' ? Math.round(plan.price / 12) : plan.price)}/mo to recurring
            revenue from today.{' '}
            {plan.visitsPerMonth === null
              ? 'Unlimited visits.'
              : `${plan.visitsPerMonth} visits a month, credited in full on joining.`}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
