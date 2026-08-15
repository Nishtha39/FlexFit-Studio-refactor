'use client'

import Image from 'next/image'
import { CalendarDays, GripVertical, MessageSquare, Repeat } from 'lucide-react'
import type { MemberRecord, MemberTag } from '@/lib/v2/domain/types'
import { cn } from '@/lib/v2/utils'

/** Tag styling. Only "Priority" gets the loud lime; the rest stay neutral. */
const TAG_STYLES: Record<MemberTag, string> = {
  'New lead': 'bg-brand-soft text-accent-foreground',
  Returning: 'bg-secondary text-muted-foreground',
  Priority: 'bg-lime text-ink',
  'Follow-up': 'bg-secondary text-muted-foreground',
}

interface MemberCardProps {
  member: MemberRecord
  dragging?: boolean
  onDragStart?: (event: React.DragEvent) => void
  onDragEnd?: () => void
  /** Moves the card one stage left (-1) or right (+1). Drives keyboard support. */
  onNudge?: (direction: -1 | 1) => void
}

export function MemberCard({
  member,
  dragging = false,
  onDragStart,
  onDragEnd,
  onNudge,
}: MemberCardProps) {
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onKeyDown={(event) => {
        // Arrow keys are the keyboard equivalent of dragging between columns.
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          onNudge?.(1)
        }
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          onNudge?.(-1)
        }
      }}
      tabIndex={0}
      aria-label={`${member.name}, ${member.tag}, in ${member.stage}. Use left and right arrow keys to change stage.`}
      className={cn(
        'group cursor-grab rounded-xl border border-border bg-card p-3.5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 active:cursor-grabbing',
        dragging
          ? 'rotate-1 opacity-40'
          : 'hover:border-brand/40 hover:shadow-[0_10px_24px_-16px_rgb(20_22_26_/_0.3)]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-medium',
            TAG_STYLES[member.tag],
          )}
        >
          {member.tag}
        </span>
        <GripVertical
          className="size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground"
          aria-hidden="true"
        />
      </div>

      <h3 className="mt-2.5 font-display text-sm font-semibold tracking-[-0.01em]">
        {member.name}
      </h3>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground text-pretty">
        {member.summary}
      </p>

      <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-border pt-3">
        <Image
          src={member.owner.avatar}
          alt={`Owner: ${member.owner.name}`}
          title={`${member.owner.name} · ${member.owner.role}`}
          width={22}
          height={22}
          className="size-[22px] rounded-full object-cover"
        />
        <ul className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <li className="flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {member.date}
          </li>
          <li className="flex items-center gap-1">
            <Repeat className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Sessions:</span>
            {member.sessions}
          </li>
          <li className="flex items-center gap-1">
            <MessageSquare className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Notes:</span>
            {member.notes}
          </li>
        </ul>
      </div>
    </article>
  )
}
