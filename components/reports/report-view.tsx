'use client'

import * as React from 'react'
import Link from 'next/link'
import { Download, Mail } from 'lucide-react'
import { PageHeader, PageBody } from '@/components/shell/page-header'
import { RequireScreen } from '@/components/shell/app-shell'
import { Card, CardHeader, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NullResultState } from '@/components/ui/empty-state'
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { fullDate } from '@/lib/format'
import { NOW } from '@/lib/seed'
import type { CellTone } from './reports-data'
import { getReport, reportRecipients } from './reports-data'

const TONE_CLASS: Record<CellTone, string> = {
  default: '',
  good: 'text-good',
  warn: 'text-warn',
  danger: 'text-danger',
  muted: 'text-muted-foreground',
}

/**
 * One report. The takeaway sits above the table, because the number is not the
 * product — the decision is. Where the data can't support a conclusion the
 * caveat is rendered as a null result, not hidden in a footnote.
 */
export function ReportView({ slug }: { slug: string }) {
  const { toast } = useToast()
  const report = getReport(slug)
  const result = React.useMemo(() => report?.run(), [report])
  if (!report || !result) return null

  return (
    <RequireScreen screen="reports">
      <PageHeader
        title={report.title}
        crumbs={[
          { label: 'FlexFit Studio', href: '/dashboard' },
          { label: 'Reports', href: '/reports' },
          { label: report.title },
        ]}
        meta={
          <>
            <span>{report.category}</span>
            <span aria-hidden>·</span>
            <span>{report.window}</span>
            <span aria-hidden>·</span>
            <span className="tnum">Run {fullDate(NOW)}</span>
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                toast({
                  tone: 'neutral',
                  title: 'CSV queued',
                  detail: `${report.title} — ${result.rows.length} rows. Download starts in a moment.`,
                })
              }
            >
              <Download />
              CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                toast({
                  tone: 'good',
                  title: 'Scheduled weekly',
                  detail: `Emails ${reportRecipients.map((r) => r.firstName).join(' and ')} every Monday at 7am.`,
                })
              }
            >
              <Mail />
              Schedule
            </Button>
          </>
        }
        sticky={false}
      />

      <PageBody>
        <div className="rounded-md border border-border bg-card px-4 py-3">
          <p className="text-micro font-medium tracking-wide text-muted-foreground uppercase">
            {report.question}
          </p>
          <p className="mt-1 max-w-prose text-base leading-relaxed text-foreground text-pretty">
            {result.takeaway}
          </p>
        </div>

        {result.caveat ? (
          <NullResultState title="Read this with the sample size in mind" description={result.caveat} />
        ) : null}

        <Card className="overflow-hidden">
          <CardHeader
            title="Result"
            description={`${result.rows.length} rows · every figure derives from the live dataset`}
          />
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  {result.columns.map((col) => (
                    <Th key={col.key} align={col.align ?? 'left'}>
                      {col.label}
                    </Th>
                  ))}
                </tr>
              </Thead>
              <Tbody>
                {result.rows.map((row, i) => (
                  <Tr key={i}>
                    {row.cells.map((cell, j) => (
                      <Td
                        key={j}
                        align={result.columns[j]?.align ?? 'left'}
                        className={cn(
                          j === 0 ? 'font-medium text-foreground' : 'tnum',
                          j > 0 && TONE_CLASS[row.tone ?? 'default'],
                        )}
                      >
                        {cell}
                      </Td>
                    ))}
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
          <CardFooter>
            <span>Figures are recomputed on every load — there is no cached snapshot.</span>
            <Link href="/reports" className="font-medium text-primary underline-offset-2 hover:underline">
              All reports
            </Link>
          </CardFooter>
        </Card>
      </PageBody>
    </RequireScreen>
  )
}
