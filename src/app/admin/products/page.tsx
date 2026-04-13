'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

// TODO: 역할 기반 인증 추가 필요
// TODO: 제품 추가 기능 연동 예정

type Product = {
  id: string
  product_name: string | null
  brand: string | null
  category: string | null
  active?: boolean | null
  created_at?: string | null
}

type ActiveFilter = '전체' | '활성' | '비활성'

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
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

      const { data, error: fetchError } = await supabase
        .from('products')
        .select('id, product_name, brand, category, active, created_at')
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

      setProducts(data ?? [])
      setLoading(false)
    }

    fetchData()
  }, [])

  // 카테고리 목록 추출
  const categoryOptions = useMemo(() => {
    const cats = products
      .map((p) => p.category)
      .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
    return ['전체', ...Array.from(new Set(cats)).sort()]
  }, [products])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return products.filter((p) => {
      // 텍스트 검색
      if (keyword) {
        const name = (p.product_name ?? '').toLowerCase()
        const brand = (p.brand ?? '').toLowerCase()
        const category = (p.category ?? '').toLowerCase()
        if (!name.includes(keyword) && !brand.includes(keyword) && !category.includes(keyword)) {
          return false
        }
      }

      // 카테고리 필터
      if (categoryFilter !== '전체') {
        if ((p.category ?? '') !== categoryFilter) return false
      }

      // 활성 상태 필터
      if (activeFilter === '활성' && p.active === false) return false
      if (activeFilter === '비활성' && p.active !== false) return false

      return true
    })
  }, [products, search, categoryFilter, activeFilter])

  const hasActiveFilters = search || categoryFilter !== '전체' || activeFilter !== '전체'

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">제품 관리</h1>
          <p className="mt-1 text-sm text-neutral-500">총 {filtered.length}개</p>
        </div>
        {/* TODO: 제품 추가 라우트 연결 */}
        <button
          type="button"
          disabled
          className="shrink-0 rounded-xl bg-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-400 cursor-not-allowed"
        >
          제품 추가 (준비 중)
        </button>
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
          <p className="text-sm text-neutral-600">검색 결과가 없습니다.</p>
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
                  <td className="px-4 py-3 text-neutral-500">{p.category ?? '-'}</td>
                  <td className="px-4 py-3">
                    {p.active === false ? (
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
