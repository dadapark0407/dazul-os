'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { getVisibleNavItems } from '@/lib/navigation'

const NAV_ITEMS = getVisibleNavItems().filter((i) => i.id !== 'settings')

export function MobileMenuButton() {
  return null // Rendered by TopNavMobile
}

export default function TopNav() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <nav className="flex overflow-x-auto" style={{ borderTop: '1px solid #E8E8E8' }}>
      <div className="flex items-center gap-0 px-4 sm:px-6">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.id}
              href={item.href}
              className="relative shrink-0 px-3 py-3"
              style={{
                fontSize: 11,
                letterSpacing: '0.12em',
                fontWeight: 400,
                color: active ? '#0A0A0A' : '#6B6B6B',
                textDecoration: 'none',
                transition: 'color 0.3s',
              }}
            >
              {item.label}
              {active && (
                <span
                  className="absolute bottom-0 left-3 right-3"
                  style={{ height: 1, background: '#0A0A0A' }}
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export function TopNavMobile() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center md:hidden"
        style={{ width: 32, height: 32 }}
        aria-label="메뉴"
      >
        <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
          <line x1="0" y1="0.5" x2="16" y2="0.5" stroke="#0A0A0A" />
          <line x1="0" y1="5" x2="16" y2="5" stroke="#0A0A0A" />
          <line x1="0" y1="9.5" x2="16" y2="9.5" stroke="#0A0A0A" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#FFFFFF' }}>
          <div
            className="flex items-center justify-between px-4"
            style={{ height: 56, borderBottom: '1px solid #E8E8E8' }}
          >
            <span style={{ fontSize: 12, letterSpacing: '0.25em', fontWeight: 300, color: '#0A0A0A' }}>
              DAZUL
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ fontSize: 20, color: '#6B6B6B', lineHeight: 1, padding: 8 }}
            >
              ×
            </button>
          </div>
          <nav className="flex flex-1 flex-col px-6 pt-6">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="py-4"
                  style={{
                    fontSize: 13,
                    letterSpacing: '0.12em',
                    fontWeight: active ? 500 : 300,
                    color: active ? '#0A0A0A' : '#6B6B6B',
                    borderBottom: '1px solid #E8E8E8',
                    textDecoration: 'none',
                    transition: 'color 0.3s',
                  }}
                >
                  {item.label}
                </Link>
              )
            })}
            <Link
              href="/admin/settings"
              onClick={() => setOpen(false)}
              className="mt-8 py-4"
              style={{
                fontSize: 11,
                letterSpacing: '0.12em',
                fontWeight: 300,
                color: '#6B6B6B',
                borderTop: '1px solid #E8E8E8',
                textDecoration: 'none',
              }}
            >
              설정
            </Link>
          </nav>
        </div>
      )}
    </>
  )
}
