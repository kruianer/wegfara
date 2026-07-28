import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'wegfara',
  description: 'Adaptiver Reiseplaner',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
