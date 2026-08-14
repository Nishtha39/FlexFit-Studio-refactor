import type { Metadata } from 'next'
import { PaymentsLedger } from '@/components/payments/payments-ledger'

export const metadata: Metadata = {
  title: 'Payments — FlexFit Studio',
  description:
    'Append-only payment ledger across card, cash, UPI and transfer — refunds recorded as paired reversal rows.',
}

export default function PaymentsPage() {
  return <PaymentsLedger />
}
