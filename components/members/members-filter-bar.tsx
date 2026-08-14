'use client'

import * as React from 'react'
import { Search, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FilterBar, FilterTrigger, FilterChip } from '@/components/ui/filter-chip'
import { plans } from '@/lib/data/plans'
import { activeTrainers } from '@/lib/data/staff'
import { locations } from '@/lib/data'
import {
  RISK_OPTIONS,
  STATUS_OPTIONS,
  describeFilters,
  type MemberFilters,
} from './member-query'

/**
 * Filter bar for the directory. Every active filter is a removable chip that
 * stays visible — filters are never hidden behind a drawer, because an operator
 * who cannot see why a list is short will mistrust the count.
 */

/** Lightweight popover: click-outside + Escape, no dependency. */
function Popover({
  label,
  activeCount,
  children,
}: {
  label: string
  activeCount: number
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <FilterTrigger
        label={label}
        value={activeCount > 0 ? String(activeCount) : undefined}
        active={activeCount > 0 || open}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      />
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-7 z-30 max-h-72 w-56 overflow-y-auto rounded-md border border-border-strong bg-popover p-1 shadow-[0_8px_24px_-8px_oklch(0.2_0.01_258/0.22)] scrollbar-thin animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  )
}

function CheckRow({
  label,
  meta,
  checked,
  onToggle,
}: {
  label: string
  meta?: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left text-sm transition-colors',
        checked ? 'bg-primary-soft text-accent-foreground' : 'hover:bg-muted',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-3.5 shrink-0 items-center justify-center rounded-sm border',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border-strong',
        )}
      >
        {checked ? <Check className="size-2.5" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {meta ? <span className="shrink-0 text-micro text-muted-foreground tnum">{meta}</span> : null}
    </button>
  )
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function MembersFilterBar({
  filters,
  onChange,
  resultCount,
  totalCount,
  counts,
}: {
  filters: MemberFilters
  onChange: (next: MemberFilters) => void
  resultCount: number
  totalCount: number
  /** Per-status result counts, so the operator sees the size before filtering. */
  counts: { status: Record<string, number>; risk: Record<string, number> }
}) {
  const planName = (id: string) => plans.find((p) => p.id === id)?.name ?? id
  const locationName = (id: string) =>
    locations.find((l) => l.id === id)?.shortName ?? id
  const trainerName = (id: string) =>
    id === 'none' ? 'Unassigned' : (activeTrainers.find((t) => t.id === id)?.name ?? id)

  const chips = describeFilters(filters, { planName, locationName, trainerName })

  return (
    <FilterBar
      resultCount={resultCount}
      totalCount={totalCount}
      className="sticky top-0 z-20 gap-2"
    >
      <div className="relative w-full sm:w-56">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={filters.search}
          placeholder="Name, email, phone, ID"
          aria-label="Search members"
          onChange={(e) => onChange({ ...filters, search: e.currentTarget.value })}
          className="h-6 pl-7 pr-6 text-micro"
        />
        {filters.search ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onChange({ ...filters, search: '' })}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        ) : null}
      </div>

      <Popover label="Status" activeCount={filters.statuses.length}>
        {() =>
          STATUS_OPTIONS.map((opt) => (
            <CheckRow
              key={opt.id}
              label={opt.label}
              meta={String(counts.status[opt.id] ?? 0)}
              checked={filters.statuses.includes(opt.id)}
              onToggle={() => onChange({ ...filters, statuses: toggle(filters.statuses, opt.id) })}
            />
          ))
        }
      </Popover>

      <Popover label="Risk" activeCount={filters.riskBands.length}>
        {() =>
          RISK_OPTIONS.map((opt) => (
            <CheckRow
              key={opt.id}
              label={opt.label}
              meta={String(counts.risk[opt.id] ?? 0)}
              checked={filters.riskBands.includes(opt.id)}
              onToggle={() =>
                onChange({ ...filters, riskBands: toggle(filters.riskBands, opt.id) })
              }
            />
          ))
        }
      </Popover>

      <Popover label="Plan" activeCount={filters.planIds.length}>
        {() =>
          plans.map((plan) => (
            <CheckRow
              key={plan.id}
              label={plan.name}
              checked={filters.planIds.includes(plan.id)}
              onToggle={() => onChange({ ...filters, planIds: toggle(filters.planIds, plan.id) })}
            />
          ))
        }
      </Popover>

      <Popover label="Location" activeCount={filters.locations.length}>
        {() =>
          locations.map((loc) => (
            <CheckRow
              key={loc.id}
              label={loc.shortName}
              checked={filters.locations.includes(loc.id)}
              onToggle={() =>
                onChange({ ...filters, locations: toggle(filters.locations, loc.id) })
              }
            />
          ))
        }
      </Popover>

      <Popover label="Trainer" activeCount={filters.trainerIds.length}>
        {() => (
          <>
            <CheckRow
              label="Unassigned"
              checked={filters.trainerIds.includes('none')}
              onToggle={() =>
                onChange({ ...filters, trainerIds: toggle(filters.trainerIds, 'none') })
              }
            />
            {activeTrainers.map((t) => (
              <CheckRow
                key={t.id}
                label={t.name}
                checked={filters.trainerIds.includes(t.id)}
                onToggle={() =>
                  onChange({ ...filters, trainerIds: toggle(filters.trainerIds, t.id) })
                }
              />
            ))}
          </>
        )}
      </Popover>

      <Popover
        label="Behaviour"
        activeCount={
          (filters.inactiveDays !== null ? 1 : 0) +
          (filters.failedPaymentsOnly ? 1 : 0) +
          (filters.underUsingOnly ? 1 : 0) +
          (filters.joinedWithinDays !== null ? 1 : 0)
        }
      >
        {() => (
          <>
            <p className="px-1.5 pb-1 pt-0.5 text-micro font-medium tracking-wide text-muted-foreground uppercase">
              Inactivity
            </p>
            {[7, 14, 21, 28].map((d) => (
              <CheckRow
                key={d}
                label={`No visit in ${d}+ days`}
                checked={filters.inactiveDays === d}
                onToggle={() =>
                  onChange({ ...filters, inactiveDays: filters.inactiveDays === d ? null : d })
                }
              />
            ))}
            <p className="mt-1 border-t border-border px-1.5 pb-1 pt-1.5 text-micro font-medium tracking-wide text-muted-foreground uppercase">
              Signals
            </p>
            <CheckRow
              label="Has failed payments"
              checked={filters.failedPaymentsOnly}
              onToggle={() =>
                onChange({ ...filters, failedPaymentsOnly: !filters.failedPaymentsOnly })
              }
            />
            <CheckRow
              label="Using under 40% of plan"
              checked={filters.underUsingOnly}
              onToggle={() => onChange({ ...filters, underUsingOnly: !filters.underUsingOnly })}
            />
            <CheckRow
              label="Joined last 60 days"
              checked={filters.joinedWithinDays === 60}
              onToggle={() =>
                onChange({
                  ...filters,
                  joinedWithinDays: filters.joinedWithinDays === 60 ? null : 60,
                })
              }
            />
          </>
        )}
      </Popover>

      {chips.length > 0 ? (
        <>
          <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
          {chips.map((chip) => (
            <FilterChip
              key={chip.id}
              filter={chip}
              onRemove={() => onChange(chip.clear(filters))}
            />
          ))}
          <Button
            variant="link"
            size="xs"
            className="text-micro"
            onClick={() => onChange({ ...filters, ...clearedFilters })}
          >
            Clear all
          </Button>
        </>
      ) : null}
    </FilterBar>
  )
}

const clearedFilters: MemberFilters = {
  search: '',
  statuses: [],
  riskBands: [],
  planIds: [],
  locations: [],
  trainerIds: [],
  tags: [],
  inactiveDays: null,
  failedPaymentsOnly: false,
  underUsingOnly: false,
  joinedWithinDays: null,
}
