'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

// TODO: 역할 기반 인증 추가 필요
// TODO: 페이지네이션 / 무한 스크롤 추가 고려

type VisitRecord = {
  id: string
  visit_date: string | null
  service_type: string | null
  pet_id: string | null
  guardian_id: string | null
  created_at?: string | null
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

/** service_type 내 '스파 *' 항목을 이모지+풀네임 라벨로 교체 */
function formatServiceType(value?: string | null): string {
  if (!value) return '-'
  const map: Record<string, string> = {
    '스파 베이직': '베이직 코스',
    '스파 에센셜': '✨ 에센셜 스파 코스',
    '스파 시그니처': '💎 시그니처 팩 코스',
    '스파 프레스티지': '👑 프레스티지 풀 케어 코스',
  }
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => map[s] ?? s)
    .join(', ')
}

/** 오늘 기준 N일 전 날짜를 YYYY-MM-DD로 반환 */
function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

type ReportFilter = '전체' | '공유됨' | '미공유'

const DATE_PRESETS = [
  { label: '전체', from: '', to: '' },
  { label: '최근 7일', from: daysAgo(7), to: '' },
  { label: '최근 30일', from: daysAgo(30), to: '' },
  { label: '최근 90일', from: daysAgo(90), to: '' },
]

export default function AdminRecordsPage() {
  const [records, setRecords] = useState<VisitRecord[]>([])
  const [petMap, setPetMap] = useState<Record<string, string>>({})
  const [guardianMap, setGuardianMap] = useState<Record<string, string>>({})
  const [shareTokenMap, setShareTokenMap] = useState<Record<string, string>>({})
  // report_tokens 미사용 — guardian.share_token 기반으로 전환됨
  const [loading, setLoading] = useState(true)
  const [shareModal, setShareModal] = useState<{ token: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // 필터 상태
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [reportFilter, setReportFilter] = useState<ReportFilter>('전체')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      const { data: recordsData } = await supabase
        .from('visit_records')
        .select('id, visit_date, service_type, pet_id, guardian_id, created_at')
        .is('deleted_at', null)
        .order('visit_date', { ascending: false })
        .limit(200)

      const safeRecords = recordsData ?? []
      setRecords(safeRecords)

      // 반려견 이름 매핑
      const petIds = Array.from(
        new Set(safeRecords.map((r) => r.pet_id).filter(Boolean))
      ) as string[]

      if (petIds.length > 0) {
        const { data: pets } = await supabase
          .from('pets')
          .select('id, name')
          .in('id', petIds)

        const pMap: Record<string, string> = {}
        for (const p of pets ?? []) {
          pMap[p.id] = p.name ?? '이름 없음'
        }
        setPetMap(pMap)
      }

      // 보호자 이름 매핑
      const guardianIds = Array.from(
        new Set(safeRecords.map((r) => r.guardian_id).filter(Boolean))
      ) as string[]

      if (guardianIds.length > 0) {
        const { data: guardians } = await supabase
          .from('guardians')
          .select('id, name, share_token')
          .in('id', guardianIds)

        const gMap: Record<string, string> = {}
        const tMap: Record<string, string> = {}
        for (const g of guardians ?? []) {
          gMap[g.id] = g.name ?? '이름 없음'
          if (g.share_token) tMap[g.id] = g.share_token
        }
        setGuardianMap(gMap)
        setShareTokenMap(tMap)
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return records.filter((r) => {
      // 텍스트 검색
      if (keyword) {
        const petName = (petMap[r.pet_id ?? ''] ?? '').toLowerCase()
        const guardianName = (guardianMap[r.guardian_id ?? ''] ?? '').toLowerCase()
        const service = (r.service_type ?? '').toLowerCase()
        if (!petName.includes(keyword) && !guardianName.includes(keyword) && !service.includes(keyword)) {
          return false
        }
      }

      // 날짜 범위
      if (dateFrom && r.visit_date) {
        if (r.visit_date < dateFrom) return false
      }
      if (dateTo && r.visit_date) {
        if (r.visit_date > dateTo) return false
      }
      // 날짜 없는 기록은 범위 필터 시 제외
      if ((dateFrom || dateTo) && !r.visit_date) return false

      // 리포트 필터 — guardian.share_token 기준
      if (reportFilter !== '전체') {
        const hasToken = r.guardian_id ? !!shareTokenMap[r.guardian_id] : false
        if (reportFilter === '공유됨' && !hasToken) return false
        if (reportFilter === '미공유' && hasToken) return false
      }

      return true
    })
  }, [records, search, dateFrom, dateTo, reportFilter, petMap, guardianMap, shareTokenMap])

  // 그룹핑: visit_date + guardian_id 기준
  type RecordGroup = {
    key: string
    visitDate: string | null
    guardianId: string | null
    items: VisitRecord[]
  }

  const grouped = useMemo<RecordGroup[]>(() => {
    const map = new Map<string, RecordGroup>()
    for (const r of filtered) {
      // 보호자 미연결 기록은 레코드 ID로 분리 (합쳐질 일 없음)
      const key = r.guardian_id
        ? `${r.visit_date ?? ''}|${r.guardian_id}`
        : `${r.visit_date ?? ''}|__nog__|${r.id}`
      const existing = map.get(key)
      if (existing) {
        existing.items.push(r)
      } else {
        map.set(key, {
          key,
          visitDate: r.visit_date,
          guardianId: r.guardian_id,
          items: [r],
        })
      }
    }
    return Array.from(map.values())
  }, [filtered, guardianMap])

  const hasActiveFilters = search || dateFrom || dateTo || reportFilter !== '전체'

  function applyDatePreset(preset: typeof DATE_PRESETS[number]) {
    setDateFrom(preset.from)
    setDateTo(preset.to)
  }

  function resetFilters() {
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setReportFilter('전체')
  }

  async function handleSoftDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase
      .from('visit_records')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', deleteTarget)
    if (error) {
      alert(`삭제 실패: ${error.message}`)
      setDeleting(false)
      return
    }
    setRecords((prev) => prev.filter((r) => r.id !== deleteTarget))
    setDeleteTarget(null)
    setDeleting(false)
  }

  return (
    <div className="space-y-5">
      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm bg-white p-7"
            style={{ borderRadius: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: 15, fontWeight: 500, color: '#0A0A0A', marginBottom: 8 }}>
              기록 삭제
            </p>
            <p style={{ fontSize: 12, color: '#6B6B6B', lineHeight: 1.6, marginBottom: 20 }}>
              이 기록을 삭제하면 목록에서 사라집니다. 필요하면 휴지통에서 복구할 수 있습니다.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                style={{
                  flex: 1,
                  border: '1px solid #0A0A0A',
                  background: '#FFFFFF',
                  color: '#0A0A0A',
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  padding: 12,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.5 : 1,
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSoftDelete}
                disabled={deleting}
                style={{
                  flex: 1,
                  background: '#0A0A0A',
                  color: '#FFFFFF',
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  padding: 12,
                  border: 'none',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 공유 링크 모달 */}
      {shareModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShareModal(null)}
        >
          <div
            className="w-full max-w-md bg-white p-8"
            style={{ borderRadius: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-4 text-xs uppercase tracking-[0.15em] text-neutral-400">
              GROOMING LETTER
            </p>
            <div className="mb-4 flex items-center gap-2 border border-[#E8E5E0] px-3 py-2">
              <span className="flex-1 truncate text-xs text-neutral-600">
                {typeof window !== 'undefined'
                  ? `${window.location.origin}/report/${shareModal.token}`
                  : `/report/${shareModal.token}`}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    navigator.clipboard.writeText(
                      `${window.location.origin}/report/${shareModal.token}`
                    )
                    alert('복사되었습니다')
                  }
                }}
                className="whitespace-nowrap text-xs"
                style={{ color: '#C9A96E' }}
              >
                복사
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  window.open(`/report/${shareModal.token}`, '_blank', 'noopener,noreferrer')
                }
                className="flex-1 border border-[#E8E5E0] py-2 text-xs text-neutral-600"
              >
                새탭으로 미리보기
              </button>
              <button
                type="button"
                onClick={() => setShareModal(null)}
                className="flex-1 py-2 text-xs text-white"
                style={{ background: '#1A1A1A' }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">방문 기록</h1>
          <p className="mt-1 text-sm text-neutral-500">
            최근 200건 · {filtered.length}건 표시
          </p>
        </div>
        <Link
          href="/admin/records/new"
          className="shrink-0 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700"
        >
          새 기록 작성
        </Link>
      </div>

      {/* 검색 + 필터 */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
        <div className="grid gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="반려견, 보호자, 서비스 검색"
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
          />

          {/* 날짜 프리셋 + 커스텀 범위 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-neutral-500">기간:</span>
            {DATE_PRESETS.map((preset) => {
              const isActive = dateFrom === preset.from && dateTo === preset.to
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyDatePreset(preset)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
            <select
              value={reportFilter}
              onChange={(e) => setReportFilter(e.target.value as ReportFilter)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-500"
            >
              <option value="전체">리포트: 전체</option>
              <option value="공유됨">리포트: 공유됨</option>
              <option value="미공유">리포트: 미공유</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="w-fit rounded-xl border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-500 hover:bg-neutral-50"
            >
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-neutral-600">불러오는 중...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-neutral-600">
            {hasActiveFilters
              ? '검색 조건에 맞는 방문 기록이 없습니다.'
              : '등록된 방문 기록이 없습니다.'}
          </p>
          {!hasActiveFilters && (
            <Link
              href="/admin/records/new"
              className="mt-3 inline-block text-sm font-medium text-neutral-500 hover:text-neutral-700"
            >
              첫 방문 기록 작성하기 →
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="px-4 py-3 font-semibold">방문일</th>
                <th className="px-4 py-3 font-semibold">반려견</th>
                <th className="px-4 py-3 font-semibold">보호자</th>
                <th className="px-4 py-3 font-semibold">서비스</th>
                <th className="px-4 py-3 font-semibold">리포트</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((group) => {
                // 단독 방문: 기존 단일 행 형식 유지
                if (group.items.length === 1) {
                  const r = group.items[0]
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-neutral-100 transition hover:bg-neutral-50"
                    >
                      <td className="px-4 py-3 text-neutral-700">
                        <Link
                          href={`/admin/records/${r.id}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {formatDate(r.visit_date)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {r.pet_id ? (
                          <Link
                            href={`/admin/pets/${r.pet_id}`}
                            className="font-medium text-neutral-900 underline-offset-4 hover:underline"
                          >
                            {petMap[r.pet_id] ?? '-'}
                          </Link>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        {r.guardian_id ? (
                          <Link
                            href={`/admin/guardians/${r.guardian_id}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {guardianMap[r.guardian_id] ?? '-'}
                          </Link>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-500">
                        {formatServiceType(r.service_type)}
                      </td>
                      <td className="px-4 py-3">
                        <RowActions
                          record={r}
                          shareTokenMap={shareTokenMap}
                          guardianMap={guardianMap}
                          setShareModal={setShareModal}
                          setDeleteTarget={setDeleteTarget}
                        />
                      </td>
                    </tr>
                  )
                }

                // 다중 방문: 그룹 헤더 + 자식 행
                const guardianName = group.guardianId
                  ? (guardianMap[group.guardianId] ?? '-')
                  : '보호자 미연결'
                return (
                  <GroupBlock
                    key={group.key}
                    visitDate={group.visitDate}
                    guardianId={group.guardianId}
                    guardianName={guardianName}
                    items={group.items}
                    petMap={petMap}
                    shareTokenMap={shareTokenMap}
                    guardianMap={guardianMap}
                    setShareModal={setShareModal}
                    setDeleteTarget={setDeleteTarget}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── 공통 액션 버튼 (공유 링크 / 수정 / 삭제) ───
function RowActions({
  record,
  shareTokenMap,
  guardianMap,
  setShareModal,
  setDeleteTarget,
}: {
  record: VisitRecord
  shareTokenMap: Record<string, string>
  guardianMap: Record<string, string>
  setShareModal: (v: { token: string } | null) => void
  setDeleteTarget: (id: string | null) => void
}) {
  const { guardian_id, id } = record
  return (
    <div className="flex flex-wrap items-center gap-2">
      {guardian_id && shareTokenMap[guardian_id] ? (
        <button
          type="button"
          onClick={() => setShareModal({ token: shareTokenMap[guardian_id] })}
          style={{
            border: '1px solid #C9A96E',
            background: '#FFFFFF',
            color: '#C9A96E',
            borderRadius: 0,
            fontSize: 11,
            padding: '4px 10px',
            letterSpacing: '0.05em',
            cursor: 'pointer',
          }}
        >
          공유 링크
        </button>
      ) : guardian_id && guardianMap[guardian_id] ? (
        <span className="inline-block rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">
          미공유
        </span>
      ) : (
        <span className="text-xs text-neutral-400">보호자 미연결</span>
      )}
      <Link
        href={`/session/edit/${id}`}
        style={{
          border: '1px solid #E8E5E0',
          background: '#FFFFFF',
          color: '#8A8A7A',
          borderRadius: 0,
          fontSize: 11,
          padding: '4px 10px',
          textDecoration: 'none',
        }}
      >
        수정
      </Link>
      <button
        type="button"
        onClick={() => setDeleteTarget(id)}
        style={{
          border: '1px solid #E8E5E0',
          background: '#FFFFFF',
          color: '#8A8A7A',
          borderRadius: 0,
          fontSize: 11,
          padding: '4px 10px',
          cursor: 'pointer',
        }}
      >
        삭제
      </button>
    </div>
  )
}

// ─── 동일 날짜·보호자 묶음 (헤더 + 들여쓰기 자식 행) ───
function GroupBlock({
  visitDate,
  guardianId,
  guardianName,
  items,
  petMap,
  shareTokenMap,
  guardianMap,
  setShareModal,
  setDeleteTarget,
}: {
  visitDate: string | null
  guardianId: string | null
  guardianName: string
  items: VisitRecord[]
  petMap: Record<string, string>
  shareTokenMap: Record<string, string>
  guardianMap: Record<string, string>
  setShareModal: (v: { token: string } | null) => void
  setDeleteTarget: (id: string | null) => void
}) {
  return (
    <>
      {/* 그룹 헤더 */}
      <tr style={{ background: '#FAFAF8', borderBottom: '1px solid #F0EDE8' }}>
        <td className="px-4 py-2.5" style={{ color: '#1A1A1A', fontWeight: 600, fontSize: 13 }}>
          {formatDate(visitDate)}
        </td>
        <td className="px-4 py-2.5" colSpan={2} style={{ color: '#1A1A1A', fontWeight: 600, fontSize: 13 }}>
          {guardianId ? (
            <Link
              href={`/admin/guardians/${guardianId}`}
              className="underline-offset-4 hover:underline"
              style={{ color: '#1A1A1A' }}
            >
              {guardianName}
            </Link>
          ) : (
            guardianName
          )}
          <span className="ml-2 text-xs font-normal" style={{ color: '#8A8A7A' }}>
            반려견 {items.length}마리
          </span>
        </td>
        <td className="px-4 py-2.5" />
        <td className="px-4 py-2.5" />
      </tr>

      {/* 자식 행들 */}
      {items.map((r) => (
        <tr
          key={r.id}
          className="transition hover:bg-neutral-50"
          style={{ borderBottom: '1px solid #F0EDE8' }}
        >
          <td className="px-4 py-3" style={{ color: '#C9A96E', fontSize: 14, paddingLeft: 24 }}>
            ↳
          </td>
          <td className="px-4 py-3">
            {r.pet_id ? (
              <Link
                href={`/admin/pets/${r.pet_id}`}
                className="font-medium text-neutral-900 underline-offset-4 hover:underline"
              >
                {petMap[r.pet_id] ?? '-'}
              </Link>
            ) : (
              '-'
            )}
          </td>
          <td className="px-4 py-3 text-xs" style={{ color: '#8A8A7A' }}>
            <Link
              href={`/admin/records/${r.id}`}
              className="underline-offset-4 hover:underline"
            >
              상세 보기
            </Link>
          </td>
          <td className="px-4 py-3 text-neutral-500">
            {formatServiceType(r.service_type)}
          </td>
          <td className="px-4 py-3">
            <RowActions
              record={r}
              shareTokenMap={shareTokenMap}
              guardianMap={guardianMap}
              setShareModal={setShareModal}
              setDeleteTarget={setDeleteTarget}
            />
          </td>
        </tr>
      ))}
    </>
  )
}
