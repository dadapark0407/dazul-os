import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import GlobalSearch from '@/components/admin/GlobalSearch'
import SidebarNav from '@/components/admin/SidebarNav'
import { getVisibleNavItems } from '@/lib/navigation'

// 모바일 네비용 (서버 컴포넌트에서 렌더링)
const MOBILE_NAV = getVisibleNavItems()

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

        {/* 글로벌 검색 */}
        <div className="px-4 pb-4">
          <GlobalSearch />
        </div>

        {/* 네비게이션 + 하단 설정 (클라이언트 — 활성 경로 감지) */}
        <SidebarNav />

        {/* 로그아웃 */}
        <div className="px-6 pb-4">
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
            {MOBILE_NAV.map((item) => (
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
