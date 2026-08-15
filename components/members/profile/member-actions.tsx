'use client'

import * as React from 'react'
import { api } from '@/lib/api/client'
import { useStudio } from '@/lib/store/studio-store'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { ConsequenceNotice, Modal } from '@/components/ui/modal'
import { StatusChip } from '@/components/ui/status-chip'
import { money } from '@/lib/format'
import { getPlan } from '@/lib/data/plans'
import type { Member, PaymentMethod } from '@/lib/types'

/**
 * The three actions on a member profile that used to be decorative.
 *
 * All three now write to the database and re-read afterwards, so the facts
 * strip above them (status, lifetime value, monthly value) moves in the same
 * tick — a "payment taken" toast over an unchanged lifetime-value figure is
 * exactly the sort of disagreement this is meant to end.
 */

/** Message — a real email, sent through Resend. */
export function MessageMemberDialog({
  open,
  onClose,
  member,
}: {
  open: boolean
  onClose: () => void
  member: Member
}) {
  const { mutate, busy, connection } = useStudio()
  const [subject, setSubject] = React.useState('')
  const [body, setBody] = React.useState('')
  const [mailReady, setMailReady] = React.useState<{ configured: boolean; from: string } | null>(null)

  React.useEffect(() => {
    if (!open) return
    setSubject('')
    setBody('')
    // Ask before showing the compose box whether mail can actually go out. It
    // is better to say "no key is set" up front than to let someone write 200
    // words and then fail on send.
    if (connection === 'live') {
      api.comms.emailStatus
        .query()
        .then((s) => setMailReady({ configured: s.configured, from: s.from }))
        .catch(() => setMailReady(null))
    }
  }, [open, connection])

  const templates = [
    {
      label: 'Check in on them',
      subject: `We have missed you at FlexFit, ${member.firstName}`,
      body: `Hi ${member.firstName},\n\nWe noticed you have not been in for a little while and wanted to check everything is alright.\n\nIf there is a class time that would suit you better, or you would like a session with one of our trainers to get going again, just reply to this email and we will sort it out.\n\nSee you soon,\nFlexFit Studio`,
    },
    {
      label: 'Payment reminder',
      subject: 'A quick note about your FlexFit membership payment',
      body: `Hi ${member.firstName},\n\nOur last attempt to collect your membership payment did not go through. It is usually an expired card and takes a moment to fix.\n\nYou can update your details at the front desk or reply here and we will send you a secure link.\n\nThanks,\nFlexFit Studio`,
    },
    {
      label: 'Blank',
      subject: '',
      body: `Hi ${member.firstName},\n\n\n\nFlexFit Studio`,
    },
  ]

  async function send() {
    const result = await mutate(
      () =>
        api.comms.emailMember.mutate({
          memberId: member.id,
          subject: subject.trim(),
          body: body.trim(),
        }),
      {
        success: (r) => ({ title: `Email sent to ${r.name}`, detail: r.to }),
      },
    )
    if (result) onClose()
  }

  const valid = subject.trim().length > 0 && body.trim().length > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Email ${member.name}`}
      description={member.email}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid || busy} onClick={send}>
            {busy ? 'Sending…' : 'Send email'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {mailReady && !mailReady.configured ? (
          <ConsequenceNotice
            tone="danger"
            headline="Outbound email is not configured"
            detail="No RESEND_API_KEY is bound to this Worker, so sending will fail. Set it with `npx wrangler secret put RESEND_API_KEY` and add EMAIL_FROM for your verified domain."
          />
        ) : mailReady ? (
          <p className="text-micro text-muted-foreground">
            Sends for real, from <span className="font-mono">{mailReady.from}</span>.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {templates.map((t) => (
            <Button
              key={t.label}
              size="xs"
              variant="secondary"
              onClick={() => {
                setSubject(t.subject)
                setBody(t.body)
              }}
            >
              {t.label}
            </Button>
          ))}
        </div>

        <Field label="Subject" htmlFor="msg-subject">
          <Input id="msg-subject" value={subject} onChange={(e) => setSubject(e.currentTarget.value)} />
        </Field>
        <Field label="Message" htmlFor="msg-body">
          <Textarea
            id="msg-body"
            className="min-h-52"
            value={body}
            onChange={(e) => setBody(e.currentTarget.value)}
          />
        </Field>
      </div>
    </Modal>
  )
}

/**
 * Freeze / cancel / reactivate.
 *
 * One dialog for all three because they are the same decision with different
 * consequences, and the consequence is what the operator needs before pressing
 * the button — the revenue paused, the door access revoked, whether the credits
 * survive.
 */
export function MemberStatusDialog({
  open,
  onClose,
  member,
  target,
}: {
  open: boolean
  onClose: () => void
  member: Member
  target: Member['status']
}) {
  const { mutate, busy } = useStudio()
  const m = member.metrics

  const copy: Record<string, { title: string; confirm: string; consequence: string; tone: 'danger' | 'warn' | 'good' }> = {
    frozen: {
      title: `Freeze ${member.name}`,
      confirm: 'Freeze membership',
      consequence: `Billing stops and door access is revoked immediately — ${money(m.monthlyValue)} of monthly revenue is paused.`,
      tone: 'danger',
    },
    cancelled: {
      title: `Cancel ${member.name}`,
      confirm: 'Cancel membership',
      consequence: `This ends the membership today and removes ${money(m.monthlyValue)} from recurring revenue. Tenure and history are kept, but the member leaves the retention pool.`,
      tone: 'danger',
    },
    active: {
      title: `Reactivate ${member.name}`,
      confirm: 'Reactivate membership',
      consequence: `Billing restarts on the next cycle and ${money(m.monthlyValue)} returns to recurring revenue.`,
      tone: 'good',
    },
  }
  const c = copy[target] ?? copy.frozen

  async function confirm() {
    const result = await mutate(
      () => api.ops.setMemberStatus.mutate({ memberId: member.id, status: target }),
      {
        success: () => ({
          title: `${member.name} — ${target}`,
          detail:
            target === 'active'
              ? `${money(m.monthlyValue)}/mo resumed`
              : `${money(m.monthlyValue)}/mo paused`,
        }),
      },
    )
    if (result) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={c.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-autofocus
            variant={target === 'active' ? 'primary' : 'danger'}
            disabled={busy}
            onClick={confirm}
          >
            {busy ? 'Saving…' : c.confirm}
          </Button>
        </>
      }
    >
      <ConsequenceNotice tone={c.tone} headline={c.consequence} />
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {target === 'frozen' && m.creditsRemaining !== null && m.creditsRemaining > 0
          ? `${m.creditsRemaining} unused credits are retained and will be available on unfreeze.`
          : target === 'frozen'
            ? 'Tenure and history are retained. Unfreezing restarts billing on the next cycle date.'
            : 'This is recorded on the member’s timeline and is reversible from this screen.'}
      </p>
      {target === 'frozen' ? (
        <p className="mt-2 text-micro text-muted-foreground">
          Freezes are counted: this will be freeze #{m.freezeCount + 1}, and the churn-risk model weighs how
          often someone has paused.
        </p>
      ) : null}
    </Modal>
  )
}

/** Take payment at the desk. Appends to the ledger — nothing is edited. */
export function TakePaymentDialog({
  open,
  onClose,
  member,
}: {
  open: boolean
  onClose: () => void
  member: Member
}) {
  const { mutate, busy } = useStudio()
  const plan = getPlan(member.planId)
  const [amount, setAmount] = React.useState(0)
  const [method, setMethod] = React.useState<PaymentMethod>('upi')
  const [description, setDescription] = React.useState('')
  const [againstPlan, setAgainstPlan] = React.useState(true)

  React.useEffect(() => {
    if (!open) return
    setAmount(plan?.price ?? member.metrics.monthlyValue)
    setMethod('upi')
    setAgainstPlan(true)
    setDescription(plan ? `${plan.name} — membership dues` : 'Membership dues')
  }, [open, plan, member.metrics.monthlyValue])

  async function submit() {
    const result = await mutate(
      () =>
        api.ops.takePayment.mutate({
          memberId: member.id,
          amount,
          method,
          description: description.trim(),
          planId: againstPlan ? member.planId : null,
        }),
      {
        success: (p) => ({
          title: `${money(p.amount)} taken from ${member.name}`,
          detail: `${p.invoiceId} · ${p.method}`,
        }),
      },
    )
    if (result) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Take payment — ${member.name}`}
      description="Appended to the ledger. Refunds add a reversing row later; nothing here is ever edited."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={amount <= 0 || description.trim().length === 0 || busy} onClick={submit}>
            {busy ? 'Recording…' : `Take ${money(amount)}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <StatusChip tone="info" label={plan?.name ?? 'No plan'} />
          {plan ? <span className="text-micro text-muted-foreground">List price {money(plan.price)}</span> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (₹)" htmlFor="pay-amount">
            <Input
              id="pay-amount"
              type="number"
              min={1}
              className="tnum"
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Number(e.currentTarget.value) || 0))}
            />
          </Field>
          <Field label="Method" htmlFor="pay-method">
            <Select
              id="pay-method"
              value={method}
              onChange={(e) => setMethod(e.currentTarget.value as PaymentMethod)}
            >
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="cash">Cash</option>
              <option value="transfer">Bank transfer</option>
            </Select>
          </Field>
        </div>

        <Field label="Description" htmlFor="pay-desc" help="Shows on the invoice and in the ledger.">
          <Input id="pay-desc" value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
        </Field>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={againstPlan}
            onChange={(e) => setAgainstPlan(e.currentTarget.checked)}
            className="size-3.5 accent-[var(--color-primary)]"
          />
          Bill against {plan?.name ?? 'their plan'}
        </label>
        <p className="-mt-2 text-micro text-muted-foreground">
          Unticked, this is an ad-hoc charge — a day pass, a PT block, kit — and it will not be counted as plan
          revenue in the revenue-by-plan report.
        </p>
      </div>
    </Modal>
  )
}
