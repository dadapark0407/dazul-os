'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// TODO: 역할 기반 인증 추가 필요

type CategoryOption = {
  id: string
  name: string
  parent_id: string | null
  is_active: boolean
}

export default function AdminProductNewPage() {
  const router = useRouter()

  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)

  const [productName, setProductName] = useState('')
  const [brand, setBrand] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    async function fetchCategories() {
      const { data } = await supabase
        .from('product_categories')
        .select('id, name, parent_id, is_active')
        .order('sort_order')
        .order('name')
      setCategories(data ?? [])
      setLoadingCategories(false)
    }
    fetchCategories()
  }, [])

  async function handleSave() {
    if (!productName.trim()) {
      setErrorMessage('제품명은 필수입니다.')
      return
    }

    setSaving(true)
    setErrorMessage('')

    const selectedCat = categories.find((c) => c.id === categoryId)

    const payload: Record<string, unknown> = {
      product_name: productName.trim(),
      brand: brand.trim() || null,
      category_id: categoryId || null,
      category: selectedCat?.name ?? null,
      description: description.trim() || null,
      is_active: isActive,
    }

    const { error } = await supabase.from('products').insert(payload)

    setSaving(false)

    if (error) {
      setErrorMessage(`저장 중 오류가 발생했습니다: ${error.message}`)
      return
    }

    router.push('/admin/products')
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/products"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
        >
          ← 제품 목록
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-neutral-900">제품 추가</h1>
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
              disabled={loadingCategories}
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-500 disabled:opacity-50"
            >
              <option value="">미분류</option>
              {categories
                .filter((c) => c.is_active)
                .map((c) => {
                  const parent = categories.find((p) => p.id === c.parent_id)
                  const label = parent ? `${parent.name} > ${c.name}` : c.name
                  return (
                    <option key={c.id} value={c.id}>{label}</option>
                  )
                })}
            </select>
            {!loadingCategories && categories.length === 0 && (
              <p className="mt-1.5 text-xs text-neutral-400">
                카테고리가 아직 등록되지 않았습니다. 관리 &gt; 카테고리에서 추가하세요.
              </p>
            )}
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
            onClick={() => router.push('/admin/products')}
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
