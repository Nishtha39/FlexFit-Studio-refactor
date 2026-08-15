'use client'

import * as React from 'react'
import { CheckCircle2, Send, XCircle } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useStudio } from '@/lib/store/studio-store'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/input'
import { StatusChip } from '@/components/ui/status-chip'
import { ConsequenceNotice } from '@/components/ui/modal'

/**
 * Email configuration — read-only, plus a test send.
 *
 * The fields are deliberately not editable here. An API key typed into a form
 * has to be stored somewhere, and the only place this app could put it is the
 * database it serves to every browser through `read.bootstrap`. It lives as a
 * Worker secret instead, which is why this screen reports the configuration
 * rather than setting it.
 *
 * The test send is the part that matters. "Is email set up?" cannot be answered
 * by looking at a key — the key can be valid while the sender domain is
 * unverified, which fails only at send time. Sending one real message is the
 * only honest check, so that is the button.
 */
export function EmailSettingsCard() {
  const { mutate, busy, connection } = useStudio()
  const [status, setStatus] = React.useState<{
    configured: boolean
    from: string
    usingFallbackSender: boolean
    replyTo: string | null
  } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [testTo, setTestTo] = React.useState('')

  React.useEffect(() => {
    if (connection !== 'live') {
      setLoading(false)
      return
    }
    api.comms.emailStatus
      .query()
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false))
  }, [connection])

  async function sendTest() {
    await mutate(() => api.comms.sendTest.mutate({ to: testTo.trim() }), {
      success: (r) => ({
        title: `Test email sent to ${r.to}`,
        detail: r.usingFallbackSender
          ? 'Sent from Resend’s shared sender — it only reaches the Resend account owner.'
          : `Sent from ${r.from}. Check the inbox.`,
      }),
    })
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Outbound email"
          description="Member messages, staff messages and broadcasts all send through this."
          actions={
            loading ? null : status?.configured ? (
              <StatusChip tone="good" label="Configured" />
            ) : (
              <StatusChip tone="danger" label="Not configured" />
            )
          }
        />
        <CardBody className="flex flex-col gap-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Checking…</p>
          ) : connection !== 'live' ? (
            <ConsequenceNotice
              tone="warn"
              headline="Cannot check — the API is unreachable"
              detail="This build is running off the built-in sample data. Run `pnpm preview`, or open the deployed site, to see the real mail configuration."
            />
          ) : !status?.configured ? (
            <>
              <ConsequenceNotice
                tone="danger"
                headline="No email will be sent"
                detail="No RESEND_API_KEY is bound to this Worker. Every send will refuse with that message rather than silently doing nothing."
              />
              <SetupSteps />
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Readout label="Provider" value="Resend" />
                <Readout label="Sends as" value={status.from} mono />
                <Readout label="Reply-to" value={status.replyTo ?? 'Not set — replies go to the sender'} mono />
                <Readout
                  label="Delivery"
                  value={status.usingFallbackSender ? 'Account owner only' : 'Any recipient'}
                />
              </div>
              {status.usingFallbackSender ? (
                <ConsequenceNotice
                  tone="warn"
                  headline="Using Resend’s shared onboarding sender"
                  detail="It delivers only to the email address that owns the Resend account, so member mail will not arrive. Verify your own domain in the Resend dashboard and set EMAIL_FROM to an address on it."
                />
              ) : null}
            </>
          )}
        </CardBody>
        <CardFooter>
          <span>The key is never read back into the browser — this screen only reports whether one is present.</span>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader
          title="Send a test"
          description="The only real proof. A key can be valid while the sender domain is not, and that fails at send time."
        />
        <CardBody className="flex flex-wrap items-end gap-3">
          <Field label="Send to" htmlFor="test-to" className="min-w-64 flex-1">
            <Input
              id="test-to"
              type="email"
              placeholder="you@example.com"
              value={testTo}
              onChange={(e) => setTestTo(e.currentTarget.value)}
            />
          </Field>
          <Button
            variant="primary"
            disabled={busy || !testTo.includes('@') || connection !== 'live'}
            onClick={sendTest}
          >
            <Send className="size-3.5" />
            {busy ? 'Sending…' : 'Send test email'}
          </Button>
        </CardBody>
        <CardFooter>
          <span>
            Success and failure are both written to the event log, so &quot;did we actually email them?&quot; has
            an answer later.
          </span>
        </CardFooter>
      </Card>
    </>
  )
}

function Readout({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-micro font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className={mono ? 'text-sm font-mono text-foreground' : 'text-sm text-foreground'}>{value}</span>
    </div>
  )
}

function SetupSteps() {
  const steps = [
    {
      done: false,
      text: 'Create a free Resend account and an API key at resend.com/api-keys (3,000 emails a month, no card).',
    },
    {
      done: false,
      text: 'Bind the key to the Worker:',
      code: 'npx wrangler secret put RESEND_API_KEY',
    },
    {
      done: false,
      text: 'To reach anyone other than yourself, verify a domain in Resend, then set the sender:',
      code: 'npx wrangler secret put EMAIL_FROM\n# FlexFit Studio <hello@yourdomain.com>',
    },
    {
      done: false,
      text: 'Redeploy, then use the test above. Until a domain is verified, Resend delivers only to the account owner.',
    },
  ]
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            aria-hidden
            className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border text-micro font-medium text-muted-foreground tnum"
          >
            {i + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm leading-relaxed text-foreground">{s.text}</span>
            {s.code ? (
              <code className="mt-1.5 block overflow-x-auto rounded-sm border border-border bg-subtle px-2 py-1.5 font-mono text-micro whitespace-pre text-muted-foreground">
                {s.code}
              </code>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  )
}

export { CheckCircle2, XCircle }
