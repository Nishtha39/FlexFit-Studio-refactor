'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CellStack,
  SelectAllCell,
  SelectCell,
  SerialTd,
  SerialTh,
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  type SortDir,
} from '@/components/ui/table'
import { MemberStatus, RiskScore } from '@/components/ui/status-chip'
import type { Member } from '@/lib/types'
import { compactMoney, daysAgo, num } from '@/lib/format'
import { NOW } from '@/lib/seed'
import { allowanceLabel, toMemberView } from './member-view'
import type { SortDirection, SortKey } from './member-query'

/**
 * The directory table. Dense by default: 32px rows, tabular numerals, numeric
 * columns right-aligned so magnitudes are comparable down the column.
 * The whole row navigates; the checkbox and row action stop propagation.
 */

interface Column {
  key: SortKey | null
  label: string
  align?: 'left' | 'right'
  /** Hidden below this breakpoint to keep the row scannable on laptops. */
  hideBelow?: 'md' | 'lg' | 'xl'
  width?: number
}

const COLUMNS: Column[] = [
  { key: 'name', label: 'Member' },
  { key: 'status', label: 'Status', width: 108 },
  { key: 'risk', label: 'Risk', width: 116 },
  { key: 'lastVisit', label: 'Last visit', align: 'right', width: 96 },
  { key: 'visits30', label: 'Visits 30d', align: 'right', width: 104, hideBelow: 'md' },
  { key: null, label: 'Plan', hideBelow: 'lg', width: 150 },
  { key: 'monthly', label: 'Monthly', align: 'right', width: 96, hideBelow: 'lg' },
  { key: 'ltv', label: 'LTV', align: 'right', width: 92, hideBelow: 'xl' },
  { key: 'tenure', label: 'Tenure', align: 'right', width: 84, hideBelow: 'xl' },
]

const hideClass: Record<string, string> = {
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
}

/** Utilization mini-bar — shows a limited plan being under- or over-used. */
function UtilizationBar({ ratio }: { ratio: number | null }) {
  if (ratio === null) {
    return <span className="text-micro text-muted-foreground">Unlimited</span>
  }
  const pct = Math.min(ratio, 1)
  const tone = ratio < 0.4 ? 'bg-warn' : ratio > 0.95 ? 'bg-good' : 'bg-primary'
  return (
    <span className="flex items-center justify-end gap-1.5">
      <span className="h-1 w-8 overflow-hidden rounded-sm bg-muted">
        <span className={cn('block h-full', tone)} style={{ width: `${pct * 100}%` }} />
      </span>
      <span className="text-micro text-muted-foreground tnum">{Math.round(ratio * 100)}%</span>
    </span>
  )
}

export function MembersTable({
  members,
  sortKey,
  sortDir,
  onSort,
  selected,
  onSelectedChange,
}: {
  members: Member[]
  sortKey: SortKey
  sortDir: SortDirection
  onSort: (key: SortKey) => void
  selected: Set<string>
  onSelectedChange: (next: Set<string>) => void
}) {
  const router = useRouter()

  const allSelected = members.length > 0 && members.every((m) => selected.has(m.id))
  const someSelected = members.some((m) => selected.has(m.id))

  const toggleAll = (next: boolean) => {
    const copy = new Set(selected)
    for (const m of members) {
      if (next) copy.add(m.id)
      else copy.delete(m.id)
    }
    onSelectedChange(copy)
  }

  const toggleOne = (id: string, next: boolean) => {
    const copy = new Set(selected)
    if (next) copy.add(id)
    else copy.delete(id)
    onSelectedChange(copy)
  }

  const dirFor = (key: SortKey | null): SortDir =>
    key !== null && key === sortKey ? sortDir : null

  return (
    <TableWrap className="hidden border-b border-border sm:block">
      <Table>
        <Thead>
          <Tr className="bg-subtle hover:bg-subtle">
            <SelectAllCell
              checked={allSelected}
              indeterminate={someSelected}
              onChange={toggleAll}
            />
            <SerialTh />
            {COLUMNS.map((col) => (
              <Th
                key={col.label}
                align={col.align}
                width={col.width}
                sortable={col.key !== null}
                sortDir={dirFor(col.key)}
                onSort={col.key ? () => onSort(col.key as SortKey) : undefined}
                className={col.hideBelow ? hideClass[col.hideBelow] : undefined}
              >
                {col.label}
              </Th>
            ))}
            <Th width={36} className="sr-only">
              Open
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {members.map((member, i) => {
            const view = toMemberView(member)
            const m = member.metrics
            const isSelected = selected.has(member.id)
            const href = `/members/${member.id}`
            return (
              <Tr
                key={member.id}
                interactive
                selected={isSelected}
                onClick={() => router.push(href)}
              >
                <SelectCell
                  checked={isSelected}
                  label={member.name}
                  onChange={(next) => toggleOne(member.id, next)}
                />
                <SerialTd index={i} />
                <Td className="max-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-muted text-micro font-medium text-muted-foreground"
                    >
                      {member.initials}
                    </span>
                    <CellStack
                      primary={member.name}
                      secondary={
                        view.companyName ? `${view.locationName} · ${view.companyName}` : view.locationName
                      }
                    />
                  </div>
                </Td>
                <Td>
                  <MemberStatus status={view.chipStatus} />
                </Td>
                <Td>
                  <RiskScore score={member.risk.score} />
                </Td>
                <Td align="right" muted={m.daysSinceLastVisit === null}>
                  {m.lastVisit ? (
                    <span
                      className={cn(
                        m.daysSinceLastVisit !== null && m.daysSinceLastVisit >= 21 && 'text-danger',
                        m.daysSinceLastVisit !== null &&
                          m.daysSinceLastVisit >= 14 &&
                          m.daysSinceLastVisit < 21 &&
                          'text-warn',
                      )}
                    >
                      {daysAgo(m.lastVisit, NOW)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-micro">
                      <AlertCircle aria-hidden className="size-3" />
                      Never
                    </span>
                  )}
                </Td>
                <Td align="right" className={hideClass.md}>
                  <span className="flex items-center justify-end gap-2">
                    <span className="tnum">{num(m.visitsLast30)}</span>
                    <span className="text-micro text-muted-foreground">
                      {m.visitsPrev30 > m.visitsLast30 ? '↓' : m.visitsPrev30 < m.visitsLast30 ? '↑' : '→'}
                    </span>
                  </span>
                </Td>
                <Td className={cn(hideClass.lg, 'max-w-0')}>
                  <CellStack primary={view.planName} secondary={allowanceLabel(member)} />
                </Td>
                <Td align="right" className={hideClass.lg}>
                  <div className="flex flex-col items-end leading-tight">
                    <span className="tnum">{compactMoney(m.monthlyValue)}</span>
                    <UtilizationBar ratio={view.utilization} />
                  </div>
                </Td>
                <Td align="right" className={cn(hideClass.xl, 'tnum')}>
                  {compactMoney(m.lifetimeValue)}
                </Td>
                <Td align="right" muted className={cn(hideClass.xl, 'tnum')}>
                  {m.tenureMonths < 1 ? 'new' : `${m.tenureMonths} mo`}
                </Td>
                <Td className="pl-0">
                  <Link
                    href={href}
                    aria-label={`Open ${member.name}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex size-6 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-colors group-hover/row:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100"
                  >
                    <ChevronRight className="size-3.5" />
                  </Link>
                </Td>
              </Tr>
            )
          })}
        </Tbody>
      </Table>
    </TableWrap>
  )
}
