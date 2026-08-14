'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MemberStatus, RiskScore } from '@/components/ui/status-chip'
import { Checkbox } from '@/components/ui/input'
import type { Member } from '@/lib/types'
import { compactMoney, daysAgo, num } from '@/lib/format'
import { NOW } from '@/lib/seed'
import { toMemberView } from './member-view'

/**
 * Mobile presentation of the directory. A table with nine columns is not a
 * phone UI — front-desk staff on a phone get a card per member with the three
 * facts that drive a conversation: status, risk, and recency.
 */
export function MembersCardList({
  members,
  selected,
  onSelectedChange,
}: {
  members: Member[]
  selected: Set<string>
  onSelectedChange: (next: Set<string>) => void
}) {
  const toggleOne = (id: string, next: boolean) => {
    const copy = new Set(selected)
    if (next) copy.add(id)
    else copy.delete(id)
    onSelectedChange(copy)
  }

  return (
    <ul className="divide-y divide-border border-b border-border sm:hidden">
      {members.map((member) => {
        const view = toMemberView(member)
        const m = member.metrics
        const isSelected = selected.has(member.id)
        return (
          <li key={member.id} className={cn(isSelected && 'bg-primary-soft')}>
            <div className="flex items-start gap-3 px-4 py-3">
              <Checkbox
                checked={isSelected}
                aria-label={`Select ${member.name}`}
                className="mt-1 shrink-0"
                onChange={(e) => toggleOne(member.id, e.currentTarget.checked)}
              />
              <Link href={`/members/${member.id}`} className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium text-foreground">{member.name}</p>
                    <p className="truncate text-micro text-muted-foreground">
                      {view.planName} · {view.locationName}
                    </p>
                  </div>
                  <RiskScore score={member.risk.score} className="shrink-0" />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <MemberStatus status={view.chipStatus} />
                  <span className="text-micro text-muted-foreground">
                    {m.lastVisit ? (
                      <>
                        Last visit{' '}
                        <span
                          className={cn(
                            'font-medium tnum',
                            m.daysSinceLastVisit !== null && m.daysSinceLastVisit >= 21
                              ? 'text-danger'
                              : m.daysSinceLastVisit !== null && m.daysSinceLastVisit >= 14
                                ? 'text-warn'
                                : 'text-foreground',
                          )}
                        >
                          {daysAgo(m.lastVisit, NOW)}
                        </span>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-danger">
                        <AlertCircle aria-hidden className="size-3" />
                        Never visited
                      </span>
                    )}
                  </span>
                  <span className="text-micro text-muted-foreground">
                    <span className="font-medium text-foreground tnum">{num(m.visitsLast30)}</span>{' '}
                    visits / 30d
                  </span>
                  <span className="text-micro text-muted-foreground">
                    <span className="font-medium text-foreground tnum">
                      {compactMoney(m.monthlyValue)}
                    </span>{' '}
                    / mo
                  </span>
                </div>
              </Link>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
