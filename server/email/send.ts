/**
 * Real outbound email, via Resend.
 *
 * Resend is a plain HTTPS API, which is the whole reason it fits: a Worker has
 * no sockets, so an SMTP client cannot run here at all. One `fetch` to
 * `api.resend.com/emails` is the entire integration — no SDK, no bundle weight,
 * nothing to keep in step with the runtime.
 *
 * **Configuration is a Worker secret, not code.** Setting it up is:
 *
 *     npx wrangler secret put RESEND_API_KEY      # re_...
 *     npx wrangler secret put EMAIL_FROM          # "FlexFit Studio <hello@yourdomain.com>"
 *
 * `EMAIL_FROM` must be an address on a domain verified in the Resend dashboard.
 * Until a domain is verified, Resend accepts `onboarding@resend.dev` as the
 * sender but will only deliver to the account owner's own address — which is
 * enough to prove the pipeline end to end, and is why `sendTest` exists.
 *
 * **Not configured is reported, never faked.** If the key is missing this
 * returns a refusal that names the missing variable and the command that sets
 * it. The failure mode being avoided is the one that wasted a day on the TURN
 * credentials elsewhere in this workspace: an integration that fails soft, logs
 * nothing, and looks exactly like a working one that nobody is receiving mail
 * from.
 */

export interface EmailAddress {
  email: string
  name?: string
}

export interface EmailMessage {
  to: EmailAddress[]
  subject: string
  /** Plain text. The HTML part is generated from it — see `wrap()`. */
  text: string
  replyTo?: string
}

export type SendResult =
  | { ok: true; id: string; provider: 'resend'; to: string[] }
  | { ok: false; reason: 'not-configured' | 'rejected' | 'network'; message: string }

export interface EmailEnv {
  RESEND_API_KEY?: string
  EMAIL_FROM?: string
  EMAIL_REPLY_TO?: string
}

const ENDPOINT = 'https://api.resend.com/emails'

/** Resend's own test sender. Delivers only to the account owner, but proves the key. */
const FALLBACK_FROM = 'FlexFit Studio <onboarding@resend.dev>'

export function isConfigured(env: EmailEnv): boolean {
  return typeof env.RESEND_API_KEY === 'string' && env.RESEND_API_KEY.length > 0
}

/**
 * What the settings screen shows about the mail setup. Deliberately reports the
 * sender and whether a key is present, and deliberately never returns the key.
 */
export function emailStatus(env: EmailEnv): {
  configured: boolean
  from: string
  usingFallbackSender: boolean
  replyTo: string | null
} {
  const from = env.EMAIL_FROM?.trim() || FALLBACK_FROM
  return {
    configured: isConfigured(env),
    from,
    usingFallbackSender: from === FALLBACK_FROM,
    replyTo: env.EMAIL_REPLY_TO?.trim() || null,
  }
}

function formatAddress(a: EmailAddress): string {
  return a.name ? `${a.name} <${a.email}>` : a.email
}

/**
 * Minimal HTML wrapper. Inline styles only — every mail client strips <style>,
 * and a bare text/plain body lands in spam far more often than a text+html pair.
 */
function wrap(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6">${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
  return [
    '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;',
    'font-size:15px;color:#1a1d24;max-width:560px;margin:0 auto;padding:24px">',
    paragraphs,
    '<hr style="border:none;border-top:1px solid #e4e6eb;margin:24px 0 12px">',
    '<p style="margin:0;font-size:12px;color:#6b7280">FlexFit Studio</p>',
    '</div>',
  ].join('')
}

/**
 * Send one message to one or more recipients.
 *
 * Every recipient is in the `to` array, which means they can see each other —
 * fine for a single member, wrong for a broadcast. `sendBroadcast` in the comms
 * router fans out one message per recipient for exactly that reason.
 */
export async function sendEmail(env: EmailEnv, message: EmailMessage): Promise<SendResult> {
  if (!isConfigured(env)) {
    return {
      ok: false,
      reason: 'not-configured',
      message:
        'No RESEND_API_KEY is bound to this Worker, so nothing was sent. Set it with `npx wrangler secret put RESEND_API_KEY` (and EMAIL_FROM for your own verified domain).',
    }
  }
  if (message.to.length === 0) {
    return { ok: false, reason: 'rejected', message: 'No recipient address.' }
  }

  const { from } = emailStatus(env)
  const replyTo = message.replyTo ?? env.EMAIL_REPLY_TO?.trim() ?? undefined

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: message.to.map(formatAddress),
        subject: message.subject,
        text: message.text,
        html: wrap(message.text),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    })

    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string }

    if (!res.ok) {
      // Resend's errors are specific and worth surfacing verbatim — "domain is
      // not verified" and "invalid api key" need different fixes, and a generic
      // "send failed" would hide which one it is.
      return {
        ok: false,
        reason: 'rejected',
        message: body.message ?? `Resend returned ${res.status}.`,
      }
    }

    return { ok: true, id: body.id ?? 'unknown', provider: 'resend', to: message.to.map((t) => t.email) }
  } catch (e) {
    return {
      ok: false,
      reason: 'network',
      message: e instanceof Error ? e.message : 'The request to Resend failed.',
    }
  }
}
