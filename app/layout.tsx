import type React from 'react'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ToastProvider } from '@/components/ui/toast'
import './globals.css'

const _geistSans = Geist({ subsets: ['latin'], display: 'swap' })
const _geistMono = Geist_Mono({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'FlexFit Studio — Gym Business Management',
  description:
    'Membership, scheduling, retention and billing operations for multi-location gyms and studios.',
  applicationName: 'FlexFit Studio',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f7f8f9',
  width: 'device-width',
  initialScale: 1,
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className="font-sans antialiased">
        <ToastProvider>{children}</ToastProvider>
        {/*
          @vercel/analytics is deliberately not mounted. It loads
          /_vercel/insights/script.js, a path that only exists on Vercel's edge —
          on Cloudflare it 404s on every page load and reports nothing. Restore
          `{process.env.NODE_ENV === 'production' && <Analytics />}` here (and the
          import above) if this app is ever hosted on Vercel instead.
        */}
      </body>
    </html>
  )
}
