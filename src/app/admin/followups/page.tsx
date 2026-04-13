'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// TODO: 역할 기반 인증 추가 필요
// TODO: 방문 기록 저장 시 next_visit_recommendation 기반 자동 팔로업 생성

type Followup = {
  id: string
  pet_id?: string | null
  guardian_id?: string | null
  related_record_id?: string | null
  type: string
  status: string
  due_date?: string | null
  note?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type NameMap = Record<string, string>

const STATUS_TABS = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '대기' },
  { key: 'completed', label: '완료' },
  { key: 'skipped', label: '건너뜀' },
] as const

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: '대기' },
  completed: { bg: 'bg-green-50', text: 'text-green-700', label: '완료' },
  skipped: { bg: 'bg-neutral-100', text: 'text-neutral-500', label: '건너뜀' },
  // 하위 호환: 기존 cancelled 상태도 표시
  cancelled: { bg: 'bg-neutral-100', text: 'text-neutral-500', label: '취소' },
}

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

function isDueSoon(dueDateStr?: string | null): boolean {
  if (!dueDateStr) return false
  const due = new Date(dueDateStr)
  const now = new Date()
  const diff = due.getTime() - now.getTime()
  return diff >= 0 && diff <= 3 * 24 * 60 * 60 * 1000
}

function isOverdue(dueDateStr?: string | null): boolean {
  if (!dueDateStr) return false
  const due = new Date(dueDateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return due < now
}

export default function AdminFollowupsPage() {
  const [followups, setFollowups] = useState<Followup[]>([])
  const [loading, setLoading] = useState(true)
  const [tableExists, setTableExists] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [petMap, setPetMap] = useState<NameMap>({})
  const [guardianMap, setGuardianMap] = useState<NameMap>({})

  const fetchData = useCallback(async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('followups')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(200)

    if (error) {
      console.error('followups fetch error:', error)
      setTableExists(false)
      setLoading(false)
      return
    }

    const rows = data ?? []
    setFollowups(rows)

    const petIds = [...new Set(rows.map((r) => r.pet_id).filter(Boolean))] as string[]
    const guardianIds = [...new Set(rows.map((r) => r.guardian_id).filter(Boolean))] as string[]

    const [petsResult, guardiansResult] = await Promise.all([
      petIds.length > 0
        ? supabase.from('pets').select('id, name').in('id', petIds)
        : Promise.resolve({ data: [] }),
      guardianIds.length > 0
        ? supabase.from('guardians').select('id, name').in('id', guardianIds)
        : Promise.resolve({ data: [] }),
    ])

    const pMap: NameMap = {}
    for (const p of petsResult.data ?? []) pMap[p.id] = p.name ?? '이름 없음'
    setPetMap(pMap)

    const gMap: NameMap = {}
    for (const g of guardiansResult.data ?? []) gMap[g.id] = g.name ?? '이름 없음'
    setGuardianMap(gMap)

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 빠른 상태 변경
  async function quickStatusChange(id: string, newStatus: string) {
    setUpdatingId(id)

    const { error } = await supabase
      .from('followups')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)

    setUpdatingId(null)

    if (error) {
      alert(`상태 변경 실패: ${error.message}`)
      return
    }

    // 로컬 상태 즉시 반영
    setFollowups((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: newStatus } : f))
    )
  }

  // 필터링
  const filtered = followups.filter((f) => {
    if (statusFilter !== 'all' && f.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const petName = (f.pet_id && petMap[f.pet_id]) || ''
      const guardianName = (f.guardian_id && guardianMap[f.guardian_id]) || ''
      const noteText = f.note || ''
      const typeText = f.type || ''
      if (
        !petName.toLowerCase().includes(q) &&
        !guardianName.toLowerCase().includes(q) &&
        !noteText.toLowerCase().includes(q) &&
        !typeText.toLowerCase().includes(q)
      ) {
        return false
      }
    }
    return true
  })

  const pendingCount = followups.filter((f) => f.status === 'pending').length
  const overdueCount = followups.filter(
    (f) => f.status === 'pending' && isOverdue(f.due_date)
  ).length

  // 테이블 없음 플레이스홀더
  if (!loading && !tableExists) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">후속 관리</h1>
          <p className="mt-1 text-sm text-neutral-500">아이별 후속 관리 추적</p>
        </div>
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <p className="text-base font-semibold text-neutral-700">
            followups 테이블이 아직 준비되지 않았습니다
          </p>
          <p className="mt-3 text-sm leading-6 text-neutral-500">
            Supabase에 followups 테이블을 생성하면 이 페이지에서 바로 사용할 수 있습니다.
          </p>
          <div className="mx-auto mt-6 max-w-lg rounded-xl bg-neutral-50 p-5 text-left">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              추천 스키마
            </p>
            <pre className="overflow-x-auto text-xs leading-5 text-neutral-700">
{`create table if not exists followups (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid references pets(id) on delete cascade,
  guardian_id uuid references guardians(id) on delete set null,
  related_record_id uuid references visit_records(id) on delete set null,
  type text not null,
  status text not null default 'pending',
  due_date date,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);`}
            </pre>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">후속 관리</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {loading
              ? '불러오는 중...'
              : `총 ${followups.length}건 · 대기 ${pendingCount}건${
                  overdueCount > 0 ? ` · 기한 초과 ${overdueCount}건` : ''
                }`}
          </p>
        </div>
        <Link
          href="/admin/followups/new"
          className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700"
        >
          + 새 팔로업
        </Link>
      </div>

      {/* 통계 카드 */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-yellow-50 p-4 text-center">
            <p className="text-2xl font-bold text-yellow-700">{pendingCount}</p>
            <p className="mt-1 text-xs font-medium text-yellow-600">대기</p>
          </div>
          <div className="rounded-xl bg-red-50 p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
            <p className="mt-1 text-xs font-medium text-red-500">기한 초과</p>
          </div>
          <div className="rounded-xl bg-green-50 p-4 text-center">
            <p className="text-2xl font-bold text-green-700">
              {followups.filter((f) => f.status === 'completed').length}
            </p>
            <p className="mt-1 text-xs font-medium text-green-600">완료</p>
          </div>
        </div>
      )}

      {/* 검색 + 상태 필터 */}
      <div className="space-y-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="반려견, 보호자, 유형, 메모 검색..."
          className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
        />
        <div className="flex gap-2 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
                statusFilter === tab.key
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-neutral-600">불러오는 중...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-neutral-600">
            {search || statusFilter !== 'all'
              ? '조건에 맞는 항목이 없습니다.'
              : '등록된 후속 관리 항목이 없습니다.'}
          </p>
          {!search && statusFilter === 'all' && (
            <Link
              href="/admin/followups/new"
              className="mt-3 inline-block text-sm font-medium text-neutral-500 hover:text-neutral-700"
            >
              첫 팔로업 등록하기 →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((f) => {
            const badge = STATUS_BADGE[f.status] ?? STATUS_BADGE.pending
            const overdue = f.status === 'pending' && isOverdue(f.due_date)
            const dueSoon = f.status === 'pending' && !overdue && isDueSoon(f.due_date)
            const isUpdating = updatingId === f.id

            return (
              <div
                key={f.id}
                className={`rounded-2xl bg-white p-5 shadow-sm ring-1 transition ${
                  overdue
                    ? 'ring-red-200'
                    : dueSoon
                      ? 'ring-yellow-200'
                      : 'ring-neutral-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/admin/followups/${f.id}`}
                    className="min-w-0 flex-1"
                  >
                    {/* 유형 + 상태 */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                        {f.type}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}
                      >
                        {badge.label}
                      </span>
                      {overdue && (
                        <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
                          기한 초과
                        </span>
                      )}
                      {dueSoon && (
                        <span className="rounded-full bg-yellow-50 px-2.5 py-0.5 text-xs font-medium text-yellow-600">
                          곧 마감
                        </span>
                      )}
                    </div>

                    {/* 메모 */}
                    <p className="mt-2 line-clamp-2 text-sm text-neutral-800">
                      {f.note ?? '메모 없음'}
                    </p>

                    {/* 메타 */}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                      {f.due_date && <span>기한: {formatDate(f.due_date)}</span>}
                      {f.pet_id && petMap[f.pet_id] && (
                        <span>🐾 {petMap[f.pet_id]}</span>
                      )}
                      {f.guardian_id && guardianMap[f.guardian_id] && (
                        <span>👤 {guardianMap[f.guardian_id]}</span>
                      )}
                    </div>
                  </Link>

                  {/* 빠른 상태 변경 버튼 */}
                  {f.status === 'pending' && (
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => quickStatusChange(f.id, 'completed')}
                        disabled={isUpdating}
                        className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                      >
                        {isUpdating ? '...' : '완료'}
                      </button>
                      <button
                        type="button"
                        onClick={() => quickStatusChange(f.id, 'skipped')}
                        disabled={isUpdating}
                        className="rounded-lg bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
                      >
                        {isUpdating ? '...' : '건너뜀'}
                      </button>
                    </div>
                  )}
                  {(f.status === 'completed' || f.status === 'skipped' || f.status === 'cancelled') && (
                    <button
                      type="button"
                      onClick={() => quickStatusChange(f.id, 'pending')}
                      disabled={isUpdating}
                      className="shrink-0 rounded-lg bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-100 disabled:opacity-50"
                    >
                      {isUpdating ? '...' : '복원'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
