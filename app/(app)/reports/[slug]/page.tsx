import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getReport, REPORTS } from '@/components/reports/reports-data'
import { ReportView } from '@/components/reports/report-view'

interface PageProps {
  params: Promise<{ slug: string }>
}

/** All 12 reports are defined in code, so all 12 prerender. */
export function generateStaticParams() {
  return REPORTS.map((r) => ({ slug: r.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const report = getReport(slug)
  if (!report) return { title: 'Report not found — FlexFit Studio' }
  return { title: `${report.title} — FlexFit Studio`, description: report.question }
}

export default async function ReportPage({ params }: PageProps) {
  const { slug } = await params
  if (!getReport(slug)) notFound()

  return <ReportView slug={slug} />
}
