'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getDefaultBranchId } from '@/lib/branch'

// TODO: 역할 기반 인증 추가 필요

type CategoryOption = {
  id: string
  name: string
  parent_id: string | null
  is_active: boolean
}

type Status = 'active' | 'hidden' | 'discontinued'

const SKIN_TYPES = ['건조', '민감', '지성', '복합', '정상'] as const
const COAT_TYPES = ['단모', '장모', '곱슬', '직모', '이중모'] as const

const STATUS_OPTIONS: { value: Status; label: string; desc: string }[] = [
  { value: 'active', label: '사용중', desc: '현재 판매/사용 중' },
  { value: 'hidden', label: '숨김', desc: '일시 비공개' },
  { value: 'discontinued', label: '단종', desc: '더 이상 사용하지 않음' },
]

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
  const [aiSummary, setAiSummary] = useState('')
  const [skinTypes, setSkinTypes] = useState<string[]>([])
  const [coatTypes, setCoatTypes] = useState<string[]>([])
  const [status, setStatus] = useState<Status>('active')

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

  function toggleSkin(val: string) {
    setSkinTypes((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]))
  }
  function toggleCoat(val: string) {
    setCoatTypes((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]))
  }

  async function handleSave() {
    if (!productName.trim()) {
      setErrorMessage('제품명은 필수입니다.')
      return
    }

    setSaving(true)
    setErrorMessage('')

    const branchId = await getDefaultBranchId()
    if (!branchId) {
      setSaving(false)
      setErrorMessage('기본 지점 정보를 찾을 수 없습니다.')
      return
    }

    const selectedCat = categories.find((c) => c.id === categoryId)

    const payload: Record<string, unknown> = {
      branch_id: branchId,
      name: productName.trim(),
      brand: brand.trim() || null,
      category_id: categoryId || null,
      category: selectedCat?.name ?? null,
      description: description.trim() || null,
      ai_summary: aiSummary.trim() || null,
      target_skin_type: skinTypes.length > 0 ? skinTypes.join(', ') : null,
      target_coat_type: coatTypes.length > 0 ? coatTypes.join(', ') : null,
      status,
      // 하위 호환: is_active 동기화 (active만 true)
      is_active: status === 'active',
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
        <Link href="/admin/products" className="text-sm font-medium text-neutral-500 hover:text-neutral-700">
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
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">브랜드</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="예: 이즈리얼"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          {/* 카테고리 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">카테고리</label>
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
                    <option key={c.id} value={c.id}>
                      {label}
                    </option>
                  )
                })}
            </select>
          </div>

          {/* 피부 타입 */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">대상 피부 타입</label>
            <div className="flex flex-wrap gap-2">
              {SKIN_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleSkin(t)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    skinTypes.includes(t)
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 모질 타입 */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">대상 모질 타입</label>
            <div className="flex flex-wrap gap-2">
              {COAT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleCoat(t)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    coatTypes.includes(t)
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 설명 (내부) */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">설명 (내부)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="제품 성분, 특징 등 내부 참고용"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          {/* 고객 안내 문구 (리포트 공개) */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              고객 안내 문구 <span className="text-xs font-normal" style={{ color: '#C9A96E' }}>· 보호자 리포트에 표시됩니다</span>
            </label>
            <textarea
              value={aiSummary}
              onChange={(e) => setAiSummary(e.target.value)}
              rows={3}
              placeholder="보호자에게 보여질 제품 설명을 입력해주세요. 예) 연어에서 추출한 PDRN 성분으로 예민한 피부를 진정시키는 프리미엄 샴푸예요."
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          {/* 상태 */}
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-neutral-700">상태</label>
            <div className="flex flex-wrap gap-3">
              {STATUS_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border px-4 py-3 transition ${
                    status === opt.value ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 bg-white hover:bg-neutral-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={opt.value}
                    checked={status === opt.value}
                    onChange={() => setStatus(opt.value)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-neutral-900">{opt.label}</span>
                    <span className="block text-xs text-neutral-500">{opt.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {errorMessage && <p className="mt-4 text-sm text-red-600">{errorMessage}</p>}

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
