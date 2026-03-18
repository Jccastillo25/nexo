import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { createClient } from '@/lib/supabase/server'
import { SpeedInsights } from '@vercel/speed-insights/next'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Marcación Grupo CT',
  description: 'Sistema de control de asistencia',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()
  const { data: rows } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['favicon_url'])

  const faviconUrl = rows?.find((r) => r.key === 'favicon_url')?.value ?? null

  return (
    <html lang="es">
      <head>
        {faviconUrl && (
          <link rel="icon" href={faviconUrl} />
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
