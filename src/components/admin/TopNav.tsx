'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getVisibleNavItems } from '@/lib/navigation'

const NAV_ITEMS = getVisibleNavItems()

export default function TopNav() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <nav className="flex items-center gap-0">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href)
        return (
          <Link
            key={item.id}
            href={item.href}
            className="relative shrink-0 px-2.5 py-2 sm:px-3"
            style={{
              fontSize: 13,
              letterSpacing: '0.04em',
              fontWeight: active ? 600 : 400,
              color: active ? '#0A0A0A' : '#888888',
              textDecoration: 'none',
              transition: 'color 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
            {active && (
              <span
                className="absolute bottom-0 left-2.5 right-2.5 sm:left-3 sm:right-3"
                style={{ height: 2, background: '#0A0A0A', borderRadius: 1 }}
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
