'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

// TODO: 역할 기반 인증 추가 필요

type Pet = {
  id: string
  name: string | null
  breed: string | null
  latest_visit: string | null
}

type Guardian = {
  id: string
  name: string | null
  phone: string | null
  pets: Pet[]
}

type SortKey = 'name' | 'pet_count' | 'latest_visit'

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

export default function AdminGuardiansPage() {
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // 필터 상태
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      // 1. 보호자 조회
      const { data: guardiansData } = await supabase
        .from('guardians')
        .select('id, name, phone')
        .is('deleted_at', null)
        .order('name')

      const safeGuardians = guardiansData ?? []
      const guardianIds = safeGuardians.map((g) => g.id)

      if (guardianIds.length === 0) {
        setGuardians([])
        setLoading(false)
        return
      }

      // 2. 반려견 조회
      const { data: petsData } = await supabase
        .from('pets')
        .select('id, name, breed, guardian_id')
        .in('guardian_id', guardianIds)
        .is('deleted_at', null)

      const safePets = petsData ?? []
      const petIds = safePets.map((p) => p.id)

      // 3. 방문 기록 — 각 반려견별 최근 방문일
      const petLatestMap: Record<string, string> = {}
      if (petIds.length > 0) {
        const { data: visitsData } = await supabase
          .from('visit_records')
          .select('pet_id, visit_date')
          .in('pet_id', petIds)
          .is('deleted_at', null)
          .order('visit_date', { ascending: false })

        for (const v of visitsData ?? []) {
          if (v.pet_id && v.visit_date && !petLatestMap[v.pet_id]) {
            petLatestMap[v.pet_id] = v.visit_date
          }
        }
      }

      // 4. 보호자에 반려견 배열 매핑
      const result: Guardian[] = safeGuardians.map((g) => {
        const myPets: Pet[] = safePets
          .filter((p) => p.guardian_id === g.id)
          .map((p) => ({
            id: p.id,
            name: p.name ?? null,
            breed: p.breed ?? null,
            latest_visit: petLatestMap[p.id] ?? null,
          }))
        return {
          id: g.id,
          name: g.name ?? null,
          phone: g.phone ?? null,
          pets: myPets,
        }
      })

      setGuardians(result)
      setLoading(false)
    }

    fetchData()
  }, [])

  // 보호자의 최근 방문일 = 소속 반려견 중 가장 최근 방문
  function guardianLatestVisit(g: Guardian): string | null {
    let latest: string | null = null
    for (const p of g.pets) {
      if (p.latest_visit && (!latest || p.latest_visit > latest)) {
        latest = p.latest_visit
      }
    }
    return latest
  }

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    let result = guardians.filter((g) => {
      if (!keyword) return true
      const name = (g.name ?? '').toLowerCase()
      const phone = (g.phone ?? '').toLowerCase()
      // 반려견 이름도 검색 대상
      const petNames = g.pets.map((p) => (p.name ?? '').toLowerCase()).join(' ')
      return (
        name.includes(keyword) ||
        phone.includes(keyword) ||
        petNames.includes(keyword)
      )
    })

    if (sortKey === 'pet_count') {
      result = [...result].sort((a, b) => b.pets.length - a.pets.length)
    } else if (sortKey === 'latest_visit') {
      result = [...result].sort((a, b) => {
        const la = guardianLatestVisit(a) ?? ''
        const lb = guardianLatestVisit(b) ?? ''
        if (!la && !lb) return 0
        if (!la) return 1
        if (!lb) return -1
        return lb.localeCompare(la)
      })
    }

    return result
  }, [guardians, search, sortKey])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">보호자 관리</h1>
        <p className="mt-1 text-sm text-neutral-500">총 {filtered.length}명</p>
      </div>

      {/* 검색 + 정렬 */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E8E5E0', padding: 16 }}>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="보호자 이름, 연락처, 반려견 이름 검색"
            className="w-full border px-4 py-3 text-sm outline-none sm:col-span-2"
            style={{ borderColor: '#E8E5E0', borderRadius: 0 }}
          />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="w-full border bg-white px-4 py-3 text-sm outline-none"
            style={{ borderColor: '#E8E5E0', borderRadius: 0 }}
          >
            <option value="name">이름순</option>
            <option value="pet_count">반려견 수 많은 순</option>
            <option value="latest_visit">최근 방문순</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E8E5E0',
            padding: '40px 24px',
            textAlign: 'center',
          }}
        >
          <p className="text-sm text-neutral-600">불러오는 중...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E8E5E0',
            padding: '40px 24px',
            textAlign: 'center',
          }}
        >
          <p className="text-sm text-neutral-600">
            {search ? '검색 조건에 맞는 보호자가 없습니다.' : '등록된 보호자가 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto" style={{ background: '#FFFFFF', border: '1px solid #E8E5E0' }}>
          <table className="min-w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #E8E5E0' }} className="text-left text-neutral-500">
                <th className="px-4 py-3 font-semibold">이름</th>
                <th className="px-4 py-3 font-semibold">연락처</th>
                <th className="px-4 py-3 font-semibold">반려견 수</th>
                <th className="px-4 py-3 font-semibold">최근 방문</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => {
                const expanded = expandedId === g.id
                const latest = guardianLatestVisit(g)
                return (
                  <GuardianRows
                    key={g.id}
                    guardian={g}
                    expanded={expanded}
                    latest={latest}
                    onToggle={() => setExpandedId(expanded ? null : g.id)}
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

function GuardianRows({
  guardian,
  expanded,
  latest,
  onToggle,
}: {
  guardian: Guardian
  expanded: boolean
  latest: string | null
  onToggle: () => void
}) {
  return (
    <>
      {/* 보호자 행 — 클릭으로 펼침 */}
      <tr
        onClick={onToggle}
        style={{
          borderBottom: '1px solid #F0EDE8',
          cursor: 'pointer',
          background: expanded ? '#FAFAF8' : '#FFFFFF',
        }}
        className="transition-colors hover:bg-neutral-50"
      >
        <td className="px-4 py-3">
          <span className="font-medium text-neutral-900">
            {guardian.name ?? '이름 없음'}
          </span>
          <span className="ml-2 text-neutral-400" style={{ fontSize: 11 }}>
            {expanded ? '▾' : '▸'}
          </span>
        </td>
        <td className="px-4 py-3 text-neutral-700">{guardian.phone ?? '-'}</td>
        <td className="px-4 py-3">
          <span
            className="inline-flex h-6 min-w-6 items-center justify-center px-2 text-xs font-semibold"
            style={{ background: '#F0EDE8', color: '#6B6B6B', borderRadius: 0 }}
          >
            {guardian.pets.length}
          </span>
        </td>
        <td className="px-4 py-3 text-neutral-500">{formatDate(latest)}</td>
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/admin/guardians/${guardian.id}`}
            style={{
              border: '1px solid #C9A96E',
              color: '#C9A96E',
              padding: '4px 10px',
              fontSize: 11,
              letterSpacing: '0.05em',
              textDecoration: 'none',
              background: '#FFFFFF',
            }}
          >
            상세
          </Link>
        </td>
      </tr>

      {/* 펼쳐진 반려견 행들 */}
      {expanded && guardian.pets.length === 0 && (
        <tr style={{ background: '#FAFAF8' }}>
          <td colSpan={5} className="px-4 py-3 text-center text-xs text-neutral-400">
            등록된 반려견이 없습니다.
          </td>
        </tr>
      )}
      {expanded &&
        guardian.pets.map((pet) => (
          <tr
            key={pet.id}
            style={{
              background: '#FAFAF8',
              borderBottom: '1px solid #F0EDE8',
            }}
          >
            <td colSpan={3} className="px-4 py-3">
              <Link
                href={`/admin/pets/${pet.id}`}
                className="inline-flex items-center gap-2 text-sm"
                style={{
                  color: '#1A1A1A',
                  textDecoration: 'none',
                  paddingLeft: 24,
                }}
              >
                <span>🐶</span>
                <span className="font-medium underline-offset-4 hover:underline">
                  {pet.name ?? '이름 없음'}
                </span>
                {pet.breed && (
                  <span className="text-xs" style={{ color: '#8A8A7A' }}>
                    {pet.breed}
                  </span>
                )}
              </Link>
            </td>
            <td className="px-4 py-3 text-xs" style={{ color: '#8A8A7A' }}>
              {formatDate(pet.latest_visit)}
            </td>
            <td className="px-4 py-3" />
          </tr>
        ))}
    </>
  )
}
