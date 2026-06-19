'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// TODO: 역할 기반 인증 연동 — 현재는 누구나 상태 변경 가능

/**
 * 범용 상태 관리 컴포넌트 (활성/비활성/아카이브)
 *
 * 테이블별 상태 컬럼 패턴:
 *   1. `status` (text: 'active' | 'inactive') — pets
 *   2. `active` (boolean)
 *   3. `is_active` (boolean) — products
 *   4. `archived_at` (timestamp | null) — soft-delete 패턴
 */

type StatusSchemaType = 'status' | 'active' | 'is_active' | 'archived_at'

type StatusActionProps = {
  /** Supabase 테이블 이름 */
  table: string
  /** 레코드 ID */
  recordId: string
  /** 현재 레코드 전체 (서버에서 넘겨줌) */
  record: Record<string, unknown>
  /** 엔티티 한국어 이름 (예: "반려견", "보호자", "제품") */
  entityLabel: string
}

function detectSchema(record: Record<string, unknown>): StatusSchemaType {
  if ('status' in record) return 'status'
  if ('active' in record) return 'active'
  if ('is_active' in record) return 'is_active'
  if ('archived_at' in record) return 'archived_at'
  return 'status'
}

function isCurrentlyActive(record: Record<string, unknown>, schema: StatusSchemaType): boolean {
  switch (schema) {
    case 'status':
      return record.status !== 'inactive'
    case 'active':
      return record.active !== false
    case 'is_active':
      return record.is_active !== false
    case 'archived_at':
      return record.archived_at == null
  }
}

function getStatusLabel(active: boolean): string {
  return active ? '활성' : '비활성'
}

export default function StatusAction({
  table,
  recordId,
  record,
  entityLabel,
}: StatusActionProps) {
  const router = useRouter()
  const schema = detectSchema(record)
  const currentlyActive = isCurrentlyActive(record, schema)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleToggle() {
    const nextActive = !currentlyActive
    const action = nextActive ? '활성화' : '비활성화'
    const ok = confirm(`이 ${entityLabel}을(를) ${action}할까요?`)
    if (!ok) return

    setLoading(true)
    setError('')

    let payload: Record<string, unknown> = {}

    switch (schema) {
      case 'status':
        payload = { status: nextActive ? 'active' : 'inactive' }
        break
      case 'active':
        payload = { active: nextActive }
        break
      case 'is_active':
        payload = { is_active: nextActive }
        break
      case 'archived_at':
        payload = { archived_at: nextActive ? null : new Date().toISOString() }
        break
    }

    const { error: updateError } = await supabase
      .from(table)
      .update(payload)
      .eq('id', recordId)

    setLoading(false)

    if (updateError) {
      setError(`상태 변경 중 오류: ${updateError.message}`)
      return
    }

    router.refresh()
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        상태 관리
      </h2>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-neutral-700">현재 상태</span>
          {currentlyActive ? (
            <span className="inline-block rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
              활성
            </span>
          ) : (
            <span className="inline-block rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-500">
              비활성
            </span>
          )}
          {schema === 'archived_at' && !currentlyActive && record.archived_at != null && (
            <span className="text-xs text-neutral-400">
              아카이브됨
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleToggle}
          disabled={loading}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
            currentlyActive
              ? 'border border-red-200 bg-white text-red-600 hover:bg-red-50'
              : 'border border-green-200 bg-white text-green-700 hover:bg-green-50'
          }`}
        >
          {loading
            ? '처리 중...'
            : currentlyActive
              ? '비활성화'
              : '다시 활성화'}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
          {error}
        </div>
      )}

      {!currentlyActive && (
        <p className="mt-3 text-xs text-neutral-400">
          비활성화된 {entityLabel}은(는) 목록에서 필터링할 수 있지만 데이터가 삭제되지는 않습니다.
        </p>
      )}
    </section>
  )
}
