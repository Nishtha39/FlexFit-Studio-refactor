'use client'

import * as React from 'react'
import { Eraser } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Member } from '@/lib/types'
import { fullDate } from '@/lib/format'
import { NOW } from '@/lib/seed'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/input'

/**
 * First-visit waiver capture at the door.
 *
 * Two things are deliberately non-negotiable here:
 *  1. The consent checkbox is separate from the signature. A drawn squiggle is
 *     not evidence that anyone read anything.
 *  2. The confirm button stays disabled until BOTH exist. No dark pattern where
 *     the signature pad auto-accepts on the first touch.
 */
export function WaiverCapture({
  open,
  member,
  onClose,
  onSigned,
}: {
  open: boolean
  member: Member
  onClose: () => void
  onSigned: () => void
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const drawing = React.useRef(false)
  const [hasMark, setHasMark] = React.useState(false)
  const [agreed, setAgreed] = React.useState(false)

  // Reset every time the sheet opens — a stale signature from the last member
  // sitting in the canvas would be a genuine liability problem.
  React.useEffect(() => {
    if (!open) return
    setHasMark(false)
    setAgreed(false)
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(ratio, ratio)
    ctx.clearRect(0, 0, rect.width, rect.height)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = getComputedStyle(canvas).color
  }, [open])

  const pointFrom = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const p = pointFrom(e)
    drawing.current = true
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const p = pointFrom(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    if (!hasMark) setHasMark(true)
  }

  const end = () => {
    drawing.current = false
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)
    setHasMark(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Health and liability waiver"
      description={`${member.name} · first visit on record`}
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>
            Not now
          </Button>
          <Button
            variant="primary"
            size="lg"
            disabled={!hasMark || !agreed}
            onClick={onSigned}
          >
            Save waiver and admit
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-subtle px-3 py-3 text-sm leading-relaxed text-muted-foreground scrollbar-thin">
          <p>
            I confirm I am physically able to take part in exercise at FlexFit Studio. I understand
            that strength and conditioning training carries a risk of injury, and that I take part
            voluntarily and at my own risk.
          </p>
          <p className="mt-2">
            I will tell a trainer about any injury, illness, pregnancy, heart condition or
            medication that could affect my training. I will stop and seek help if I feel unwell.
          </p>
          <p className="mt-2">
            I agree to follow staff instructions and gym rules. FlexFit Studio is not liable for
            loss or damage to personal property. I consent to first aid being administered if
            needed, and to emergency services being called on my behalf.
          </p>
          <p className="mt-2">
            This waiver is held on file against my membership record and applies to all future
            visits until I withdraw it in writing.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-surface px-3 py-2.5">
          <Checkbox
            checked={agreed}
            onChange={(e) => setAgreed(e.currentTarget.checked)}
            className="mt-1 size-4"
          />
          <span className="text-base leading-relaxed text-foreground">
            {member.firstName} has read the waiver above and agrees to it.
          </span>
        </label>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-micro font-medium tracking-wide text-muted-foreground uppercase">
              Signature
            </p>
            <Button variant="ghost" size="sm" onClick={clear} className="gap-1.5">
              <Eraser className="size-3.5" />
              Clear
            </Button>
          </div>
          <canvas
            ref={canvasRef}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            aria-label="Signature pad — sign with a finger or stylus"
            className={cn(
              'mt-1.5 h-32 w-full touch-none rounded-md border-2 bg-surface text-foreground',
              hasMark ? 'border-primary' : 'border-dashed border-border',
            )}
          />
          <p className="mt-1.5 text-micro text-muted-foreground">
            {hasMark
              ? `Signed ${fullDate(NOW)} · captured at the Downtown kiosk`
              : 'Sign inside the box with a finger or stylus.'}
          </p>
        </div>
      </div>
    </Modal>
  )
}
