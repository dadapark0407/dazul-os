'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

// TODO: 역할 기반 인증 추가 필요

type Guardian = {
  id: string
  name: string | null
  phone: string | null
}

type SortKey = 'name' | 'pet_count' | 'latest_visit'

export default function AdminGuardiansPage() {
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [petCountMap, setPetCountMap] = useState<Record<string, number>>({})
  const [latestVisitMap, setLatestVisitMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  // 필터 상태
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      const { data: guardiansData } = await supabase
        .from('guardians')
        .select('id, name, phone')
        .order('name')

      const safeGuardians = guardiansData ?? []
      setGuardians(safeGuardians)

      const guardianIds = safeGuardians.map((g) => g.id)

      if (guardianIds.length > 0) {
        // 보호자별 반려견 수 + 반려견 ID 수집
        const { data: pets } = await supabase
          .from('pets')
          .select('id, guardian_id')
          .in('guardian_id', guardianIds)

        const countMap: Record<string, number> = {}
        const petIdsByGuardian: Record<string, string[]> = {}

        for (const pet of pets ?? []) {
          if (pet.guardian_id) {
            countMap[pet.guardian_id] = (countMap[pet.guardian_id] ?? 0) + 1
            if (!petIdsByGuardian[pet.guardian_id]) {
              petIdsByGuardian[pet.guardian_id] = []
            }
            petIdsByGuardian[pet.guardian_id].push(pet.id)
          }
        }
        setPetCountMap(countMap)

        // 보호자별 최근 방문일
        const allPetIds = (pets ?? []).map((p) => p.id)
        if (allPetIds.length > 0) {
          const { data: visits } = await supabase
            .from('visit_records')
            .select('pet_id, visit_date')
            .in('pet_id', allPetIds)
            .order('visit_date', { ascending: false })

          // pet→guardian 역매핑
          const petToGuardian: Record<string, string> = {}
          for (const pet of pets ?? []) {
            if (pet.guardian_id) {
              petToGuardian[pet.id] = pet.guardian_id
            }
          }

          const visitMap: Record<string, string> = {}
          for (const v of visits ?? []) {
            if (v.pet_id && v.visit_date) {
              const gid = petToGuardian[v.pet_id]
              if (gid && !visitMap[gid]) {
                visitMap[gid] = v.visit_date
              }
            }
          }
          setLatestVisitMap(visitMap)
        }
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    let result = guardians.filter((g) => {
      if (!keyword) return true
      const name = (g.name ?? '').toLowerCase()
      const phone = (g.phone ?? '').toLowerCase()
      return name.includes(keyword) || phone.includes(keyword)
    })

    // 정렬
    if (sortKey === 'pet_count') {
      result = [...result].sort((a, b) => {
        return (petCountMap[b.id] ?? 0) - (petCountMap[a.id] ?? 0)
      })
    } else if (sortKey === 'latest_visit') {
      result = [...result].sort((a, b) => {
        const dateA = latestVisitMap[a.id] ?? ''
        const dateB = latestVisitMap[b.id] ?? ''
        if (!dateA && !dateB) return 0
        if (!dateA) return 1
        if (!dateB) return -1
        return dateB.localeCompare(dateA)
      })
    }

    return result
  }, [guardians, search, sortKey, petCountMap, latestVisitMap])

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">보호자 관리</h1>
        <p className="mt-1 text-sm text-neutral-500">총 {filtered.length}명</p>
      </div>

      {/* 검색 + 정렬 */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 전화번호 검색"
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500 sm:col-span-2"
          />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-500"
          >
            <option value="name">이름순</option>
            <option value="pet_count">반려견 수 많은 순</option>
            <option value="latest_visit">최근 방문순</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-neutral-600">불러오는 중...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-neutral-600">검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="px-4 py-3 font-semibold">이름</th>
                <th className="px-4 py-3 font-semibold">연락처</th>
                <th className="px-4 py-3 font-semibold">반려견</th>
                <th className="px-4 py-3 font-semibold">최근 방문</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr
                  key={g.id}
                  className="border-b border-neutral-100 transition hover:bg-neutral-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/guardians/${g.id}`}
                      className="font-medium text-neutral-900 underline-offset-4 hover:underline"
                    >
                      {g.name ?? '이름 없음'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{g.phone ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-neutral-100 px-2 text-xs font-semibold text-neutral-700">
                      {petCountMap[g.id] ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {formatDate(latestVisitMap[g.id])}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/record/new?guardianId=${g.id}`}
                      className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
                    >
                      기록 작성
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
