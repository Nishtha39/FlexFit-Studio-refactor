'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileBarChart } from 'lucide-react'
import { PageHeader, PageBody } from '@/components/shell/page-header'
import { RequireScreen } from '@/components/shell/app-shell'
import { Card, CardHeader } from '@/components/ui/card'
import { FilterTrigger } from '@/components/ui/filter-chip'
import { StatusChip } from '@/components/ui/status-chip'
import { cn } from '@/lib/utils'
import { num } from '@/lib/format'
import { useListTraversal, TraversalHint } from '@/components/command/use-list-traversal'
import { REPORTS, REPORT_CATEGORIES, type ReportCategory, type ReportDef } from './reports-data'

/**
 * Reports library. Each entry states the question it answers, not the columns it
 * contains — an operator picks a report by the decision they need to make.
 */
export function ReportsLibrary() {
  const router = useRouter()
  const [category, setCategory] = React.useState<'all' | ReportCategory>('all')
  const visible = category === 'all' ? REPORTS : REPORTS.filter((r) => r.category === category)

  const open = React.useCallback((report: ReportDef) => router.push(`/reports/${report.slug}`), [router])
  const { rowProps } = useListTraversal({ items: visible, onOpen: open })

  return (
    <RequireScreen screen="reports">
      <PageHeader
        title="Reports"
        crumbs={[{ label: 'FlexFit Studio', href: '/dashboard' }, { label: 'Reports' }]}
        meta={
          <>
            <span className="tnum">{num(REPORTS.length)} reports</span>
            <span aria-hidden>·</span>
            <span>Computed live from the current dataset</span>
            <span aria-hidden>·</span>
            <TraversalHint />
          </>
        }
        sticky={false}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterTrigger label="All" active={category === 'all'} onClick={() => setCategory('all')} />
          {REPORT_CATEGORIES.map((c) => (
            <FilterTrigger
              key={c}
              label={c}
              value={String(REPORTS.filter((r) => r.category === c).length)}
              active={category === c}
              onClick={() => setCategory(category === c ? 'all' : c)}
            />
          ))}
        </div>
      </PageHeader>

      <PageBody>
        {REPORT_CATEGORIES.filter((c) => category === 'all' || c === category).map((cat) => {
          const rows = visible.filter((r) => r.category === cat)
          if (rows.length === 0) return null
          return (
            <Card key={cat} className="overflow-hidden">
              <CardHeader title={cat} description={`${rows.length} reports`} />
              <ul className="divide-y divide-border">
                {rows.map((report) => {
                  const index = visible.indexOf(report)
                  return (
                    <li
                      key={report.slug}
                      {...rowProps(index)}
                      className={cn(
                        'group/row transition-colors duration-150',
                        'data-[focused]:ring-1 data-[focused]:ring-inset data-[focused]:ring-primary',
                      )}
                    >
                      <Link
                        href={`/reports/${report.slug}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-subtle"
                      >
                        <FileBarChart aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {report.title}
                          </span>
                          <span className="block truncate text-micro text-muted-foreground">
                            {report.question}
                          </span>
                        </span>
                        <StatusChip tone="neutral" label={report.window} className="hidden sm:inline-flex" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )
        })}
      </PageBody>
    </RequireScreen>
  )
}
