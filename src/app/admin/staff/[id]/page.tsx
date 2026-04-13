'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ROLE_LABELS, ROLES, type Role } from '@/lib/roles'

// TODO: owner 역할만 접근 가능하도록 제한 필요
// TODO: 스태프 수정 폼 별도 페이지 or 인라인 편집

type StaffMember = Record<string, unknown>

function str(obj: Record<string, unknown> | null, key: string): string | null {
  if (!obj) return null
  const v = obj[key]
  return typeof v === 'string' ? v : null
}

function bool(obj: Record<string, unknown> | null, key: string): boolean | null {
  if (!obj) return null
  const v = obj[key]
  return typeof v === 'boolean' ? v : null
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

export default function AdminStaffDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [staff, setStaff] = useState<StaffMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      const { data, error: fetchError } = await supabase
        .from('staff_profiles')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !data) {
        setError('스태프 정보를 찾을 수 없습니다.')
        setLoading(false)
        return
      }

      setStaff(data)
      setLoading(false)
    }

    fetchData()
  }, [id])

  async function updateRole(newRole: string) {
    setUpdating(true)
    const { error: updateError } = await supabase
      .from('staff_profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) {
      alert(`역할 변경 실패: ${updateError.message}`)
      setUpdating(false)
      return
    }

    setStaff((prev) => (prev ? { ...prev, role: newRole } : prev))
    setUpdating(false)
  }

  async function toggleActive() {
    const currentActive = bool(staff, 'is_active')
    const newActive = currentActive === false ? true : false

    setUpdating(true)
    const { error: updateError } = await supabase
      .from('staff_profiles')
      .update({ is_active: newActive, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) {
      alert(`상태 변경 실패: ${updateError.message}`)
      setUpdating(false)
      return
    }

    setStaff((prev) => (prev ? { ...prev, is_active: newActive } : prev))
    setUpdating(false)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/staff"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
        >
          ← 스태프 목록
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900">스태프 상세</h1>
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-neutral-600">불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error || !staff) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/staff"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
        >
          ← 스태프 목록
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900">스태프 상세</h1>
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-red-600">{error || '데이터를 찾을 수 없습니다.'}</p>
        </div>
      </div>
    )
  }

  const name = str(staff, 'name') ?? '이름 없음'
  const role = str(staff, 'role') ?? 'staff'
  const isActive = bool(staff, 'is_active') !== false
  const userId = str(staff, 'user_id')
  const createdAt = str(staff, 'created_at')
  const updatedAt = str(staff, 'updated_at')

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <Link
          href="/admin/staff"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
        >
          ← 스태프 목록
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-neutral-900">{name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-neutral-100 px-3 py-1 text-sm font-medium text-neutral-700">
            {ROLE_LABELS[role as Role] ?? role}
          </span>
          {isActive ? (
            <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
              활성
            </span>
          ) : (
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">
              비활성
            </span>
          )}
        </div>
      </div>

      {/* 기본 정보 */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          기본 정보
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-neutral-50 p-4">
            <p className="text-xs font-medium text-neutral-500">이름</p>
            <p className="mt-1 text-sm font-medium text-neutral-800">{name}</p>
          </div>
          <div className="rounded-xl bg-neutral-50 p-4">
            <p className="text-xs font-medium text-neutral-500">역할</p>
            <p className="mt-1 text-sm font-medium text-neutral-800">
              {ROLE_LABELS[role as Role] ?? role}
            </p>
          </div>
          <div className="rounded-xl bg-neutral-50 p-4">
            <p className="text-xs font-medium text-neutral-500">등록일</p>
            <p className="mt-1 text-sm font-medium text-neutral-800">
              {formatDate(createdAt)}
            </p>
          </div>
          {updatedAt && (
            <div className="rounded-xl bg-neutral-50 p-4">
              <p className="text-xs font-medium text-neutral-500">최근 수정</p>
              <p className="mt-1 text-sm font-medium text-neutral-800">
                {formatDate(updatedAt)}
              </p>
            </div>
          )}
          {userId && (
            <div className="rounded-xl bg-neutral-50 p-4 sm:col-span-2">
              <p className="text-xs font-medium text-neutral-500">Supabase User ID</p>
              <p className="mt-1 break-all font-mono text-xs text-neutral-600">{userId}</p>
            </div>
          )}
        </div>
      </section>

      {/* 역할 변경 */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          역할 변경
        </h2>
        <p className="mb-4 text-xs text-neutral-500">
          주의: 역할을 변경하면 해당 스태프의 접근 범위가 즉시 바뀝니다.
        </p>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => updateRole(r)}
              disabled={updating || role === r}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                role === r
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-50'
              }`}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </section>

      {/* 활성/비활성 토글 */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          계정 상태
        </h2>
        <div className="flex items-center gap-4">
          <p className="text-sm text-neutral-600">
            현재 상태: <strong>{isActive ? '활성' : '비활성'}</strong>
          </p>
          <button
            type="button"
            onClick={toggleActive}
            disabled={updating}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
              isActive
                ? 'border border-neutral-300 text-neutral-600 hover:bg-neutral-50'
                : 'bg-green-600 text-white hover:bg-green-500'
            }`}
          >
            {updating ? '처리 중...' : isActive ? '비활성화' : '활성화'}
          </button>
        </div>
        {!isActive && (
          <p className="mt-3 text-xs text-neutral-500">
            비활성 스태프는 로그인 시 접근이 차단됩니다. (인증 연동 후 적용)
          </p>
        )}
      </section>
    </div>
  )
}
