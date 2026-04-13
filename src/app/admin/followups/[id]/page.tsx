'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// TODO: 역할 기반 인증 추가 필요
// TODO: 수정 폼 or 인라인 편집 추가

type Followup = Record<string, unknown>

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: '대기' },
  completed: { bg: 'bg-green-50', text: 'text-green-700', label: '완료' },
  skipped: { bg: 'bg-neutral-100', text: 'text-neutral-500', label: '건너뜀' },
  cancelled: { bg: 'bg-neutral-100', text: 'text-neutral-500', label: '취소' },
}

function str(obj: Record<string, unknown> | null, key: string): string | null {
  if (!obj) return null
  const v = obj[key]
  return typeof v === 'string' ? v : null
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export default function AdminFollowupDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [followup, setFollowup] = useState<Followup | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')

  // 관계 데이터
  const [petName, setPetName] = useState<string | null>(null)
  const [guardianName, setGuardianName] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      const { data, error: fetchError } = await supabase
        .from('followups')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !data) {
        setError('팔로업을 찾을 수 없습니다.')
        setLoading(false)
        return
      }

      setFollowup(data)

      // 반려견/보호자 이름
      const petId = str(data, 'pet_id')
      const guardianId = str(data, 'guardian_id')

      if (petId) {
        const { data: pet } = await supabase
          .from('pets')
          .select('name')
          .eq('id', petId)
          .maybeSingle()
        setPetName(pet?.name ?? null)
      }
      if (guardianId) {
        const { data: guardian } = await supabase
          .from('guardians')
          .select('name')
          .eq('id', guardianId)
          .maybeSingle()
        setGuardianName(guardian?.name ?? null)
      }

      setLoading(false)
    }

    fetchData()
  }, [id])

  async function updateStatus(newStatus: string) {
    setUpdating(true)
    const { error: updateError } = await supabase
      .from('followups')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) {
      alert(`상태 변경 실패: ${updateError.message}`)
      setUpdating(false)
      return
    }

    setFollowup((prev) => (prev ? { ...prev, status: newStatus } : prev))
    setUpdating(false)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/followups"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
        >
          ← 후속 관리 목록
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900">팔로업 상세</h1>
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-neutral-600">불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error || !followup) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/followups"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
        >
          ← 후속 관리 목록
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900">팔로업 상세</h1>
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-red-600">{error || '데이터를 찾을 수 없습니다.'}</p>
        </div>
      </div>
    )
  }

  const status = str(followup, 'status') ?? 'pending'
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.pending
  const type = str(followup, 'type') ?? '-'
  const dueDate = str(followup, 'due_date')
  const note = str(followup, 'note')
  const petId = str(followup, 'pet_id')
  const guardianId = str(followup, 'guardian_id')
  const relatedRecordId = str(followup, 'related_record_id')
  const createdAt = str(followup, 'created_at')
  const updatedAt = str(followup, 'updated_at')

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <Link
          href="/admin/followups"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
        >
          ← 후속 관리 목록
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-neutral-900">팔로업 상세</h1>
      </div>

      {/* 기본 정보 카드 */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-lg bg-neutral-100 px-3 py-1 text-sm font-medium text-neutral-700">
            {type}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${badge.bg} ${badge.text}`}
          >
            {badge.label}
          </span>
        </div>

        {note && (
          <p className="mt-4 whitespace-pre-line text-sm leading-7 text-neutral-800">
            {note}
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-neutral-50 p-4">
            <p className="text-xs font-medium text-neutral-500">기한</p>
            <p className="mt-1 text-sm font-medium text-neutral-800">
              {formatDate(dueDate)}
            </p>
          </div>
          <div className="rounded-xl bg-neutral-50 p-4">
            <p className="text-xs font-medium text-neutral-500">생성일</p>
            <p className="mt-1 text-sm font-medium text-neutral-800">
              {formatDate(createdAt)}
            </p>
          </div>
          {updatedAt && updatedAt !== createdAt && (
            <div className="rounded-xl bg-neutral-50 p-4">
              <p className="text-xs font-medium text-neutral-500">최근 수정</p>
              <p className="mt-1 text-sm font-medium text-neutral-800">
                {formatDate(updatedAt)}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 연결 정보 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            반려견
          </h2>
          {petId ? (
            <>
              <p className="text-lg font-bold text-neutral-900">
                {petName ?? '이름 없음'}
              </p>
              <Link
                href={`/admin/pets/${petId}`}
                className="mt-2 inline-block text-sm font-medium text-neutral-500 hover:text-neutral-700"
              >
                상세 보기 →
              </Link>
            </>
          ) : (
            <p className="text-sm text-neutral-400">연결 없음</p>
          )}
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            보호자
          </h2>
          {guardianId ? (
            <>
              <p className="text-lg font-bold text-neutral-900">
                {guardianName ?? '이름 없음'}
              </p>
              <Link
                href={`/admin/guardians/${guardianId}`}
                className="mt-2 inline-block text-sm font-medium text-neutral-500 hover:text-neutral-700"
              >
                상세 보기 →
              </Link>
            </>
          ) : (
            <p className="text-sm text-neutral-400">연결 없음</p>
          )}
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            관련 방문 기록
          </h2>
          {relatedRecordId ? (
            <Link
              href={`/admin/records/${relatedRecordId}`}
              className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
            >
              방문 기록 보기 →
            </Link>
          ) : (
            <p className="text-sm text-neutral-400">연결 없음</p>
          )}
        </section>
      </div>

      {/* 상태 변경 액션 */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          상태 관리
        </h2>
        <div className="flex flex-wrap gap-3">
          {status !== 'completed' && (
            <button
              type="button"
              onClick={() => updateStatus('completed')}
              disabled={updating}
              className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
            >
              {updating ? '처리 중...' : '완료 처리'}
            </button>
          )}
          {status !== 'pending' && (
            <button
              type="button"
              onClick={() => updateStatus('pending')}
              disabled={updating}
              className="rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-yellow-400 disabled:opacity-50"
            >
              {updating ? '처리 중...' : '대기로 복원'}
            </button>
          )}
          {status !== 'skipped' && (
            <button
              type="button"
              onClick={() => updateStatus('skipped')}
              disabled={updating}
              className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
            >
              {updating ? '처리 중...' : '건너뜀 처리'}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
