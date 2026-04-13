import Link from 'next/link'

// =============================================================
// DAZUL OS Admin Layout — 역할 기반 접근 제어 준비 완료
//
// TODO: Supabase Auth 연동 후 아래 가드 로직 활성화
//
// import { getCurrentUserRole, hasMinRole, ADMIN_ROUTE_MIN_ROLE } from '@/lib/roles'
// import { redirect } from 'next/navigation'
//
// 1. 레이아웃 진입 시 역할 확인:
//    const role = await getCurrentUserRole()
//    if (!role) redirect('/login')
//
// 2. 경로별 최소 역할 확인 (미들웨어 or 각 page.tsx):
//    const minRole = ADMIN_ROUTE_MIN_ROLE[pathname]
//    if (minRole && !hasMinRole(role, minRole)) redirect('/admin?error=unauthorized')
//
// 3. 내비게이션 항목도 역할 기반 필터링:
//    NAV_ITEMS.filter(item => hasMinRole(role, item.minRole))
//
// 현재는 인증 없이 접근 가능 — 운영 초기 내부 전용
// =============================================================

const NAV_ITEMS = [
  { href: '/admin', label: '대시보드', minRole: 'staff' as const },
  { href: '/admin/pets', label: '반려견', minRole: 'staff' as const },
  { href: '/admin/guardians', label: '보호자', minRole: 'staff' as const },
  { href: '/admin/records', label: '방문 기록', minRole: 'staff' as const },
  { href: '/admin/products', label: '제품', minRole: 'manager' as const },
  { href: '/admin/followups', label: '후속 관리', minRole: 'staff' as const },
  { href: '/admin/templates', label: '템플릿', minRole: 'manager' as const },
  { href: '/admin/staff', label: '스태프', minRole: 'owner' as const },
  { href: '/admin/settings', label: '설정', minRole: 'director' as const },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // TODO: 아래 주석 해제하여 역할 기반 내비게이션 필터링 적용
  // const role = await getCurrentUserRole()
  // const visibleItems = NAV_ITEMS.filter(item => hasMinRole(role, item.minRole))
  const visibleItems = NAV_ITEMS // 현재는 전체 노출

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* 모바일/데스크탑 공용 상단 헤더 */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="text-lg font-bold tracking-tight text-neutral-900">
            DAZUL 관리
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
          >
            홈으로
          </Link>
        </div>

        {/* 가로 스크롤 내비게이션 — 모바일 친화 */}
        <nav className="scrollbar-hide overflow-x-auto border-t border-neutral-100">
          <div className="mx-auto flex max-w-7xl gap-1 px-4 py-2">
            {visibleItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      {/* 페이지 콘텐츠 */}
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  )
}
