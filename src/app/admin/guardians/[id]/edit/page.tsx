'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatPhone } from '@/lib/phone'

// TODO: 역할 기반 인증 추가 필요
// TODO: 입력 유효성 검사 강화 (이름 필수, 전화번호 형식 등)

export default function AdminGuardianEditPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [memo, setMemo] = useState('')

  // 연결된 반려견 수 (읽기 전용)
  const [petCount, setPetCount] = useState(0)

  useEffect(() => {
    async function fetchGuardian() {
      setLoading(true)
      setErrorMessage('')

      const { data, error } = await supabase
        .from('guardians')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        setErrorMessage('보호자 정보를 불러오지 못했습니다.')
        setLoading(false)
        return
      }

      setName(data.name ?? '')
      setPhone(formatPhone(data.phone ?? ''))
      setMemo(data.memo ?? '')

      // 반려견 수
      const { count } = await supabase
        .from('pets')
        .select('id', { count: 'exact', head: true })
        .eq('guardian_id', id)

      setPetCount(count ?? 0)
      setLoading(false)
    }

    fetchGuardian()
  }, [id])

  async function handleSave() {
    if (!name.trim()) {
      alert('보호자 이름은 필수입니다.')
      return
    }

    setSaving(true)
    setErrorMessage('')

    const payload: Record<string, unknown> = {
      name: name.trim(),
      phone: phone.trim() || null,
      memo: memo.trim() || null,
    }

    const { error } = await supabase
      .from('guardians')
      .update(payload)
      .eq('id', id)

    setSaving(false)

    if (error) {
      setErrorMessage(`저장 중 오류가 발생했습니다: ${error.message}`)
      return
    }

    router.push(`/admin/guardians/${id}`)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Link
          href={`/admin/guardians/${id}`}
          className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
        >
          ← 돌아가기
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900">보호자 수정</h1>
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-neutral-600">불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (errorMessage && !name) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/guardians"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
        >
          ← 보호자 목록
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900">보호자 수정</h1>
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-red-600">{errorMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/admin/guardians/${id}`}
            className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
          >
            ← 상세로 돌아가기
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-neutral-900">보호자 수정</h1>
        </div>
      </div>

      {/* 연결 반려견 수 (읽기 전용) */}
      <div className="rounded-2xl bg-neutral-50 px-5 py-3 ring-1 ring-neutral-200">
        <p className="text-xs font-semibold text-neutral-500">연결된 반려견</p>
        <p className="mt-1 text-sm font-medium text-neutral-800">{petCount}마리</p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <div className="grid gap-5">
          {/* 이름 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              이름 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="보호자 이름"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          {/* 연락처 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              연락처
            </label>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="예: 010-1234-5678"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              메모
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={4}
              placeholder="보호자 관련 메모 (선호도, 주의사항 등)"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>
        </div>

        {errorMessage && (
          <p className="mt-4 text-sm text-red-600">{errorMessage}</p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => router.push(`/admin/guardians/${id}`)}
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
