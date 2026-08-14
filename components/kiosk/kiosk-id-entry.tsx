'use client'

import * as React from 'react'
import { Delete, QrCode, ScanLine } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Member } from '@/lib/types'
import { members } from '@/lib/data/members'
import { pinFor, resolveScan } from './kiosk-engine'

/**
 * 4-digit PIN pad + QR scan. A numeric pad IS worth rendering on-screen
 * (unlike a full keyboard) — 10 large targets, no reading required, and it is
 * the fallback when a member forgets their phone.
 */

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const

export function KioskIdEntry({ onResolved }: { onResolved: (member: Member) => void }) {
  const [pin, setPin] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [scanning, setScanning] = React.useState(false)

  const submit = React.useCallback(
    (value: string) => {
      const found = resolveScan(value)
      if (found) {
        setPin('')
        setError(null)
        onResolved(found)
      } else {
        setError(`No membership matches ${value}. Check the 4 digits, or search by name instead.`)
        setPin('')
      }
    },
    [onResolved],
  )

  // Auto-submit on the 4th digit — nobody should have to find a submit button.
  React.useEffect(() => {
    if (pin.length === 4) {
      const t = window.setTimeout(() => submit(pin), 180)
      return () => window.clearTimeout(t)
    }
  }, [pin, submit])

  const press = (key: (typeof KEYS)[number]) => {
    setError(null)
    if (key === 'clear') return setPin('')
    if (key === 'back') return setPin((p) => p.slice(0, -1))
    setPin((p) => (p.length >= 4 ? p : p + key))
  }

  // Physical keypads exist on real kiosks; honour them.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key as (typeof KEYS)[number])
      if (e.key === 'Backspace') press('back')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /** Simulates a QR badge scan — picks a real member so the demo is honest. */
  const simulateScan = () => {
    setScanning(true)
    setError(null)
    const target = members[(Date.now() % members.length + members.length) % members.length]
    window.setTimeout(() => {
      setScanning(false)
      onResolved(target)
    }, 900)
  }

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
      {/* PIN pad */}
      <div className="flex flex-1 flex-col gap-4">
        <div>
          <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Member PIN
          </p>
          <div className="mt-2 flex gap-2" aria-live="polite" aria-label={`${pin.length} of 4 digits entered`}>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  'flex h-14 flex-1 items-center justify-center rounded-md border-2 text-xl font-semibold tnum',
                  pin.length > i
                    ? 'border-primary bg-primary-soft text-foreground'
                    : 'border-border bg-surface text-muted-foreground/40',
                )}
              >
                {pin[i] ? '•' : ''}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              aria-label={key === 'back' ? 'Delete last digit' : key === 'clear' ? 'Clear' : key}
              className={cn(
                'flex h-14 items-center justify-center rounded-md border text-xl font-medium',
                'transition-colors duration-150 ease-[var(--ease-ui)] active:bg-muted',
                key === 'clear' || key === 'back'
                  ? 'border-border bg-subtle text-muted-foreground hover:text-foreground'
                  : 'border-border bg-surface text-foreground hover:border-border-strong',
              )}
            >
              {key === 'back' ? (
                <Delete className="size-5" />
              ) : key === 'clear' ? (
                <span className="text-base">Clear</span>
              ) : (
                key
              )}
            </button>
          ))}
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-base leading-relaxed text-danger"
          >
            {error}
          </p>
        ) : null}
      </div>

      {/* QR scanner */}
      <div className="flex flex-1 flex-col gap-3">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Or scan your badge
        </p>
        <button
          type="button"
          onClick={simulateScan}
          disabled={scanning}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10',
            'transition-colors duration-150 ease-[var(--ease-ui)]',
            scanning
              ? 'border-primary bg-primary-soft'
              : 'border-border bg-subtle hover:border-border-strong',
          )}
        >
          {scanning ? (
            <>
              <ScanLine className="size-10 animate-pulse text-primary" />
              <span className="text-lg font-medium text-foreground">Reading badge…</span>
            </>
          ) : (
            <>
              <QrCode className="size-10 text-muted-foreground" />
              <span className="text-lg font-medium text-foreground">Hold your QR code here</span>
              <span className="max-w-56 text-center text-sm leading-relaxed text-muted-foreground">
                In the FlexFit app, tap Membership. Tap here to simulate a scan.
              </span>
            </>
          )}
        </button>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Forgot your PIN? Ask the front desk — it is the last 4 digits shown on your membership
          card. Example: {members[0].name} is {pinFor(members[0].id)}.
        </p>
      </div>
    </div>
  )
}
