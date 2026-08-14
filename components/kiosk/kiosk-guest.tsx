'use client'

import * as React from 'react'
import { Ticket, UserPlus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { money } from '@/lib/format'
import { Modal, ConsequenceNotice } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/input'
import { plans } from '@/lib/data/plans'
import { lookup } from './kiosk-engine'

/**
 * Two distinct door sales, deliberately not merged into one form:
 *
 *  - GUEST OF A MEMBER: free, but it consumes the host's guest pass, so the host
 *    must be named. Anonymous free entry is how gyms lose track of who is inside
 *    during a fire drill.
 *  - PAID DAY PASS: a real sale. Method is captured because the cash drawer has
 *    to reconcile at close.
 */

type Mode = 'guest-of-member' | 'day-pass'

const DAY_PASS = plans.find((p) => p.id === 'plan-dropin')!

export function KioskGuestDialog({
  open,
  onClose,
  onComplete,
  initialMode = 'day-pass',
}: {
  open: boolean
  onClose: () => void
  onComplete: (name: string, amount: number | null) => void
  initialMode?: Mode
}) {
  const [mode, setMode] = React.useState<Mode>(initialMode)
  const [name, setName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [host, setHost] = React.useState('')
  const [method, setMethod] = React.useState('card')

  React.useEffect(() => {
    if (!open) return
    setMode(initialMode)
    setName('')
    setPhone('')
    setHost('')
    setMethod('card')
  }, [open, initialMode])

  const hostMatches = React.useMemo(() => (host.length > 1 ? lookup(host, 4) : []), [host])
  const hostPicked = hostMatches.length === 1 && hostMatches[0].name === host

  const valid =
    name.trim().length > 1 && (mode === 'day-pass' ? phone.replace(/\D/g, '').length >= 6 : hostPicked)

  const submit = () => {
    if (!valid) return
    onComplete(name, mode === 'day-pass' ? DAY_PASS.price : null)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Visitor check-in"
      description="No membership on file. Record who is in the building."
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="lg" disabled={!valid} onClick={submit}>
            {mode === 'day-pass' ? `Take ${money(DAY_PASS.price)} and admit` : 'Admit as guest'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <ModeCard
            active={mode === 'day-pass'}
            onClick={() => setMode('day-pass')}
            icon={Ticket}
            title="Paid day pass"
            detail={`${money(DAY_PASS.price)} · full floor access and one group class`}
          />
          <ModeCard
            active={mode === 'guest-of-member'}
            onClick={() => setMode('guest-of-member')}
            icon={Users}
            title="Guest of a member"
            detail="Free · uses one of the host's monthly guest passes"
          />
        </div>

        <Field label="Visitor name" htmlFor="guest-name">
          <Input
            id="guest-name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Full name"
            className="h-11 text-base"
            autoComplete="off"
          />
        </Field>

        {mode === 'day-pass' ? (
          <>
            <Field
              label="Mobile number"
              htmlFor="guest-phone"
              help="Needed for the receipt and the waiver record."
            >
              <Input
                id="guest-phone"
                value={phone}
                onChange={(e) => setPhone(e.currentTarget.value)}
                placeholder="+91 98200 00000"
                inputMode="tel"
                className="h-11 text-base"
                autoComplete="off"
              />
            </Field>
            <Field label="Payment method" htmlFor="guest-method">
              <Select
                id="guest-method"
                value={method}
                onChange={(e) => setMethod(e.currentTarget.value)}
                className="h-11 text-base"
              >
                <option value="card">Card · terminal</option>
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
              </Select>
            </Field>
            <ConsequenceNotice
              tone="info"
              headline={`${money(DAY_PASS.price)} will be charged now`}
              detail="A day pass is single-use and expires at close today. It does not carry over and is not refundable once the door is released."
            />
          </>
        ) : (
          <>
            <Field
              label="Host member"
              htmlFor="guest-host"
              help="Type the member's name and pick them from the list."
            >
              <Input
                id="guest-host"
                value={host}
                onChange={(e) => setHost(e.currentTarget.value)}
                placeholder="Search members"
                className="h-11 text-base"
                autoComplete="off"
              />
            </Field>
            {hostMatches.length > 0 && !hostPicked ? (
              <ul className="flex flex-col gap-1">
                {hostMatches.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setHost(m.name)}
                      className="flex h-11 w-full items-center gap-3 rounded-md border border-border bg-surface px-3 text-left text-base transition-colors hover:border-border-strong hover:bg-muted"
                    >
                      <span className="font-medium text-foreground">{m.name}</span>
                      <span className="ml-auto text-sm text-muted-foreground">
                        {m.phone.slice(-4)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {hostPicked ? (
              <ConsequenceNotice
                tone="warn"
                headline={`This uses one of ${host.split(' ')[0]}'s guest passes`}
                detail="Standard includes 1 per month, Unlimited includes 2. If none are left, the visitor needs a paid day pass instead."
              />
            ) : null}
          </>
        )}
      </div>
    </Modal>
  )
}

function ModeCard({
  active,
  onClick,
  icon: Icon,
  title,
  detail,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  title: string
  detail: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-col gap-1 rounded-md border-2 px-3 py-3 text-left transition-colors duration-150',
        active ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:border-border-strong',
      )}
    >
      <span className="flex items-center gap-2">
        <Icon className={cn('size-4', active ? 'text-primary' : 'text-muted-foreground')} />
        <span className="text-base font-semibold text-foreground">{title}</span>
      </span>
      <span className="text-sm leading-relaxed text-muted-foreground">{detail}</span>
    </button>
  )
}

/** Small entry point rendered on the kiosk idle screen. */
export function GuestEntryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 items-center gap-2 rounded-md border border-border bg-surface px-4 text-base font-medium text-secondary-foreground transition-colors duration-150 hover:border-border-strong hover:bg-muted"
    >
      <UserPlus className="size-4 text-muted-foreground" />
      Visiting today?
    </button>
  )
}
