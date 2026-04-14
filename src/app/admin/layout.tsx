import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

const NAV_ITEMS = [
  { href: '/admin', label: '대시보드' },
  { href: '/admin/pets', label: '반려견' },
  { href: '/admin/guardians', label: '보호자' },
  { href: '/admin/records', label: '방문 기록' },
  { href: '/admin/products', label: '제품' },
  { href: '/admin/followups', label: '후속 관리' },
  { href: '/admin/settings', label: '설정' },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      {/* ─── 사이드바 (데스크탑) ─── */}
      <aside className="hidden w-[200px] shrink-0 flex-col border-r border-dz-border/40 bg-dz-primary lg:flex">
        {/* 로고 */}
        <div className="px-6 pb-8 pt-10">
          <Link href="/admin" className="block">
            <p className="font-heading text-lg font-light tracking-[0.4em] text-white/90">
              DAZUL
            </p>
            <p className="mt-1 text-[8px] uppercase tracking-[0.2em] text-white/30">
              Management
            </p>
          </Link>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 px-3">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-sm px-3 py-2.5 text-[13px] font-light tracking-wide text-white/50 transition-all duration-400 hover:text-dz-accent"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* 하단 */}
        <div className="border-t border-white/10 px-3 py-4">
          <LogoutButton />
        </div>
      </aside>

      {/* ─── 모바일 헤더 ─── */}
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-dz-border/60 bg-white px-4 py-3 lg:hidden">
          <Link href="/admin" className="font-heading text-lg font-light tracking-[0.3em] text-dz-primary">
            DAZUL
          </Link>
          <LogoutButton />
        </header>

        {/* 모바일 네비 */}
        <nav className="scrollbar-hide overflow-x-auto border-b border-dz-border/40 bg-white lg:hidden">
          <div className="flex gap-0 px-2 py-1.5">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 px-3 py-2 text-[12px] font-medium text-dz-muted transition-all duration-400 hover:text-dz-primary"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* ─── 콘텐츠 ─── */}
        <main className="flex-1 bg-dz-surface">
          <div className="mx-auto max-w-6xl px-5 py-8 lg:px-8 lg:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
