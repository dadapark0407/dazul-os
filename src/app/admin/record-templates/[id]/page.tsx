'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// TODO: 역할 기반 인증 — manager 이상

const FIELD_TYPES = [
  { value: 'text', label: '텍스트' },
  { value: 'textarea', label: '긴 텍스트' },
  { value: 'select', label: '단일 선택' },
  { value: 'multi', label: '복수 선택' },
  { value: 'number', label: '숫자' },
  { value: 'boolean', label: '예/아니오' },
]

type Template = {
  id: string
  name: string
  description: string | null
  is_default: boolean
  is_active: boolean
  sort_order: number
}

type Field = {
  id: string
  template_id: string
  label: string
  field_key: string
  field_type: string
  options: string[]
  placeholder: string | null
  is_required: boolean
  sort_order: number
}

export default function RecordTemplateDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [template, setTemplate] = useState<Template | null>(null)
  const [fields, setFields] = useState<Field[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 템플릿 메타 편집
  const [editingMeta, setEditingMeta] = useState(false)
  const [metaName, setMetaName] = useState('')
  const [metaDesc, setMetaDesc] = useState('')
  const [metaDefault, setMetaDefault] = useState(false)
  const [metaSaving, setMetaSaving] = useState(false)

  // 필드 추가/편집
  const [fieldFormOpen, setFieldFormOpen] = useState(false)
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [fieldLabel, setFieldLabel] = useState('')
  const [fieldKey, setFieldKey] = useState('')
  const [fieldType, setFieldType] = useState('text')
  const [fieldOptions, setFieldOptions] = useState('')
  const [fieldPlaceholder, setFieldPlaceholder] = useState('')
  const [fieldRequired, setFieldRequired] = useState(false)
  const [fieldSaving, setFieldSaving] = useState(false)
  const [fieldError, setFieldError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)

    const [templateResult, fieldsResult] = await Promise.all([
      supabase.from('record_templates').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('record_fields')
        .select('*')
        .eq('template_id', id)
        .order('sort_order')
        .order('label'),
    ])

    if (templateResult.error || !templateResult.data) {
      setError('양식을 찾을 수 없습니다.')
      setLoading(false)
      return
    }

    const t = templateResult.data
    setTemplate(t)
    setMetaName(t.name)
    setMetaDesc(t.description ?? '')
    setMetaDefault(t.is_default)

    // options가 jsonb이므로 안전하게 배열로 변환
    const safeFields: Field[] = (fieldsResult.data ?? []).map((f) => ({
      ...f,
      options: Array.isArray(f.options) ? f.options : [],
    }))
    setFields(safeFields)

    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── 템플릿 메타 저장 ───

  async function saveMeta() {
    if (!metaName.trim()) return
    setMetaSaving(true)

    if (metaDefault) {
      await supabase
        .from('record_templates')
        .update({ is_default: false })
        .neq('id', id)
    }

    await supabase
      .from('record_templates')
      .update({
        name: metaName.trim(),
        description: metaDesc.trim() || null,
        is_default: metaDefault,
      })
      .eq('id', id)

    setMetaSaving(false)
    setEditingMeta(false)
    fetchData()
  }

  // ─── 활성/비활성 토글 ───

  async function toggleActive() {
    if (!template) return
    await supabase
      .from('record_templates')
      .update({ is_active: !template.is_active })
      .eq('id', id)
    fetchData()
  }

  // ─── 필드 폼 헬퍼 ───

  function autoKey(label: string): string {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .trim()
  }

  function openAddField() {
    setEditingFieldId(null)
    setFieldLabel('')
    setFieldKey('')
    setFieldType('text')
    setFieldOptions('')
    setFieldPlaceholder('')
    setFieldRequired(false)
    setFieldError('')
    setFieldFormOpen(true)
  }

  function openEditField(f: Field) {
    setEditingFieldId(f.id)
    setFieldLabel(f.label)
    setFieldKey(f.field_key)
    setFieldType(f.field_type)
    setFieldOptions(f.options.join(', '))
    setFieldPlaceholder(f.placeholder ?? '')
    setFieldRequired(f.is_required)
    setFieldError('')
    setFieldFormOpen(true)
  }

  function closeFieldForm() {
    setFieldFormOpen(false)
    setEditingFieldId(null)
    setFieldError('')
  }

  async function saveField() {
    if (!fieldLabel.trim()) {
      setFieldError('필드 이름은 필수입니다.')
      return
    }

    const key = fieldKey.trim() || autoKey(fieldLabel)
    if (!key) {
      setFieldError('필드 키를 입력하세요.')
      return
    }

    setFieldSaving(true)
    setFieldError('')

    const optionsArray = (fieldType === 'select' || fieldType === 'multi')
      ? fieldOptions.split(',').map((o) => o.trim()).filter(Boolean)
      : []

    const payload = {
      template_id: id,
      label: fieldLabel.trim(),
      field_key: key,
      field_type: fieldType,
      options: optionsArray,
      placeholder: fieldPlaceholder.trim() || null,
      is_required: fieldRequired,
      sort_order: editingFieldId
        ? fields.find((f) => f.id === editingFieldId)?.sort_order ?? 0
        : (fields.length + 1) * 10,
    }

    if (editingFieldId) {
      const { error: updateError } = await supabase
        .from('record_fields')
        .update(payload)
        .eq('id', editingFieldId)
      if (updateError) {
        setFieldError(
          updateError.message.includes('duplicate')
            ? '이미 사용 중인 필드 키입니다.'
            : `저장 실패: ${updateError.message}`
        )
        setFieldSaving(false)
        return
      }
    } else {
      const { error: insertError } = await supabase
        .from('record_fields')
        .insert(payload)
      if (insertError) {
        setFieldError(
          insertError.message.includes('duplicate')
            ? '이미 사용 중인 필드 키입니다.'
            : `저장 실패: ${insertError.message}`
        )
        setFieldSaving(false)
        return
      }
    }

    setFieldSaving(false)
    closeFieldForm()
    fetchData()
  }

  async function deleteField(fieldId: string) {
    if (!confirm('이 필드를 삭제하시겠습니까? 기존 저장된 값도 함께 삭제됩니다.')) return
    await supabase.from('record_fields').delete().eq('id', fieldId)
    fetchData()
  }

  // ─── 순서 변경 ───

  async function moveField(fieldId: string, direction: 'up' | 'down') {
    const idx = fields.findIndex((f) => f.id === fieldId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= fields.length) return

    const a = fields[idx]
    const b = fields[swapIdx]

    await Promise.all([
      supabase.from('record_fields').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('record_fields').update({ sort_order: a.sort_order }).eq('id', b.id),
    ])
    fetchData()
  }

  // ─── 렌더링 ───

  if (loading) {
    return (
      <div className="space-y-4">
        <Link href="/admin/record-templates" className="text-sm font-medium text-neutral-500 hover:text-neutral-700">
          ← 양식 목록
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900">양식 상세</h1>
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-neutral-600">불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error || !template) {
    return (
      <div className="space-y-4">
        <Link href="/admin/record-templates" className="text-sm font-medium text-neutral-500 hover:text-neutral-700">
          ← 양식 목록
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900">양식 상세</h1>
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-red-600">{error || '양식을 찾을 수 없습니다.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <Link
          href="/admin/record-templates"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
        >
          ← 양식 목록
        </Link>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-neutral-900">{template.name}</h1>
            {template.is_default && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">기본</span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                template.is_active ? 'bg-green-50 text-green-700' : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {template.is_active ? '활성' : '비활성'}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditingMeta(!editingMeta)}
              className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              {editingMeta ? '취소' : '양식 정보 수정'}
            </button>
            <button
              type="button"
              onClick={toggleActive}
              className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              {template.is_active ? '비활성화' : '활성화'}
            </button>
          </div>
        </div>
        {template.description && !editingMeta && (
          <p className="mt-1 text-sm text-neutral-500">{template.description}</p>
        )}
      </div>

      {/* 메타 편집 폼 */}
      {editingMeta && (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">양식 정보</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">이름</label>
              <input
                type="text"
                value={metaName}
                onChange={(e) => setMetaName(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">설명</label>
              <textarea
                value={metaDesc}
                onChange={(e) => setMetaDesc(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={metaDefault}
                onChange={(e) => setMetaDefault(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300"
              />
              <span className="text-sm font-medium text-neutral-700">기본 양식</span>
            </label>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setEditingMeta(false)}
              className="rounded-xl border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={saveMeta}
              disabled={metaSaving}
              className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
            >
              {metaSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </section>
      )}

      {/* 필드 목록 */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">필드 ({fields.length})</h2>
          <button
            type="button"
            onClick={openAddField}
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700"
          >
            + 필드 추가
          </button>
        </div>

        {fields.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-200 py-8 text-center">
            <p className="text-sm text-neutral-500">아직 필드가 없습니다.</p>
            <p className="mt-1 text-xs text-neutral-400">위의 버튼으로 첫 필드를 추가하세요.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {fields.map((f, idx) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 p-3 transition hover:bg-neutral-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-800">{f.label}</span>
                    <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
                      {f.field_key}
                    </code>
                    <span className="rounded bg-neutral-50 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
                      {FIELD_TYPES.find((t) => t.value === f.field_type)?.label ?? f.field_type}
                    </span>
                    {f.is_required && (
                      <span className="text-[10px] font-bold text-red-400">필수</span>
                    )}
                  </div>
                  {f.options.length > 0 && (
                    <p className="mt-1 text-xs text-neutral-400">
                      선택지: {f.options.join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveField(f.id, 'up')}
                    disabled={idx === 0}
                    className="rounded p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-20"
                    title="위로"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveField(f.id, 'down')}
                    disabled={idx === fields.length - 1}
                    className="rounded p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-20"
                    title="아래로"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditField(f)}
                    className="rounded px-2 py-1 text-xs font-medium text-neutral-500 hover:text-neutral-700"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteField(f.id)}
                    className="rounded px-2 py-1 text-xs font-medium text-red-400 hover:text-red-600"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 필드 추가/편집 폼 */}
      {fieldFormOpen && (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-blue-200">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-blue-600">
            {editingFieldId ? '필드 수정' : '새 필드'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                필드 이름 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={fieldLabel}
                onChange={(e) => {
                  setFieldLabel(e.target.value)
                  if (!editingFieldId) setFieldKey(autoKey(e.target.value))
                }}
                placeholder="예: 발바닥 상태"
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                필드 키
              </label>
              <input
                type="text"
                value={fieldKey}
                onChange={(e) => setFieldKey(e.target.value)}
                placeholder="자동 생성됨"
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm font-mono outline-none focus:border-neutral-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">유형</label>
              <select
                value={fieldType}
                onChange={(e) => setFieldType(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-500"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                플레이스홀더
              </label>
              <input
                type="text"
                value={fieldPlaceholder}
                onChange={(e) => setFieldPlaceholder(e.target.value)}
                placeholder="입력 힌트 (선택)"
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
              />
            </div>

            {(fieldType === 'select' || fieldType === 'multi') && (
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                  선택지 (쉼표로 구분)
                </label>
                <input
                  type="text"
                  value={fieldOptions}
                  onChange={(e) => setFieldOptions(e.target.value)}
                  placeholder="예: 낮음, 보통, 높음"
                  className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
                />
              </div>
            )}

            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={fieldRequired}
                onChange={(e) => setFieldRequired(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300"
              />
              <span className="text-sm font-medium text-neutral-700">필수 입력</span>
            </label>
          </div>

          {fieldError && (
            <p className="mt-3 text-sm text-red-600">{fieldError}</p>
          )}

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={closeFieldForm}
              className="rounded-xl border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={saveField}
              disabled={fieldSaving}
              className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
            >
              {fieldSaving ? '저장 중...' : editingFieldId ? '수정' : '추가'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
