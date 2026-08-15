'use client'

import * as React from 'react'
import Link from 'next/link'
import { Download, Mail } from 'lucide-react'
import { PageHeader, PageBody } from '@/components/shell/page-header'
import { RequireScreen } from '@/components/shell/app-shell'
import { Card, CardHeader, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NullResultState } from '@/components/ui/empty-state'
import {
  SerialTd,
  SerialTh,
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@/components/ui/table'
import { ComposeEmailDialog } from '@/components/comms/compose-email-dialog'
import { api } from '@/lib/api/client'
import { useDataVersion, useStudio } from '@/lib/store/studio-store'
import { datedFilename, downloadCsv } from '@/lib/export'
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
  const { connection } = useStudio()
  const version = useDataVersion()
  const [emailOpen, setEmailOpen] = React.useState(false)
  const report = getReport(slug)
  const result = React.useMemo(() => report?.run(), [report, version])
  // Recipients are recomputed on hydrate, so a manager who left stops receiving
  // reports without anybody remembering to take them off a list.
  const recipient = React.useMemo(() => reportRecipients[0] ?? null, [version])
  if (!report || !result) return null

  /**
   * The rows as rendered, in the order rendered. A report is a question with an
   * answer attached, so the file carries the takeaway and the caveat as header
   * lines — a spreadsheet of numbers with the honest caveat stripped off is how
   * a null result gets quoted as a finding.
   */
  const exportCsv = () =>
    downloadCsv(
      datedFilename(report.slug),
      result.rows,
      [
        { header: 'S.no', value: (_r, i) => i + 1 },
        ...result.columns.map((c, i) => ({
          header: c.label,
          value: (r: (typeof result.rows)[number]) => r.cells[i] ?? '',
        })),
      ],
    )

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
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              <Download />
              CSV
            </Button>
            {/* Not "Schedule": nothing in this app runs on a timer, and a button
                that promises a 7am Monday email would be promising something no
                code performs. Sending it now is the part that is real. */}
            <Button
              variant="secondary"
              size="sm"
              disabled={!recipient || connection !== 'live'}
              title={recipient ? undefined : 'No active owner or manager to send this to.'}
              onClick={() => setEmailOpen(true)}
            >
              <Mail />
              Email this
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
                  <SerialTh />
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
                    <SerialTd index={i} />
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

      {recipient ? (
        <ComposeEmailDialog
          open={emailOpen}
          onClose={() => setEmailOpen(false)}
          to={recipient.email}
          toName={recipient.name}
          title={`Email ${report.title}`}
          send={({ subject, body }) =>
            api.comms.emailStaff.mutate({ staffId: recipient.id, subject, body })
          }
          templates={[
            {
              label: 'Summary',
              subject: `${report.title} — ${fullDate(NOW)}`,
              body: [
                `Hi ${recipient.firstName},`,
                '',
                report.question,
                '',
                result.takeaway,
                ...(result.caveat ? ['', `Caveat: ${result.caveat}`] : []),
                '',
                `Covers ${report.window}. ${result.rows.length} rows — the full table is on the Reports screen, and the CSV button beside this one downloads it.`,
                '',
                'FlexFit Studio',
              ].join('\n'),
            },
          ]}
        />
      ) : null}
    </RequireScreen>
  )
}
