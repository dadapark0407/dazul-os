import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

// TODO: 역할 기반 인증 추가 필요
// TODO: getCurrentUserRole() 연동 후 역할별 대시보드 표시 분기

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function isOverdue(dueDateStr?: string | null): boolean {
  if (!dueDateStr) return false
  const due = new Date(dueDateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return due < now
}

// 안전한 카운트 쿼리 — 테이블이 없어도 null 반환
async function safeCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  filter?: { column: string; value: string }
): Promise<number | null> {
  let query = supabase.from(table).select('id', { count: 'exact', head: true })
  if (filter) {
    query = query.eq(filter.column, filter.value)
  }
  const { count, error } = await query
  if (error) return null
  return count ?? 0
}

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // ─── KPI 카운트 (병렬, 각각 독립 실패 안전) ───
  const [
    petCount,
    guardianCount,
    recordCount,
    productCount,
    pendingFollowupCount,
    staffCount,
  ] = await Promise.all([
    safeCount(supabase, 'pets'),
    safeCount(supabase, 'guardians'),
    safeCount(supabase, 'visit_records'),
    safeCount(supabase, 'products'),
    safeCount(supabase, 'followups', { column: 'status', value: 'pending' }),
    safeCount(supabase, 'staff_profiles'),
  ])

  // ─── 최근 방문 기록 (7건) ───
  const { data: recentRecords } = await supabase
    .from('visit_records')
    .select('id, visit_date, service_type, pet_id, guardian_id')
    .order('visit_date', { ascending: false })
    .limit(7)

  // pet/guardian 이름 매핑
  const recordPetIds = [
    ...new Set((recentRecords ?? []).map((r) => r.pet_id).filter(Boolean)),
  ]
  const recordGuardianIds = [
    ...new Set((recentRecords ?? []).map((r) => r.guardian_id).filter(Boolean)),
  ]

  let petNameMap: Record<string, string> = {}
  let guardianNameMap: Record<string, string> = {}

  const [petNamesResult, guardianNamesResult] = await Promise.all([
    recordPetIds.length > 0
      ? supabase.from('pets').select('id, name').in('id', recordPetIds)
      : Promise.resolve({ data: [] }),
    recordGuardianIds.length > 0
      ? supabase.from('guardians').select('id, name').in('id', recordGuardianIds)
      : Promise.resolve({ data: [] }),
  ])

  for (const p of petNamesResult.data ?? []) {
    petNameMap[p.id] = p.name ?? '이름 없음'
  }
  for (const g of guardianNamesResult.data ?? []) {
    guardianNameMap[g.id] = g.name ?? '이름 없음'
  }

  // ─── 최근 등록 반려견 (5건) ───
  const { data: recentPets } = await supabase
    .from('pets')
    .select('id, name, breed, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  // ─── 대기 중 팔로업 (5건, 기한순) ───
  const { data: pendingFollowups, error: followupsError } = await supabase
    .from('followups')
    .select('id, type, status, due_date, note, pet_id')
    .eq('status', 'pending')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(5)

  const followupsAvailable = !followupsError

  // 팔로업의 pet 이름
  const followupPetIds = [
    ...new Set((pendingFollowups ?? []).map((f) => f.pet_id).filter(Boolean)),
  ].filter((id) => !petNameMap[id])

  if (followupPetIds.length > 0) {
    const { data: extraPets } = await supabase
      .from('pets')
      .select('id, name')
      .in('id', followupPetIds)
    for (const p of extraPets ?? []) {
      petNameMap[p.id] = p.name ?? '이름 없음'
    }
  }

  // ─── 최근 업데이트 제품 (5건) ───
  const { data: recentProducts } = await supabase
    .from('products')
    .select('id, name, brand, category_id, is_active, updated_at')
    .order('updated_at', { ascending: false })
    .limit(5)

  // ─── 오늘 방문 건수 ───
  const today = new Date().toISOString().slice(0, 10)
  const todayCount = await safeCount(supabase, 'visit_records', {
    column: 'visit_date',
    value: today,
  })

  // ─── KPI 카드 구성 ───
  type KpiCard = {
    label: string
    value: number | string
    href: string
    highlight?: boolean
    muted?: boolean
  }

  const kpis: KpiCard[] = [
    { label: '반려견', value: petCount ?? '-', href: '/admin/pets' },
    { label: '보호자', value: guardianCount ?? '-', href: '/admin/guardians' },
    { label: '방문 기록', value: recordCount ?? '-', href: '/admin/records' },
    { label: '제품', value: productCount ?? '-', href: '/admin/products' },
  ]

  if (pendingFollowupCount !== null) {
    kpis.push({
      label: '대기 팔로업',
      value: pendingFollowupCount,
      href: '/admin/followups',
      highlight: pendingFollowupCount > 0,
    })
  }

  if (staffCount !== null) {
    kpis.push({
      label: '스태프',
      value: staffCount,
      href: '/admin/staff',
      muted: true,
    })
  }

  // ─── 빠른 액션 ───
  const primaryActions = [
    { label: '+ 방문 기록 작성', href: '/record/new', primary: true },
    { label: '+ 새 팔로업', href: '/admin/followups/new', primary: true },
  ]

  const secondaryActions = [
    { label: '방문 기록 목록', href: '/admin/records' },
    { label: '제품 관리', href: '/admin/products' },
    { label: '보호자 목록', href: '/admin/guardians' },
    { label: '템플릿 관리', href: '/admin/templates' },
    { label: '후속 관리', href: '/admin/followups' },
    { label: '스태프 관리', href: '/admin/staff' },
    { label: '설정', href: '/admin/settings' },
  ]

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">대시보드</h1>
          <p className="mt-1 text-sm text-neutral-500">DAZUL OS 운영 현황</p>
        </div>
        {todayCount !== null && (
          <div className="rounded-xl bg-neutral-100 px-4 py-2">
            <p className="text-sm text-neutral-600">
              오늘 방문 <strong className="text-neutral-900">{todayCount}건</strong>
            </p>
          </div>
        )}
      </div>

      {/* KPI 카드 */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className={`rounded-2xl p-4 shadow-sm ring-1 transition hover:ring-neutral-300 ${
              kpi.highlight
                ? 'bg-yellow-50 ring-yellow-200'
                : kpi.muted
                  ? 'bg-neutral-50 ring-neutral-200'
                  : 'bg-white ring-neutral-200'
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {kpi.label}
            </p>
            <p
              className={`mt-1.5 text-2xl font-bold ${
                kpi.highlight
                  ? 'text-yellow-700'
                  : kpi.muted
                    ? 'text-neutral-500'
                    : 'text-neutral-900'
              }`}
            >
              {kpi.value}
            </p>
          </Link>
        ))}
      </section>

      {/* 빠른 액션 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          빠른 액션
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {primaryActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700"
            >
              {action.label}
            </Link>
          ))}
          {secondaryActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              {action.label}
            </Link>
          ))}
        </div>
      </section>

      {/* 3열 그리드: 최근 방문 · 대기 팔로업 · 최근 반려견 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 최근 방문 기록 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-900">최근 방문 기록</h2>
            <Link
              href="/admin/records"
              className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
            >
              전체 보기
            </Link>
          </div>

          {!recentRecords || recentRecords.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">방문 기록이 없습니다.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                    <th className="pb-2 pr-4">반려견</th>
                    <th className="pb-2 pr-4">보호자</th>
                    <th className="pb-2 pr-4">서비스</th>
                    <th className="pb-2">날짜</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {recentRecords.map((record) => (
                    <tr key={record.id} className="group">
                      <td className="py-2.5 pr-4">
                        <Link
                          href={`/admin/records/${record.id}`}
                          className="font-medium text-neutral-800 group-hover:text-neutral-600"
                        >
                          {petNameMap[record.pet_id] ?? '-'}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4 text-neutral-600">
                        {guardianNameMap[record.guardian_id] ?? '-'}
                      </td>
                      <td className="py-2.5 pr-4 text-neutral-600">
                        {record.service_type ?? '-'}
                      </td>
                      <td className="py-2.5 text-neutral-500">
                        {formatDate(record.visit_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 대기 중 팔로업 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-900">대기 팔로업</h2>
            <Link
              href="/admin/followups"
              className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
            >
              전체 보기
            </Link>
          </div>

          {!followupsAvailable ? (
            <p className="mt-4 text-xs text-neutral-400">
              followups 테이블 미연결
            </p>
          ) : !pendingFollowups || pendingFollowups.length === 0 ? (
            <div className="mt-4 text-center">
              <p className="text-sm text-neutral-500">대기 중인 팔로업 없음</p>
              <Link
                href="/admin/followups/new"
                className="mt-2 inline-block text-sm font-medium text-neutral-500 hover:text-neutral-700"
              >
                새 팔로업 등록 →
              </Link>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {pendingFollowups.map((f) => {
                const overdue = isOverdue(f.due_date)
                return (
                  <li key={f.id}>
                    <Link
                      href={`/admin/followups/${f.id}`}
                      className={`block rounded-xl p-3 transition ${
                        overdue
                          ? 'bg-red-50 hover:bg-red-100'
                          : 'bg-neutral-50 hover:bg-neutral-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700">
                          {f.type}
                        </span>
                        {overdue && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                            기한 초과
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 line-clamp-1 text-sm text-neutral-800">
                        {f.note ?? '메모 없음'}
                      </p>
                      <div className="mt-1 flex gap-3 text-xs text-neutral-500">
                        {f.due_date && <span>{formatDate(f.due_date)}</span>}
                        {f.pet_id && petNameMap[f.pet_id] && (
                          <span>🐾 {petNameMap[f.pet_id]}</span>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {/* 2열 그리드: 최근 반려견 · 최근 제품 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 최근 등록 반려견 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-900">최근 반려견</h2>
            <Link
              href="/admin/pets"
              className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
            >
              전체 보기
            </Link>
          </div>

          {!recentPets || recentPets.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">등록된 반려견이 없습니다.</p>
          ) : (
            <ul className="mt-4 divide-y divide-neutral-100">
              {recentPets.map((pet) => (
                <li key={pet.id} className="py-3">
                  <Link
                    href={`/admin/pets/${pet.id}`}
                    className="flex items-center justify-between gap-2 text-sm hover:text-neutral-700"
                  >
                    <div>
                      <span className="font-medium text-neutral-800">
                        {pet.name ?? '이름 없음'}
                      </span>
                      {pet.breed && (
                        <span className="ml-2 text-neutral-500">{pet.breed}</span>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-neutral-400">
                      {formatDate(pet.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 최근 업데이트 제품 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-900">최근 제품</h2>
            <Link
              href="/admin/products"
              className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
            >
              전체 보기
            </Link>
          </div>

          {!recentProducts || recentProducts.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">등록된 제품이 없습니다.</p>
          ) : (
            <ul className="mt-4 divide-y divide-neutral-100">
              {recentProducts.map((product) => {
                const active = product.is_active !== false
                return (
                  <li key={product.id} className="py-3">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="flex items-center justify-between gap-2 text-sm hover:text-neutral-700"
                    >
                      <div className="min-w-0">
                        <span className={`font-medium ${active ? 'text-neutral-800' : 'text-neutral-400'}`}>
                          {product.name ?? '이름 없음'}
                        </span>
                        {product.brand && (
                          <span className="ml-2 text-neutral-500">{product.brand}</span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {/* 카테고리명은 제품 상세에서 확인 */}
                        {!active && (
                          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
                            비활성
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
