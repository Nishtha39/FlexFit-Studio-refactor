import type { Metadata } from 'next'
import { InvoiceList } from '@/components/billing/invoice-list'

export const metadata: Metadata = {
  title: 'Billing — FlexFit Studio',
  description: 'Invoices for the current cycle, collection rate, and everything still unsettled.',
}

export default function BillingPage() {
  return <InvoiceList />
}
