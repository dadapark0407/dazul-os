'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// TODO: 역할 기반 인증 추가 필요
// TODO: 입력 유효성 검사 강화
// TODO: 이미지 업로드 필드 추가 고려

export default function AdminProductEditPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [tableError, setTableError] = useState(false)

  const [productName, setProductName] = useState('')
  const [brand, setBrand] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [oldCategory, setOldCategory] = useState('') // 기존 enum 값 (읽기 전용 표시용)
  const [categories, setCategories] = useState<{ id: string; name: string; parent_id: string | null; is_active: boolean }[]>([])
  const [description, setDescription] = useState('')
  const [aiSummary, setAiSummary] = useState('')
  const [targetSkinType, setTargetSkinType] = useState('')
  const [targetCoatType, setTargetCoatType] = useState('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    async function fetchProduct() {
      setLoading(true)
      setErrorMessage('')

      // 제품 + 카테고리 목록 병렬 로드
      const [productResult, categoriesResult] = await Promise.all([
        supabase.from('products').select('*').eq('id', id).single(),
        supabase
          .from('product_categories')
          .select('id, name, parent_id, is_active')
          .order('sort_order')
          .order('name'),
      ])

      // 카테고리 테이블이 없어도 제품 편집은 가능하도록 안전 처리
      setCategories(categoriesResult.data ?? [])

      const { data, error } = productResult

      if (error) {
        if (error.message.includes('does not exist')) {
          setTableError(true)
        }
        setErrorMessage('제품 정보를 불러오지 못했습니다.')
        setLoading(false)
        return
      }

      if (!data) {
        setErrorMessage('제품을 찾을 수 없습니다.')
        setLoading(false)
        return
      }

      setProductName(data.name ?? data.product_name ?? '')
      setBrand(data.brand ?? '')
      setCategoryId(data.category_id ?? '')
      setOldCategory(data.category ?? '')
      setDescription(data.description ?? '')
      setAiSummary(data.ai_summary ?? '')
      setTargetSkinType(data.target_skin_type ?? '')
      setTargetCoatType(data.target_coat_type ?? '')
      setIsActive(data.is_active !== false)
      setLoading(false)
    }

    fetchProduct()
  }, [id])

  async function handleSave() {
    if (!productName.trim()) {
      alert('제품명은 필수입니다.')
      return
    }

    setSaving(true)
    setErrorMessage('')

    // category_id 선택 시 기존 category 텍스트도 동기화 (하위 호환)
    const selectedCat = categories.find((c) => c.id === categoryId)

    const payload: Record<string, unknown> = {
      name: productName.trim(),
      brand: brand.trim() || null,
      category_id: categoryId || null,
      // 기존 category enum도 함께 업데이트 — 아직 이 컬럼을 읽는 코드가 있을 수 있음
      category: selectedCat?.name ?? (categoryId ? null : oldCategory || null),
      description: description.trim() || null,
      ai_summary: aiSummary.trim() || null,
      target_skin_type: targetSkinType.trim() || null,
      target_coat_type: targetCoatType.trim() || null,
      is_active: isActive,
    }

    const { error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)

    setSaving(false)

    if (error) {
      setErrorMessage(`저장 중 오류가 발생했습니다: ${error.message}`)
      return
    }

    router.push(`/admin/products/${id}`)
  }

  // 카테고리 드롭다운에서 현재 표시할 이름 (안내용)
  const currentCategoryLabel = (() => {
    if (categoryId) {
      const cat = categories.find((c) => c.id === categoryId)
      if (cat) return cat.name
    }
    if (oldCategory) return `${oldCategory} (기존)`
    return '미분류'
  })()

  if (loading) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/products"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
        >
          ← 돌아가기
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900">제품 수정</h1>
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-neutral-600">불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (tableError) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/products"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
        >
          ← 제품 목록
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900">제품 수정</h1>
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-amber-800">
            products 테이블이 존재하지 않습니다.
          </p>
          <p className="mt-2 text-xs text-amber-600">
            Supabase 대시보드에서 테이블을 확인해주세요.
          </p>
        </div>
      </div>
    )
  }

  if (errorMessage && !productName) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/products"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
        >
          ← 제품 목록
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900">제품 수정</h1>
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-red-600">{errorMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/admin/products/${id}`}
            className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
          >
            ← 상세로 돌아가기
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-neutral-900">제품 수정</h1>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <div className="grid gap-5 sm:grid-cols-2">
          {/* 제품명 */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              제품명 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="제품명"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          {/* 브랜드 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              브랜드
            </label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="예: 이즈리얼, 로얄캐닌"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          {/* 카테고리 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              카테고리
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-500"
            >
              <option value="">미분류</option>
              {categories
                .filter((c) => {
                  // 활성 카테고리 표시 + 현재 제품에 할당된 비활성 카테고리도 유지
                  return c.is_active || c.id === categoryId
                })
                .map((c) => {
                  const parent = categories.find((p) => p.id === c.parent_id)
                  const label = parent ? `${parent.name} > ${c.name}` : c.name
                  const suffix = !c.is_active ? ' (비활성)' : ''
                  return (
                    <option key={c.id} value={c.id}>{label}{suffix}</option>
                  )
                })}
            </select>
            {categories.length === 0 && oldCategory && (
              <p className="mt-1.5 text-xs text-neutral-400">
                현재 값: {oldCategory} (기존 분류). 카테고리 관리에서 새 카테고리를 추가하면 여기에 표시됩니다.
              </p>
            )}
            {categories.length === 0 && !oldCategory && (
              <p className="mt-1.5 text-xs text-neutral-400">
                카테고리가 아직 등록되지 않았습니다. 관리 &gt; 카테고리에서 추가하세요.
              </p>
            )}
            {categories.length > 0 && !categoryId && oldCategory && (
              <p className="mt-1.5 text-xs text-amber-500">
                기존 분류: {oldCategory} — 위에서 새 카테고리를 선택하면 자동 전환됩니다.
              </p>
            )}
          </div>

          {/* 대상 피부 타입 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              대상 피부 타입
            </label>
            <input
              type="text"
              value={targetSkinType}
              onChange={(e) => setTargetSkinType(e.target.value)}
              placeholder="예: 건조, 민감, 지성"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          {/* 대상 모질 타입 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              대상 모질 타입
            </label>
            <input
              type="text"
              value={targetCoatType}
              onChange={(e) => setTargetCoatType(e.target.value)}
              placeholder="예: 곱슬, 직모, 이중모"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          {/* 설명 */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="제품 설명"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          {/* AI 요약 */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              AI 요약
            </label>
            <textarea
              value={aiSummary}
              onChange={(e) => setAiSummary(e.target.value)}
              rows={3}
              placeholder="AI가 생성한 제품 요약 또는 직접 입력"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          {/* 활성 상태 */}
          <div className="sm:col-span-2">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300"
              />
              <span className="text-sm font-medium text-neutral-700">
                활성 상태 {isActive ? '(사용 중)' : '(비활성)'}
              </span>
            </label>
          </div>
        </div>

        {errorMessage && (
          <p className="mt-4 text-sm text-red-600">{errorMessage}</p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => router.push(`/admin/products/${id}`)}
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
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
