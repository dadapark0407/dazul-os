'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// TODO: 역할 기반 인증 — manager 이상

type Template = {
  id: string
  name: string
  description: string | null
  is_default: boolean
  is_active: boolean
  created_at: string
}

export default function AdminRecordTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [tableExists, setTableExists] = useState(true)
  const [fieldCounts, setFieldCounts] = useState<Record<string, number>>({})

  const fetchData = useCallback(async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('record_templates')
      .select('*')
      .order('name')

    if (error) {
      console.warn('record_templates fetch error:', error.message)
      setTableExists(false)
      setLoading(false)
      return
    }

    setTemplates(data ?? [])

    // 각 템플릿별 필드 수 집계
    try {
      const { data: fields } = await supabase
        .from('record_fields')
        .select('template_id')
      const counts: Record<string, number> = {}
      for (const f of fields ?? []) {
        const tid = (f as Record<string, unknown>).template_id
        if (typeof tid === 'string') {
          counts[tid] = (counts[tid] ?? 0) + 1
        }
      }
      setFieldCounts(counts)
    } catch {
      // record_fields 테이블이 없을 수 있음
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (!loading && !tableExists) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-neutral-900">기록 양식 관리</h1>
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <p className="text-base font-semibold text-neutral-700">
            record_templates 테이블이 아직 준비되지 않았습니다
          </p>
          <p className="mt-3 text-sm text-neutral-500">
            Supabase SQL Editor에서{' '}
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
              sql/004_record_templates.sql
            </code>
            을 실행하세요.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">기록 양식 관리</h1>
          <p className="mt-1 text-sm text-neutral-500">
            방문 기록 작성 시 사용할 양식과 필드를 관리합니다 · {templates.length}개
          </p>
        </div>
        <Link
          href="/admin/record-templates/new"
          className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700"
        >
          + 양식 추가
        </Link>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-neutral-600">불러오는 중...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-neutral-600">등록된 양식이 없습니다.</p>
          <p className="mt-2 text-xs text-neutral-400">
            위의 추가 버튼으로 첫 양식을 만들거나, SQL 시드를 실행하세요.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Link
              key={t.id}
              href={`/admin/record-templates/${t.id}`}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-bold text-neutral-900">{t.name}</h2>
                <div className="flex shrink-0 items-center gap-1.5">
                  {t.is_default && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                      기본
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      t.is_active
                        ? 'bg-green-50 text-green-700'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {t.is_active ? '활성' : '비활성'}
                  </span>
                </div>
              </div>

              {t.description && (
                <p className="mt-2 text-xs leading-5 text-neutral-500">
                  {t.description.length > 60
                    ? t.description.slice(0, 60) + '...'
                    : t.description}
                </p>
              )}

              <div className="mt-4 flex items-center gap-3 text-xs text-neutral-400">
                <span>{fieldCounts[t.id] ?? 0}개 필드</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
