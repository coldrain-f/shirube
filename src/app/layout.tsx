import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import Link from 'next/link'

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
            <nav className="flex items-center gap-4 ml-6 text-sm">
              <Link href="/staging" className="text-muted-foreground hover:text-foreground">대기열 (Staging)</Link>
              <Link href="/dictionary" className="text-muted-foreground hover:text-foreground">내 사전 (Dictionary)</Link>
              <Link href="/dictionaries" className="text-muted-foreground hover:text-foreground">사전 관리 (Dictionaries)</Link>
            </nav>
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
