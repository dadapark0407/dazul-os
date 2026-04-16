import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import TopNav, { TopNavMobile } from '@/components/admin/TopNav'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen" style={{ background: '#FFFFFF' }}>
      {/* ─── 상단 네비바 ─── */}
      <header className="sticky top-0 z-30" style={{ background: '#FFFFFF', borderBottom: '1px solid #E8E8E8' }}>
        {/* 1단: 로고 + 유틸 */}
        <div className="mx-auto flex items-center justify-between px-4 sm:px-6" style={{ height: 56 }}>
          <Link
            href="/admin"
            style={{
              fontSize: 12,
              letterSpacing: '0.25em',
              fontWeight: 300,
              color: '#0A0A0A',
              textDecoration: 'none',
            }}
          >
            DAZUL
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/admin/settings"
              className="hidden md:inline-block"
              style={{
                fontSize: 11,
                letterSpacing: '0.1em',
                fontWeight: 300,
                color: '#6B6B6B',
                textDecoration: 'none',
              }}
            >
              설정
            </Link>
            <LogoutButton />
            <TopNavMobile />
          </div>
        </div>

        {/* 2단: 데스크탑 메뉴 */}
        <TopNav />
      </header>

      {/* ─── 콘텐츠 ─── */}
      <main>
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </div>
      </main>
    </div>
  )
}
