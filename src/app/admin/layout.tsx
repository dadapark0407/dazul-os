import Link from 'next/link'

// =============================================================
// DAZUL OS Admin Layout — 역할 기반 접근 제어 준비 완료
//
// ── 프로덕션 체크리스트 ──────────────────────────────
//
// TODO [AUTH]: Supabase Auth 연동 후 아래 가드 로직 활성화
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
//
// TODO [RLS]: Supabase RLS 정책 검증 필요
//   - pets, guardians, visit_records, followups, products 테이블
//   - 현재 anon key로 전체 접근 가능 — 운영 전 반드시 제한 필요
//   - INSERT/UPDATE/DELETE 정책은 authenticated + role 기반으로 전환
//
// TODO [ERROR_BOUNDARY]: 전역 에러 바운더리 추가
//   - /admin/error.tsx 생성 → Supabase 연결 실패, 네트워크 오류 시 안전한 폴백
//   - 현재는 개별 페이지에서 try/catch로 처리 중
//
// TODO [ANALYTICS]: 운영 분석 도구 연동
//   - 일별 방문 건수, 팔로업 완료율, 인기 서비스 추적
//   - Vercel Analytics 또는 자체 집계 테이블
//
// TODO [MESSAGING]: 카카오 알림톡 / SMS 연동
//   - 리포트 공유 시 자동 메시지 발송
//   - 팔로업 리마인더 자동 발송
//
// TODO [RATE_LIMITING]: API 남용 방지
//   - 리포트 토큰 생성 API에 rate limit 적용
//   - Supabase Edge Functions 또는 Vercel middleware 활용
//
// =============================================================

const NAV_ITEMS = [
  { href: '/admin', label: '대시보드', minRole: 'staff' as const },
  { href: '/admin/pets', label: '반려견', minRole: 'staff' as const },
  { href: '/admin/guardians', label: '보호자', minRole: 'staff' as const },
  { href: '/admin/records', label: '방문 기록', minRole: 'staff' as const },
  { href: '/admin/products', label: '제품', minRole: 'manager' as const },
  { href: '/admin/followups', label: '후속 관리', minRole: 'staff' as const },
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
