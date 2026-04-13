'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// TODO: 역할 기반 인증 연동 — 현재는 누구나 상태 변경 가능

/**
 * 범용 상태 관리 컴포넌트 (활성/비활성/아카이브)
 *
 * 스키마 방어 전략:
 *   1. `active` (boolean) — primary: 대부분의 테이블에서 사용
 *   2. `is_active` (boolean) — alternate: 일부 테이블에서 사용 가능
 *   3. `archived_at` (timestamp | null) — alternate: soft-delete 패턴
 *
 * Supabase는 존재하지 않는 컬럼 업데이트 시 에러를 반환하므로
 * 먼저 현재 레코드의 필드를 읽고 어떤 패턴인지 감지합니다.
 */

type StatusSchemaType = 'active' | 'is_active' | 'archived_at' | 'unknown'

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
  if ('active' in record) return 'active'
  if ('is_active' in record) return 'is_active'
  if ('archived_at' in record) return 'archived_at'
  return 'unknown'
}

function isCurrentlyActive(record: Record<string, unknown>, schema: StatusSchemaType): boolean {
  switch (schema) {
    case 'active':
      return record.active !== false
    case 'is_active':
      return record.is_active !== false
    case 'archived_at':
      return record.archived_at == null
    default:
      return true
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
      case 'active':
        payload = { active: nextActive }
        break
      case 'is_active':
        payload = { is_active: nextActive }
        break
      case 'archived_at':
        payload = { archived_at: nextActive ? null : new Date().toISOString() }
        break
      case 'unknown':
        // 스키마에 상태 컬럼이 없으면 active를 시도
        // Supabase가 컬럼 없으면 에러 반환 — 사용자에게 안내
        payload = { active: nextActive }
        break
    }

    const { error: updateError } = await supabase
      .from(table)
      .update(payload)
      .eq('id', recordId)

    setLoading(false)

    if (updateError) {
      if (
        updateError.message.includes('does not exist') ||
        updateError.message.includes('column')
      ) {
        setError(
          `이 테이블에는 아직 상태 관리 컬럼이 없습니다. Supabase에 active (boolean) 컬럼을 추가해주세요.`
        )
      } else {
        setError(`상태 변경 중 오류: ${updateError.message}`)
      }
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
          {schema === 'unknown' && (
            <span className="text-xs text-amber-500">
              (상태 컬럼 미감지)
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
