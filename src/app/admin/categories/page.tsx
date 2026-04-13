'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// TODO: 역할 기반 인증 — manager 이상만 접근 가능

type Category = {
  id: string
  name: string
  slug: string
  parent_id: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [tableExists, setTableExists] = useState(true)

  // 인라인 편집/추가 상태
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [productCountMap, setProductCountMap] = useState<Record<string, number>>({})

  // 폼 필드
  const [formName, setFormName] = useState('')
  const [formSlug, setFormSlug] = useState('')
  const [formParentId, setFormParentId] = useState('')
  const [formSortOrder, setFormSortOrder] = useState('0')
  const [formIsActive, setFormIsActive] = useState(true)
  const [formError, setFormError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)

    const catResult = await supabase
      .from('product_categories')
      .select('*')
      .order('sort_order')
      .order('name')

    if (catResult.error) {
      console.error('product_categories fetch error:', catResult.error)
      setTableExists(false)
      setLoading(false)
      return
    }

    setCategories(catResult.data ?? [])

    // 카테고리별 제품 수 집계 — category_id 컬럼이 없으면 조용히 무시
    try {
      const { data: productsData } = await supabase
        .from('products')
        .select('category_id')
      const countMap: Record<string, number> = {}
      for (const p of productsData ?? []) {
        const catId = (p as Record<string, unknown>).category_id
        if (typeof catId === 'string' && catId) {
          countMap[catId] = (countMap[catId] ?? 0) + 1
        }
      }
      setProductCountMap(countMap)
    } catch {
      // products 테이블에 category_id가 없을 수 있음 — 무시
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 이름 입력 시 슬러그 자동 생성 (추가 모드에서만)
  function autoSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  function startAdd() {
    setIsAdding(true)
    setEditingId(null)
    setFormName('')
    setFormSlug('')
    setFormParentId('')
    setFormSortOrder(String((categories.length + 1) * 10))
    setFormIsActive(true)
    setFormError('')
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id)
    setIsAdding(false)
    setFormName(cat.name)
    setFormSlug(cat.slug)
    setFormParentId(cat.parent_id ?? '')
    setFormSortOrder(String(cat.sort_order))
    setFormIsActive(cat.is_active)
    setFormError('')
  }

  function cancelForm() {
    setEditingId(null)
    setIsAdding(false)
    setFormError('')
  }

  async function handleSave() {
    if (!formName.trim()) {
      setFormError('카테고리 이름은 필수입니다.')
      return
    }
    if (!formSlug.trim()) {
      setFormError('슬러그는 필수입니다.')
      return
    }

    setSaving(true)
    setFormError('')

    const payload = {
      name: formName.trim(),
      slug: formSlug.trim(),
      parent_id: formParentId || null,
      sort_order: parseInt(formSortOrder, 10) || 0,
      is_active: formIsActive,
    }

    if (isAdding) {
      const { error } = await supabase.from('product_categories').insert(payload)
      if (error) {
        setFormError(
          error.message.includes('duplicate')
            ? '이미 사용 중인 슬러그입니다.'
            : `저장 실패: ${error.message}`
        )
        setSaving(false)
        return
      }
    } else if (editingId) {
      const { error } = await supabase
        .from('product_categories')
        .update(payload)
        .eq('id', editingId)
      if (error) {
        setFormError(
          error.message.includes('duplicate')
            ? '이미 사용 중인 슬러그입니다.'
            : `저장 실패: ${error.message}`
        )
        setSaving(false)
        return
      }
    }

    setSaving(false)
    cancelForm()
    fetchData()
  }

  // 빠른 활성/비활성 토글
  async function quickToggle(cat: Category) {
    setTogglingId(cat.id)
    const { error } = await supabase
      .from('product_categories')
      .update({ is_active: !cat.is_active })
      .eq('id', cat.id)

    setTogglingId(null)

    if (error) {
      alert(`상태 변경 실패: ${error.message}`)
      return
    }

    // 로컬 즉시 반영
    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, is_active: !cat.is_active } : c))
    )
  }

  // 테이블 없음 플레이스홀더
  if (!loading && !tableExists) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-neutral-900">카테고리 관리</h1>
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <p className="text-base font-semibold text-neutral-700">
            product_categories 테이블이 아직 준비되지 않았습니다
          </p>
          <p className="mt-3 text-sm text-neutral-500">
            Supabase SQL Editor에서{' '}
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
              sql/003_product_categories.sql
            </code>
            을 실행하세요.
          </p>
        </div>
      </div>
    )
  }

  // 상위 카테고리 옵션 (편집 중인 카테고리 자신 제외)
  const parentOptions = categories.filter((c) => c.id !== editingId && !c.parent_id)

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">카테고리 관리</h1>
          <p className="mt-1 text-sm text-neutral-500">
            제품 카테고리를 관리합니다 · {categories.length}개
          </p>
        </div>
        {!isAdding && !editingId && (
          <button
            type="button"
            onClick={startAdd}
            className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700"
          >
            + 카테고리 추가
          </button>
        )}
      </div>

      {/* 추가/편집 폼 */}
      {(isAdding || editingId) && (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            {isAdding ? '새 카테고리' : '카테고리 수정'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                이름 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value)
                  if (isAdding) setFormSlug(autoSlug(e.target.value))
                }}
                placeholder="예: 샴푸"
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                슬러그 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder="예: shampoo"
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                상위 카테고리
              </label>
              <select
                value={formParentId}
                onChange={(e) => setFormParentId(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-500"
              >
                <option value="">없음 (최상위)</option>
                {parentOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                정렬 순서
              </label>
              <input
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
              />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300"
                />
                <span className="text-sm font-medium text-neutral-700">
                  활성 {formIsActive ? '(사용 중)' : '(비활성)'}
                </span>
              </label>
            </div>
          </div>

          {formError && (
            <p className="mt-3 text-sm text-red-600">{formError}</p>
          )}

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={cancelForm}
              className="rounded-xl border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
            >
              {saving ? '저장 중...' : isAdding ? '추가' : '저장'}
            </button>
          </div>
        </section>
      )}

      {/* 카테고리 목록 */}
      {loading ? (
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-neutral-600">불러오는 중...</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-neutral-600">등록된 카테고리가 없습니다.</p>
          <p className="mt-2 text-xs text-neutral-400">
            SQL 시드 데이터를 실행하거나 위의 추가 버튼을 사용하세요.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="px-4 py-3 font-semibold">이름</th>
                <th className="px-4 py-3 font-semibold">슬러그</th>
                <th className="px-4 py-3 font-semibold">상위</th>
                <th className="px-4 py-3 font-semibold">제품</th>
                <th className="px-4 py-3 font-semibold">순서</th>
                <th className="px-4 py-3 font-semibold">상태</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const parent = categories.find((c) => c.id === cat.parent_id)
                return (
                  <tr
                    key={cat.id}
                    className="border-b border-neutral-100 transition hover:bg-neutral-50"
                  >
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {cat.parent_id && (
                        <span className="mr-1 text-neutral-400">└</span>
                      )}
                      {cat.name}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
                      <code className="rounded bg-neutral-50 px-1.5 py-0.5 text-xs">
                        {cat.slug}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
                      {parent?.name ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
                      {productCountMap[cat.id] ?? 0}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{cat.sort_order}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => quickToggle(cat)}
                        disabled={togglingId === cat.id}
                        className="disabled:opacity-50"
                      >
                        {cat.is_active ? (
                          <span className="inline-block rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                            활성
                          </span>
                        ) : (
                          <span className="inline-block rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">
                            비활성
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => startEdit(cat)}
                        className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
                      >
                        수정
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
