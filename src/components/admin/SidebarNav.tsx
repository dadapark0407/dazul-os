'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings } from 'lucide-react'
import { ALL_NAV_ITEMS } from '@/lib/navigation'

const VISIBLE_NAV = ALL_NAV_ITEMS.filter((item) => !item.hidden && item.id !== 'settings')
const HIDDEN_NAV = ALL_NAV_ITEMS.filter((item) => item.hidden)

export default function SidebarNav() {
  const pathname = usePathname()

  return (
    <>
      {/* 메인 네비 */}
      <nav className="flex-1 px-3">
        <ul className="space-y-0.5">
          {VISIBLE_NAV.map((item) => {
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href)

            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={`block rounded-sm px-3 py-2.5 text-[13px] font-light tracking-wide transition-all duration-400 ${
                    isActive
                      ? 'bg-dz-accent/10 text-dz-accent'
                      : 'text-white/40 hover:text-dz-accent'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* 하단: 설정 + 숨긴 메뉴 뱃지 */}
      <div className="border-t border-white/10 px-3 pb-4 pt-3">
        <Link
          href="/admin/settings"
          className={`flex items-center gap-3 rounded-sm px-3 py-2.5 text-[13px] font-light tracking-wide transition-all duration-400 group ${
            pathname.startsWith('/admin/settings')
              ? 'bg-dz-accent/10 text-dz-accent'
              : 'text-white/40 hover:text-dz-accent'
          }`}
        >
          <Settings className={`h-4 w-4 transition-colors ${
            pathname.startsWith('/admin/settings')
              ? 'text-dz-accent'
              : 'text-white/20 group-hover:text-dz-accent'
          }`} />
          <span>설정</span>
          {HIDDEN_NAV.length > 0 && (
            <span className="ml-auto rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-white/25">
              +{HIDDEN_NAV.length}
            </span>
          )}
        </Link>
      </div>
    </>
  )
}
