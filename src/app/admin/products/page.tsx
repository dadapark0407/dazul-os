'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

// TODO: 역할 기반 인증 추가 필요
// TODO: 제품 추가 기능 연동 예정

type ActiveFilter = '전체' | '활성' | '비활성'

export default function AdminProductsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [products, setProducts] = useState<Record<string, any>[]>([])
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 필터 상태
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('전체')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('전체')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError('')

      // 1) 제품: select('*')로 모든 컬럼 안전하게 가져옴
      //    — category (old enum), category_id (new FK) 모두 포함
      const { data: rows, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .order('product_name')

      if (fetchError) {
        console.error('products fetch error:', fetchError)
        setError(
          fetchError.message.includes('does not exist')
            ? 'products 테이블이 아직 존재하지 않습니다.'
            : `제품 목록을 불러오지 못했습니다: ${fetchError.message}`
        )
        setLoading(false)
        return
      }

      setProducts(rows ?? [])

      // 2) 카테고리 이름 맵 — 테이블이 없으면 무시
      const { data: cats } = await supabase
        .from('product_categories')
        .select('id, name, parent_id')
        .order('sort_order')
        .order('name')

      const cMap: Record<string, string> = {}
      if (cats) {
        for (const c of cats) {
          const parent = cats.find((p) => p.id === c.parent_id)
          cMap[c.id] = parent ? `${parent.name} > ${c.name}` : c.name
        }
      }
      setCategoryMap(cMap)

      setLoading(false)
    }

    fetchData()
  }, [])

  // 카테고리명 해석: category_id → old category → 미분류
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getCategoryName(p: Record<string, any>): string {
    // 1. 새 FK 관계가 있으면 우선
    if (p.category_id && categoryMap[p.category_id]) {
      return categoryMap[p.category_id]
    }
    // 2. 기존 category enum 텍스트
    if (typeof p.category === 'string' && p.category.trim()) {
      return p.category
    }
    // 3. 둘 다 없음
    return '미분류'
  }

  // 카테고리 필터 옵션
  const categoryOptions = useMemo(() => {
    const names = new Set<string>()
    for (const p of products) {
      const name = getCategoryName(p)
      if (name !== '미분류') names.add(name)
    }
    return ['전체', ...Array.from(names).sort()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, categoryMap])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return products.filter((p) => {
      const catName = getCategoryName(p)

      // 텍스트 검색
      if (keyword) {
        const name = ((p.product_name as string) ?? '').toLowerCase()
        const brand = ((p.brand as string) ?? '').toLowerCase()
        const catLower = catName.toLowerCase()
        if (!name.includes(keyword) && !brand.includes(keyword) && !catLower.includes(keyword)) {
          return false
        }
      }

      // 카테고리 필터
      if (categoryFilter !== '전체') {
        if (catName !== categoryFilter) return false
      }

      // 활성 상태 필터
      if (activeFilter === '활성' && p.is_active === false) return false
      if (activeFilter === '비활성' && p.is_active !== false) return false

      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, search, categoryFilter, activeFilter, categoryMap])

  const hasActiveFilters = search || categoryFilter !== '전체' || activeFilter !== '전체'

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">제품 관리</h1>
          <p className="mt-1 text-sm text-neutral-500">총 {filtered.length}개</p>
        </div>
        <Link
          href="/admin/products/new"
          className="shrink-0 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700"
        >
          + 제품 추가
        </Link>
      </div>

      {/* 검색 + 필터 */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제품명, 브랜드, 카테고리 검색"
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500 sm:col-span-3"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-500"
          >
            {categoryOptions.map((c) => (
              <option key={c} value={c}>{c === '전체' ? '카테고리 전체' : c}</option>
            ))}
          </select>
          <div className="flex gap-2">
            {(['전체', '활성', '비활성'] as ActiveFilter[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setActiveFilter(status)}
                className={`flex-1 rounded-xl px-3 py-3 text-xs font-medium transition ${
                  activeFilter === status
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => { setSearch(''); setCategoryFilter('전체'); setActiveFilter('전체') }}
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
      ) : error ? (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-amber-800">{error}</p>
          <p className="mt-2 text-xs text-amber-600">
            테이블 구조를 확인하거나 Supabase 대시보드에서 products 테이블을 점검해주세요.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-neutral-600">
            {products.length === 0 ? '등록된 제품이 없습니다.' : '검색 결과가 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="px-4 py-3 font-semibold">제품명</th>
                <th className="px-4 py-3 font-semibold">브랜드</th>
                <th className="px-4 py-3 font-semibold">카테고리</th>
                <th className="px-4 py-3 font-semibold">상태</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-neutral-100 transition hover:bg-neutral-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="font-medium text-neutral-900 underline-offset-4 hover:underline"
                    >
                      {p.product_name ?? '-'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{p.brand ?? '-'}</td>
                  <td className="px-4 py-3 text-neutral-500">{getCategoryName(p)}</td>
                  <td className="px-4 py-3">
                    {p.is_active === false ? (
                      <span className="inline-block rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">
                        비활성
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                        활성
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/products/${p.id}/edit`}
                      className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
                    >
                      수정
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
