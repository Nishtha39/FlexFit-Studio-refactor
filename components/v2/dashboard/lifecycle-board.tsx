'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { MEMBERS, STAGES } from '@/lib/v2/data/dashboard'
import type { MemberRecord, MemberStage } from '@/lib/v2/domain/types'
import { cn } from '@/lib/v2/utils'
import { MemberCard } from './member-card'

/**
 * The member lifecycle board.
 *
 * Owns the only mutable state on the dashboard: which stage each member sits
 * in. Cards move between columns via native HTML5 drag and drop, so no drag
 * library is needed. Swapping `MEMBERS` for a tRPC query means seeding this
 * state from the query result and firing a mutation inside `moveMember`.
 */
export function LifecycleBoard() {
  const [members, setMembers] = useState<MemberRecord[]>(MEMBERS)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hoveredStage, setHoveredStage] = useState<MemberStage | null>(null)

  function moveMember(id: string, stage: MemberStage) {
    setMembers((current) =>
      current.map((member) => (member.id === id ? { ...member, stage } : member)),
    )
  }

  function handleDrop(event: React.DragEvent, stage: MemberStage) {
    // Prefer the id carried on the event so a drop still works if state was
    // lost; fall back to the tracked id for browsers that withhold the payload.
    const id = event.dataTransfer.getData('text/plain') || draggingId
    if (id) moveMember(id, stage)
    setDraggingId(null)
    setHoveredStage(null)
  }

  /** Keyboard equivalent of a drag: shift a member one column left or right. */
  function nudgeMember(id: string, stage: MemberStage, direction: -1 | 1) {
    const index = STAGES.findIndex((entry) => entry.id === stage)
    const next = STAGES[index + direction]
    if (next) moveMember(id, next.id)
  }

  return (
    <section aria-label="Member lifecycle">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {STAGES.map((stage) => {
          const column = members.filter((member) => member.stage === stage.id)
          const isTarget = hoveredStage === stage.id && draggingId !== null

          return (
            <div
              key={stage.id}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                setHoveredStage(stage.id)
              }}
              onDragLeave={() => setHoveredStage(null)}
              onDrop={(event) => handleDrop(event, stage.id)}
              className={cn(
                'flex flex-col gap-3 rounded-2xl p-2 transition-colors',
                isTarget ? 'bg-brand-soft/70' : 'bg-transparent',
              )}
            >
              <header className="flex items-center justify-between gap-2 px-1.5 pt-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-base font-semibold tracking-[-0.015em]">
                    {stage.label}
                  </h2>
                  <span className="grid size-5 place-items-center rounded-full bg-ink text-[10px] font-medium text-ink-foreground">
                    {column.length}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label={`Add member to ${stage.label}`}
                  className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </header>

              <div className="flex flex-col gap-3">
                {column.map((member) => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    dragging={draggingId === member.id}
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', member.id)
                      event.dataTransfer.effectAllowed = 'move'
                      setDraggingId(member.id)
                    }}
                    onDragEnd={() => {
                      setDraggingId(null)
                      setHoveredStage(null)
                    }}
                    onNudge={(direction) =>
                      nudgeMember(member.id, member.stage, direction)
                    }
                  />
                ))}

                {column.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                    Drop a member here
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
