import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import Link from 'next/link'
import NavLinks from '@/components/nav-links'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Shirube Dashboard',
  description: 'Custom Japanese Dictionary Management',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <div className="flex h-screen flex-col overflow-hidden bg-background">
          <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-6">
            <Link href="/" className="font-bold flex items-center gap-2">
              <span className="text-xl">⛩️</span>
              <span className="hidden sm:inline-block">Shirube</span>
            </Link>
            <NavLinks />
          </header>
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
