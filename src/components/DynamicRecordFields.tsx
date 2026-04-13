'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// =============================================================
// 동적 기록 필드 컴포넌트
//
// record_templates에서 기본 양식의 필드를 로드하여 렌더링합니다.
// 테이블이 없거나 필드가 없으면 아무것도 렌더링하지 않습니다.
//
// TODO: 특정 template_id를 prop으로 받아 양식 선택 지원
// TODO: record_values 기존 값 로드 (편집 모드)
// =============================================================

type Field = {
  id: string
  label: string
  field_key: string
  field_type: string
  options: string[]
  placeholder: string | null
  is_required: boolean
  sort_order: number
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
        const { data: defaultTemplate } = await supabase
          .from('record_templates')
          .select('id, name')
          .eq('is_default', true)
          .eq('is_active', true)
          .maybeSingle()
        if (!defaultTemplate) {
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

      const safeFields: Field[] = fieldData.map((f) => ({
        ...f,
        options: Array.isArray(f.options) ? f.options : [],
      }))
      setFields(safeFields)

      // 3) 초기값 설정
      const init: Record<string, string | string[] | boolean | number | null> = {}
      for (const f of safeFields) {
        const existing = initialValues?.[f.field_key]
        if (existing !== undefined && existing !== null) {
          init[f.field_key] = existing as string
        } else if (f.field_type === 'boolean') {
          init[f.field_key] = false
        } else if (f.field_type === 'multi') {
          init[f.field_key] = []
        } else {
          init[f.field_key] = ''
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
    <section
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 20,
        display: 'grid',
        gap: 14,
      }}
    >
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        {templateName || '추가 기록 항목'}
      </h2>

      {fields.map((f) => {
        const val = values[f.field_key]

        return (
          <div key={f.id} style={{ display: 'grid', gap: 8, fontWeight: 600 }}>
            <span>
              {f.label}
              {f.is_required && <span style={{ color: '#f87171', marginLeft: 4 }}>*</span>}
            </span>

            {/* 텍스트 */}
            {f.field_type === 'text' && (
              <input
                type="text"
                value={(val as string) ?? ''}
                onChange={(e) => updateValue(f.field_key, e.target.value)}
                placeholder={f.placeholder ?? undefined}
                style={inputStyle}
              />
            )}

            {/* 긴 텍스트 */}
            {f.field_type === 'textarea' && (
              <textarea
                value={(val as string) ?? ''}
                onChange={(e) => updateValue(f.field_key, e.target.value)}
                placeholder={f.placeholder ?? undefined}
                style={textareaStyle}
              />
            )}

            {/* 숫자 */}
            {f.field_type === 'number' && (
              <input
                type="number"
                value={(val as string) ?? ''}
                onChange={(e) => updateValue(f.field_key, e.target.value)}
                placeholder={f.placeholder ?? undefined}
                style={inputStyle}
              />
            )}

            {/* 예/아니오 */}
            {f.field_type === 'boolean' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
                <input
                  type="checkbox"
                  checked={val === true}
                  onChange={(e) => updateValue(f.field_key, e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                <span style={{ fontSize: 14 }}>{f.placeholder ?? '해당됨'}</span>
              </label>
            )}

            {/* 단일 선택 */}
            {f.field_type === 'select' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {f.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => updateValue(f.field_key, val === opt ? '' : opt)}
                    style={chipStyle(val === opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* 복수 선택 */}
            {f.field_type === 'multi' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {f.options.map((opt) => {
                  const selected = Array.isArray(val) && val.includes(opt)
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleMulti(f.field_key, opt)}
                      style={chipStyle(selected)}
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
    </section>
  )
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '10px 14px',
    borderRadius: 999,
    border: active ? '1px solid #111827' : '1px solid #d1d5db',
    background: active ? '#111827' : '#ffffff',
    color: active ? '#ffffff' : '#111827',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  }
}

const inputStyle: React.CSSProperties = {
  height: 44,
  border: '1px solid #d1d5db',
  borderRadius: 10,
  padding: '0 12px',
  fontSize: 14,
  fontWeight: 400,
}

const textareaStyle: React.CSSProperties = {
  minHeight: 100,
  border: '1px solid #d1d5db',
  borderRadius: 10,
  padding: 12,
  fontSize: 14,
  fontWeight: 400,
}
