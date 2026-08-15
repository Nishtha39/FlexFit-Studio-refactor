'use client'

import * as React from 'react'
import { api } from '@/lib/api/client'
import { useStudio } from '@/lib/store/studio-store'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Field, Input, Textarea } from '@/components/ui/input'
import { ConsequenceNotice, Modal } from '@/components/ui/modal'

export interface EmailTemplate {
  label: string
  subject: string
  body: string
}

/**
 * One compose box, used by every "Email …" button in the app — member, lead,
 * trainer, corporate contact.
 *
 * The caller supplies the recipient and the send call; everything that has to
 * be right about outbound mail lives here once. In particular the dialog asks
 * whether mail is configured *before* showing the box, because letting somebody
 * write two hundred words and then failing on send is the worst version of this
 * screen — and the notice names the exact command that fixes it.
 */
export function ComposeEmailDialog({
  open,
  onClose,
  to,
  toName,
  title,
  templates = [],
  send,
}: {
  open: boolean
  onClose: () => void
  /** Shown so the operator can see where it is actually going. */
  to: string
  toName: string
  title: string
  templates?: EmailTemplate[]
  send: (input: { subject: string; body: string }) => Promise<unknown>
}) {
  const { mutate, busy, connection } = useStudio()
  const [subject, setSubject] = React.useState('')
  const [body, setBody] = React.useState('')
  const [mailReady, setMailReady] = React.useState<{ configured: boolean; from: string } | null>(null)

  React.useEffect(() => {
    if (!open) return
    setSubject(templates[0]?.subject ?? '')
    setBody(templates[0]?.body ?? '')
    if (connection === 'live') {
      api.comms.emailStatus
        .query()
        .then((s) => setMailReady({ configured: s.configured, from: s.from }))
        .catch(() => setMailReady(null))
    }
    // Templates are literals rebuilt each render; keying on `open` is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, connection])

  async function submit() {
    const result = await mutate(() => send({ subject: subject.trim(), body: body.trim() }), {
      success: () => ({ title: `Email sent to ${toName}`, detail: to }),
    })
    if (result) onClose()
  }

  const valid = subject.trim().length > 0 && body.trim().length > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={title}
      description={to}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid || busy} onClick={submit}>
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

        {templates.length > 1 ? (
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
        ) : null}

        <Field label="Subject" htmlFor="compose-subject">
          <Input
            id="compose-subject"
            value={subject}
            onChange={(e) => setSubject(e.currentTarget.value)}
          />
        </Field>
        <Field label="Message" htmlFor="compose-body">
          <Textarea
            id="compose-body"
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
 * A `tel:` link dressed as a button.
 *
 * "Call" cannot be more than this from a web app — the browser hands the number
 * to whatever the device uses for calls. Making it a real link means it works
 * on a phone at the desk and degrades to nothing worse than a copyable number
 * on a laptop, which is strictly better than a button that did nothing at all.
 */
export function CallLink({
  phone,
  children,
  className,
}: {
  phone: string
  children: React.ReactNode
  className?: string
}) {
  // `Button` renders a real <button> and has no `asChild`, so the anchor takes
  // the variant classes directly rather than being nested inside one.
  return (
    <a
      href={`tel:${phone.replace(/[^\d+]/g, '')}`}
      className={cn(buttonVariants({ variant: 'secondary', size: 'xs' }), className)}
    >
      {children}
    </a>
  )
}
