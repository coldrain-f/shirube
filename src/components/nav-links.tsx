'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const links = [
  { href: '/staging', label: '대기열 (Staging)' },
  { href: '/dictionary', label: '내 사전 (Dictionary)' },
  { href: '/dictionaries', label: '사전 관리 (Dictionaries)' },
]

export default function NavLinks() {
  const pathname = usePathname()
  return (
    <nav className="flex items-center gap-4 ml-6 text-sm">
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'hover:text-foreground transition-colors',
            pathname.startsWith(href) ? 'text-foreground font-medium' : 'text-muted-foreground'
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
