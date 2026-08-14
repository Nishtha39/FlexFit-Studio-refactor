import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getInvoice, invoices } from '@/components/billing/billing-data'
import { InvoiceDetail } from '@/components/billing/invoice-detail'
import { money } from '@/lib/format'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * Invoice ids ("INV-4830") are URL-safe as-is, so the param is the raw id; the
 * page still decodes, which is a no-op for these and correct for anything encoded.
 */
export function generateStaticParams() {
  return invoices.map((i) => ({ id: i.id }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const invoice = getInvoice(decodeURIComponent(id))
  if (!invoice) return { title: 'Invoice not found — FlexFit Studio' }
  return {
    title: `${invoice.id} — FlexFit Studio`,
    description: `${invoice.memberName} · ${invoice.planName} · ${money(invoice.amount)} · ${invoice.status}.`,
  }
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const { id } = await params
  const invoice = getInvoice(decodeURIComponent(id))
  if (!invoice) notFound()

  return <InvoiceDetail invoice={invoice} />
}
