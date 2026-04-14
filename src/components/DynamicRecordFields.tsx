'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// =============================================================
// 동적 기록 필드 컴포넌트
//
// record_templates에서 기본 양식의 필드를 로드하여 렌더링합니다.
// 테이블이 없거나 필드가 없으면 아무것도 렌더링하지 않습니다.
//
// DB 컬럼: id, template_id, label, type, options, sort_order, is_required
// (field_key, field_type, placeholder 컬럼이 없을 수 있으므로 안전 처리)
// =============================================================

type RawField = Record<string, unknown>

type Field = {
  id: string
  label: string
  key: string        // field_key ?? id (DB에 field_key가 없을 수 있음)
  fieldType: string  // field_type ?? type (DB 컬럼명이 type일 수 있음)
  options: string[]
  placeholder: string | null
  is_required: boolean
  sort_order: number
}

function toField(raw: RawField): Field {
  const id = String(raw.id ?? '')
  return {
    id,
    label: String(raw.label ?? ''),
    key: String(raw.field_key ?? raw.id ?? ''),
    fieldType: String(raw.field_type ?? raw.type ?? 'text'),
    options: Array.isArray(raw.options) ? raw.options : [],
    placeholder: typeof raw.placeholder === 'string' ? raw.placeholder : null,
    is_required: raw.is_required === true,
    sort_order: typeof raw.sort_order === 'number' ? raw.sort_order : 0,
  }
}

type Props = {
  /** 부모가 동적 필드 값을 수집하기 위한 콜백 */
  onChange: (values: Record<string, string | string[] | boolean | number | null>) => void
  /** 기존 값 (편집 시) */
  initialValues?: Record<string, unknown>
  /** 특정 템플릿 ID (없으면 기본 템플릿) */
  templateId?: string
}

export default function DynamicRecordFields({ onChange, initialValues, templateId }: Props) {
  const [fields, setFields] = useState<Field[]>([])
  const [values, setValues] = useState<Record<string, string | string[] | boolean | number | null>>({})
  const [loaded, setLoaded] = useState(false)
  const [templateName, setTemplateName] = useState('')

  const fetchFields = useCallback(async () => {
    try {
      // 1) 템플릿 결정
      let tId = templateId
      if (!tId) {
        const { data: defaultTemplate, error: tErr } = await supabase
          .from('record_templates')
          .select('id, name')
          .eq('is_default', true)
          .eq('is_active', true)
          .maybeSingle()
        if (tErr || !defaultTemplate) {
          setLoaded(true)
          return
        }
        tId = defaultTemplate.id
        setTemplateName(defaultTemplate.name)
      }

      // 2) 필드 로드
      const { data: fieldData, error } = await supabase
        .from('record_fields')
        .select('*')
        .eq('template_id', tId)
        .order('sort_order')
        .order('label')

      if (error || !fieldData || fieldData.length === 0) {
        setLoaded(true)
        return
      }

      // DB 컬럼명이 코드와 다를 수 있으므로 안전 변환
      const safeFields = fieldData.map((f) => toField(f as RawField))
      setFields(safeFields)

      // 3) 초기값 설정
      const init: Record<string, string | string[] | boolean | number | null> = {}
      for (const f of safeFields) {
        const existing = initialValues?.[f.key]
        if (existing !== undefined && existing !== null) {
          init[f.key] = existing as string
        } else if (f.fieldType === 'boolean') {
          init[f.key] = false
        } else if (f.fieldType === 'multi') {
          init[f.key] = []
        } else {
          init[f.key] = ''
        }
      }
      setValues(init)
      setLoaded(true)
    } catch {
      // 테이블이 없을 수 있음 — 조용히 무시
      setLoaded(true)
    }
  }, [templateId, initialValues])

  useEffect(() => {
    fetchFields()
  }, [fetchFields])

  // 값 변경 시 부모에게 알림
  useEffect(() => {
    if (loaded && fields.length > 0) {
      onChange(values)
    }
  }, [values, loaded, fields.length, onChange])

  function updateValue(key: string, val: string | string[] | boolean | number | null) {
    setValues((prev) => ({ ...prev, [key]: val }))
  }

  function toggleMulti(key: string, option: string) {
    setValues((prev) => {
      const current = Array.isArray(prev[key]) ? (prev[key] as string[]) : []
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option]
      return { ...prev, [key]: next }
    })
  }

  // 필드가 없으면 렌더링하지 않음
  if (!loaded || fields.length === 0) return null

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {templateName || '추가 기록 항목'}
      </h2>

      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((f) => {
          const val = values[f.key]

          return (
            <div key={f.id} className={f.fieldType === 'textarea' ? 'sm:col-span-2' : ''}>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                {f.label}
                {f.is_required && <span className="ml-1 text-red-400">*</span>}
              </label>

              {/* 텍스트 */}
              {f.fieldType === 'text' && (
                <input
                  type="text"
                  value={(val as string) ?? ''}
                  onChange={(e) => updateValue(f.key, e.target.value)}
                  placeholder={f.placeholder ?? undefined}
                  className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
                />
              )}

              {/* 긴 텍스트 */}
              {f.fieldType === 'textarea' && (
                <textarea
                  value={(val as string) ?? ''}
                  onChange={(e) => updateValue(f.key, e.target.value)}
                  placeholder={f.placeholder ?? undefined}
                  rows={3}
                  className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
                />
              )}

              {/* 숫자 */}
              {f.fieldType === 'number' && (
                <input
                  type="number"
                  value={(val as string) ?? ''}
                  onChange={(e) => updateValue(f.key, e.target.value)}
                  placeholder={f.placeholder ?? undefined}
                  className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
                />
              )}

              {/* 예/아니오 */}
              {f.fieldType === 'boolean' && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={val === true}
                    onChange={(e) => updateValue(f.key, e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300"
                  />
                  <span className="text-sm text-neutral-600">{f.placeholder ?? '해당됨'}</span>
                </label>
              )}

              {/* 단일 선택 */}
              {f.fieldType === 'select' && (
                <div className="flex flex-wrap gap-2">
                  {f.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => updateValue(f.key, val === opt ? '' : opt)}
                      className={`rounded-full border px-3.5 py-2 text-sm font-medium transition ${
                        val === opt
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {/* 복수 선택 */}
              {f.fieldType === 'multi' && (
                <div className="flex flex-wrap gap-2">
                  {f.options.map((opt) => {
                    const selected = Array.isArray(val) && val.includes(opt)
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleMulti(f.key, opt)}
                        className={`rounded-full border px-3.5 py-2 text-sm font-medium transition ${
                          selected
                            ? 'border-neutral-900 bg-neutral-900 text-white'
                            : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                        }`}
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
