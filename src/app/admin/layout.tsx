import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import TopNav from '@/components/admin/TopNav'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen" style={{ background: '#FFFFFF' }}>
      {/* ─── 상단 네비바 (한 줄) ─── */}
      <header
        className="sticky top-0 z-30"
        style={{ background: '#FFFFFF', borderBottom: '1px solid #E8E8E8' }}
      >
        <div className="flex items-center px-4 sm:px-6" style={{ height: 52 }}>
          {/* 로고 */}
          <Link
            href="/admin"
            className="mr-6 shrink-0 sm:mr-8"
            style={{
              fontSize: 15,
              letterSpacing: '0.35em',
              fontWeight: 600,
              color: '#0A0A0A',
              textDecoration: 'none',
            }}
          >
            DAZUL
          </Link>

          {/* 네비 (가로 스크롤) */}
          <div className="flex-1 overflow-x-auto">
            <TopNav />
          </div>

          {/* 로그아웃 */}
          <div className="ml-4 shrink-0">
            <LogoutButton />
          </div>
        </div>
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
