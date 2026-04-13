'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

// TODO: 역할 기반 인증 추가 필요

type Pet = {
  id: string
  name: string | null
  breed: string | null
  guardian_id: string | null
  active?: boolean | null
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

type SortKey = 'name' | 'latest_visit'

export default function AdminPetsPage() {
  const [pets, setPets] = useState<Pet[]>([])
  const [guardianMap, setGuardianMap] = useState<Record<string, string>>({})
  const [latestVisitMap, setLatestVisitMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  // 필터 상태
  const [search, setSearch] = useState('')
  const [breedFilter, setBreedFilter] = useState('전체')
  const [sortKey, setSortKey] = useState<SortKey>('name')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      const { data: petsData } = await supabase
        .from('pets')
        .select('id, name, breed, guardian_id, active, created_at')
        .order('name')

      const safePets = petsData ?? []
      setPets(safePets)

      // 보호자 이름 매핑
      const guardianIds = Array.from(
        new Set(safePets.map((p) => p.guardian_id).filter(Boolean))
      ) as string[]

      if (guardianIds.length > 0) {
        const { data: guardians } = await supabase
          .from('guardians')
          .select('id, name')
          .in('id', guardianIds)

        const map: Record<string, string> = {}
        for (const g of guardians ?? []) {
          map[g.id] = g.name ?? '이름 없음'
        }
        setGuardianMap(map)
      }

      // 최근 방문일 매핑
      const petIds = safePets.map((p) => p.id)
      if (petIds.length > 0) {
        const { data: visits } = await supabase
          .from('visit_records')
          .select('pet_id, visit_date')
          .in('pet_id', petIds)
          .order('visit_date', { ascending: false })

        const visitMap: Record<string, string> = {}
        for (const v of visits ?? []) {
          if (v.pet_id && !visitMap[v.pet_id] && v.visit_date) {
            visitMap[v.pet_id] = v.visit_date
          }
        }
        setLatestVisitMap(visitMap)
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  // 품종 목록 추출
  const breedOptions = useMemo(() => {
    const breeds = pets
      .map((p) => p.breed)
      .filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
    return ['전체', ...Array.from(new Set(breeds)).sort()]
  }, [pets])

  // 필터 + 정렬
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    let result = pets.filter((pet) => {
      // 텍스트 검색
      if (keyword) {
        const name = (pet.name ?? '').toLowerCase()
        const breed = (pet.breed ?? '').toLowerCase()
        const guardianName = (guardianMap[pet.guardian_id ?? ''] ?? '').toLowerCase()
        if (!name.includes(keyword) && !breed.includes(keyword) && !guardianName.includes(keyword)) {
          return false
        }
      }

      // 품종 필터
      if (breedFilter !== '전체') {
        if ((pet.breed ?? '') !== breedFilter) return false
      }

      return true
    })

    // 정렬
    if (sortKey === 'latest_visit') {
      result = [...result].sort((a, b) => {
        const dateA = latestVisitMap[a.id] ?? ''
        const dateB = latestVisitMap[b.id] ?? ''
        // 방문 기록 없는 건 맨 뒤로
        if (!dateA && !dateB) return 0
        if (!dateA) return 1
        if (!dateB) return -1
        return dateB.localeCompare(dateA)
      })
    }
    // 'name' 정렬은 DB에서 이미 정렬됨

    return result
  }, [pets, search, breedFilter, sortKey, guardianMap, latestVisitMap])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">반려견 관리</h1>
          <p className="mt-1 text-sm text-neutral-500">총 {filtered.length}마리</p>
        </div>
      </div>

      {/* 검색 + 필터 */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 품종, 보호자 검색"
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500 sm:col-span-3"
          />
          <select
            value={breedFilter}
            onChange={(e) => setBreedFilter(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-500"
          >
            {breedOptions.map((b) => (
              <option key={b} value={b}>{b === '전체' ? '품종 전체' : b}</option>
            ))}
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-500"
          >
            <option value="name">이름순</option>
            <option value="latest_visit">최근 방문순</option>
          </select>
          {(search || breedFilter !== '전체' || sortKey !== 'name') && (
            <button
              type="button"
              onClick={() => { setSearch(''); setBreedFilter('전체'); setSortKey('name') }}
              className="rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-500 hover:bg-neutral-50"
            >
              초기화
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
            {search || breedFilter !== '전체'
              ? '검색 조건에 맞는 반려견이 없습니다.'
              : '등록된 반려견이 없습니다.'}
          </p>
          {!search && breedFilter === '전체' && (
            <p className="mt-2 text-xs text-neutral-400">
              방문 기록 작성 시 반려견이 자동으로 등록됩니다.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="px-4 py-3 font-semibold">이름</th>
                <th className="px-4 py-3 font-semibold">품종</th>
                <th className="px-4 py-3 font-semibold">보호자</th>
                <th className="px-4 py-3 font-semibold">최근 방문일</th>
                <th className="px-4 py-3 font-semibold">상태</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pet) => (
                <tr
                  key={pet.id}
                  className="border-b border-neutral-100 transition hover:bg-neutral-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/pets/${pet.id}`}
                      className="font-medium text-neutral-900 underline-offset-4 hover:underline"
                    >
                      {pet.name ?? '이름 없음'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{pet.breed ?? '-'}</td>
                  <td className="px-4 py-3 text-neutral-700">
                    {pet.guardian_id ? (
                      <Link
                        href={`/admin/guardians/${pet.guardian_id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {guardianMap[pet.guardian_id] ?? '-'}
                      </Link>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {formatDate(latestVisitMap[pet.id])}
                  </td>
                  <td className="px-4 py-3">
                    {pet.active === false ? (
                      <span className="inline-block rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">
                        비활성
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                        활성
                      </span>
                    )}
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
