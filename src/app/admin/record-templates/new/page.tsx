'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// TODO: 역할 기반 인증 — manager 이상

export default function NewRecordTemplatePage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [sortOrder, setSortOrder] = useState('0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!name.trim()) {
      setError('양식 이름은 필수입니다.')
      return
    }

    setSaving(true)
    setError('')

    // 기본 양식으로 설정하면 기존 기본 양식 해제
    if (isDefault) {
      await supabase
        .from('record_templates')
        .update({ is_default: false })
        .eq('is_default', true)
    }

    const { data, error: insertError } = await supabase
      .from('record_templates')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        is_default: isDefault,
        sort_order: parseInt(sortOrder, 10) || 0,
        is_active: true,
      })
      .select('id')

    setSaving(false)

    if (insertError) {
      setError(`저장 실패: ${insertError.message}`)
      return
    }

    const newId = data?.[0]?.id
    if (newId) {
      router.push(`/admin/record-templates/${newId}`)
    } else {
      router.push('/admin/record-templates')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/record-templates"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
        >
          ← 양식 목록
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-neutral-900">새 기록 양식</h1>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              양식 이름 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 기본 방문 기록, VIP 정밀 기록"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="이 양식의 용도를 간단히 설명하세요"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              정렬 순서
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <div className="flex items-center">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300"
              />
              <span className="text-sm font-medium text-neutral-700">
                기본 양식으로 설정
              </span>
            </label>
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/record-templates')}
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
            {saving ? '저장 중...' : '양식 생성'}
          </button>
        </div>
      </section>

      <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-5">
        <p className="text-xs leading-5 text-neutral-500">
          양식을 생성한 후 필드를 추가할 수 있습니다.
          필드 추가는 양식 상세 페이지에서 진행됩니다.
        </p>
      </div>
    </div>
  )
}
