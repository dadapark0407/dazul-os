'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

// TODO: 역할 기반 인증 추가 필요
// TODO: 제품 추가 기능 연동 예정

type ActiveFilter = '전체' | '활성' | '비활성'

type UsageEntry = { name: string; count: number }

export default function AdminProductsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [products, setProducts] = useState<Record<string, any>[]>([])
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({})
  const [visitRecords, setVisitRecords] = useState<Array<{ care_actions: string | null; visit_date: string | null }>>([])
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
        .order('name')

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

      // 3) 방문 기록 care_actions 조회 (통계용)
      const { data: visits } = await supabase
        .from('visit_records')
        .select('care_actions, visit_date')
      setVisitRecords((visits ?? []) as Array<{ care_actions: string | null; visit_date: string | null }>)

      setLoading(false)
    }

    fetchData()
  }, [])

  // ─── 제품 사용 통계 ───
  const stats = useMemo(() => {
    // "이름 (브랜드)" 에서 이름만 추출
    function parseProductNames(raw: string | null): string[] {
      if (!raw) return []
      return raw
        .split(',')
        .map((part) => part.trim().replace(/\s*\([^)]*\)\s*$/, '').trim())
        .filter(Boolean)
    }

    const now = new Date()
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`

    const overall: Record<string, number> = {}
    const thisMonth: Record<string, number> = {}
    const prevMonth: Record<string, number> = {}

    for (const v of visitRecords) {
      const names = parseProductNames(v.care_actions)
      const vd = v.visit_date ?? ''
      const monthKey = vd.slice(0, 7)
      for (const n of names) {
        overall[n] = (overall[n] ?? 0) + 1
        if (monthKey === thisMonthKey) thisMonth[n] = (thisMonth[n] ?? 0) + 1
        else if (monthKey === lastMonthKey) prevMonth[n] = (prevMonth[n] ?? 0) + 1
      }
    }

    // 제품명 → {브랜드, 카테고리} 맵
    const productInfo: Record<string, { brand: string | null; category: string }> = {}
    for (const p of products) {
      const name = (p.name as string) ?? (p.product_name as string) ?? null
      if (!name) continue
      productInfo[name] = {
        brand: (p.brand as string) ?? null,
        category: getCategoryName(p),
      }
    }

    // 전체 TOP5
    const overallTop5: Array<UsageEntry & { brand: string | null; category: string }> = Object.entries(overall)
      .map(([name, count]) => ({
        name,
        count,
        brand: productInfo[name]?.brand ?? null,
        category: productInfo[name]?.category ?? '미분류',
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // 카테고리별 TOP3
    const byCategory: Record<string, Array<UsageEntry & { brand: string | null }>> = {}
    for (const [name, count] of Object.entries(overall)) {
      const cat = productInfo[name]?.category ?? '미분류'
      if (!byCategory[cat]) byCategory[cat] = []
      byCategory[cat].push({
        name,
        count,
        brand: productInfo[name]?.brand ?? null,
      })
    }
    const categoryTop3: Record<string, Array<UsageEntry & { brand: string | null }>> = {}
    for (const [cat, items] of Object.entries(byCategory)) {
      categoryTop3[cat] = items.sort((a, b) => b.count - a.count).slice(0, 3)
    }

    // 이번달 vs 저번달 — 사용량 변화가 큰 제품 TOP5 (증가/감소)
    const allNamesInRange = new Set([...Object.keys(thisMonth), ...Object.keys(prevMonth)])
    const deltas = [...allNamesInRange]
      .map((name) => ({
        name,
        brand: productInfo[name]?.brand ?? null,
        thisCount: thisMonth[name] ?? 0,
        prevCount: prevMonth[name] ?? 0,
        delta: (thisMonth[name] ?? 0) - (prevMonth[name] ?? 0),
      }))
      .filter((d) => d.delta !== 0)
    const topIncrease = deltas.filter((d) => d.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3)
    const topDecrease = deltas.filter((d) => d.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3)

    const maxOverall = overallTop5.length > 0 ? overallTop5[0].count : 0

    return {
      overallTop5,
      categoryTop3,
      topIncrease,
      topDecrease,
      maxOverall,
      hasData: Object.keys(overall).length > 0,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitRecords, products, categoryMap])

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
        const name = ((p.name as string) ?? (p.product_name as string) ?? '').toLowerCase()
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

      {/* 제품 사용 통계 */}
      {stats.hasData && (
        <section style={{ border: '1px solid #E8E5E0', padding: 24, background: '#FFFFFF' }}>
          <p style={{ fontSize: 11, letterSpacing: '0.15em', color: '#8A8A7A', textTransform: 'uppercase' as const }}>
            Product Analytics
          </p>

          <div className="mt-4 grid gap-6 lg:grid-cols-3">
            {/* 전체 TOP5 */}
            <div>
              <p style={{ fontSize: 11, letterSpacing: '0.1em', color: '#8A8A7A', marginBottom: 12 }}>
                전체 사용 TOP 5
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {stats.overallTop5.length === 0 && (
                  <p style={{ fontSize: 12, color: '#8A8A7A' }}>사용 기록이 없습니다</p>
                )}
                {stats.overallTop5.map((p, i) => {
                  const pct = stats.maxOverall > 0 ? Math.round((p.count / stats.maxOverall) * 100) : 0
                  return (
                    <div key={p.name}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: 20, fontWeight: 300, color: '#C9A96E', minWidth: 24 }}>
                          {i + 1}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </p>
                          <p style={{ fontSize: 10, color: '#8A8A7A' }}>
                            {p.brand ? `${p.brand} · ` : ''}{p.category}
                          </p>
                        </div>
                        <span style={{ fontSize: 12, color: '#1A1A1A', fontWeight: 500 }}>
                          {p.count}회
                        </span>
                      </div>
                      <div style={{ marginTop: 4, background: '#F5F4F0', height: 4, marginLeft: 32 }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            background: '#1A1A1A',
                            height: 4,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 카테고리별 TOP3 */}
            <div>
              <p style={{ fontSize: 11, letterSpacing: '0.1em', color: '#8A8A7A', marginBottom: 12 }}>
                카테고리별 TOP 3
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {Object.keys(stats.categoryTop3).length === 0 && (
                  <p style={{ fontSize: 12, color: '#8A8A7A' }}>데이터 없음</p>
                )}
                {Object.entries(stats.categoryTop3).map(([cat, items]) => (
                  <div key={cat}>
                    <p style={{ fontSize: 11, color: '#1A1A1A', fontWeight: 500, marginBottom: 6 }}>
                      {cat}
                    </p>
                    <ol style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: 0, margin: 0, listStyle: 'none' }}>
                      {items.map((p, i) => (
                        <li key={p.name} style={{ fontSize: 12, color: '#1A1A1A', display: 'flex', gap: 8 }}>
                          <span style={{ color: '#C9A96E', minWidth: 14 }}>{i + 1}</span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                            {p.brand && <span style={{ color: '#8A8A7A', marginLeft: 4 }}>· {p.brand}</span>}
                          </span>
                          <span style={{ color: '#8A8A7A' }}>{p.count}회</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </div>

            {/* 이번달 vs 저번달 */}
            <div>
              <p style={{ fontSize: 11, letterSpacing: '0.1em', color: '#8A8A7A', marginBottom: 12 }}>
                이번달 vs 저번달
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <p style={{ fontSize: 11, color: '#7A9E8A', fontWeight: 500, marginBottom: 6 }}>
                    ▲ 많이 늘어난 제품
                  </p>
                  {stats.topIncrease.length === 0 ? (
                    <p style={{ fontSize: 11, color: '#8A8A7A' }}>증가한 제품 없음</p>
                  ) : (
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 0, margin: 0, listStyle: 'none' }}>
                      {stats.topIncrease.map((p) => (
                        <li key={p.name} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </span>
                          <span style={{ color: '#7A9E8A', whiteSpace: 'nowrap' }}>
                            ▲ {p.delta} ({p.prevCount}→{p.thisCount})
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p style={{ fontSize: 11, color: '#C9A96E', fontWeight: 500, marginBottom: 6 }}>
                    ▼ 줄어든 제품
                  </p>
                  {stats.topDecrease.length === 0 ? (
                    <p style={{ fontSize: 11, color: '#8A8A7A' }}>감소한 제품 없음</p>
                  ) : (
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 0, margin: 0, listStyle: 'none' }}>
                      {stats.topDecrease.map((p) => (
                        <li key={p.name} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </span>
                          <span style={{ color: '#C9A96E', whiteSpace: 'nowrap' }}>
                            ▼ {Math.abs(p.delta)} ({p.prevCount}→{p.thisCount})
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

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
                      {p.name ?? p.product_name ?? '-'}
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
