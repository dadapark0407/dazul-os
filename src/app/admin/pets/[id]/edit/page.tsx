'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// TODO: 역할 기반 인증 추가 필요
// TODO: 입력 유효성 검사 강화 (이름 필수, 체중 범위 등)
// TODO: 이미지 업로드 필드 추가 고려

export default function AdminPetEditPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // 편집 가능 필드 — 컬럼이 없어도 안전하게 무시됨
  const [name, setName] = useState('')
  const [breed, setBreed] = useState('')
  const [gender, setGender] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [weight, setWeight] = useState('')
  const [memo, setMemo] = useState('')
  const [cautionNotes, setCautionNotes] = useState('')

  // 보호자 정보 (읽기 전용 표시용)
  const [guardianName, setGuardianName] = useState('')
  const [guardianId, setGuardianId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPet() {
      setLoading(true)
      setErrorMessage('')

      const { data, error } = await supabase
        .from('pets')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        setErrorMessage('반려견 정보를 불러오지 못했습니다.')
        setLoading(false)
        return
      }

      setName(data.name ?? '')
      setBreed(data.breed ?? '')
      setGender(data.gender ?? '')
      setBirthDate(data.birthdate ?? '')
      setGuardianId(data.guardian_id ?? null)

      // pets 테이블에는 weight/caution_notes 컬럼이 없어 memo에 병합 저장됨
      // ('체중: Nkg', '주의사항: ...') 을 memo 에서 분리
      const rawMemo = typeof data.memo === 'string' ? data.memo : ''
      const lines = rawMemo.split('\n')
      let extractedWeight = ''
      let extractedCaution = ''
      const remainingLines: string[] = []
      for (const line of lines) {
        const wMatch = line.match(/^체중\s*:\s*([\d.]+)\s*kg\s*$/)
        const cMatch = line.match(/^주의사항\s*:\s*(.*)$/)
        if (wMatch) extractedWeight = wMatch[1]
        else if (cMatch) extractedCaution = cMatch[1].trim()
        else remainingLines.push(line)
      }
      setWeight(extractedWeight)
      setCautionNotes(extractedCaution)
      setMemo(remainingLines.join('\n').trim())

      // 보호자 이름 가져오기
      if (data.guardian_id) {
        const { data: guardian } = await supabase
          .from('guardians')
          .select('name')
          .eq('id', data.guardian_id)
          .single()

        setGuardianName(guardian?.name ?? '')
      }

      setLoading(false)
    }

    fetchPet()
  }, [id])

  async function handleSave() {
    if (!name.trim()) {
      alert('반려견 이름은 필수입니다.')
      return
    }

    setSaving(true)
    setErrorMessage('')

    // pets 테이블에 weight/caution_notes 컬럼이 없어 memo 에 병합 저장
    const baseMemo = memo.trim()
    const weightNote = weight.trim() ? `체중: ${weight.trim()}kg` : ''
    const cautionNote = cautionNotes.trim() ? `주의사항: ${cautionNotes.trim()}` : ''
    const mergedMemo =
      [baseMemo, weightNote, cautionNote].filter(Boolean).join('\n').trim() || null

    const payload: Record<string, unknown> = {
      name: name.trim(),
      breed: breed.trim() || null,
      gender: gender.trim() || null,
      birthdate: birthDate || null,
      memo: mergedMemo,
    }

    const { error } = await supabase
      .from('pets')
      .update(payload)
      .eq('id', id)

    setSaving(false)

    if (error) {
      setErrorMessage(`저장 중 오류가 발생했습니다: ${error.message}`)
      return
    }

    router.push(`/admin/pets/${id}`)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Link
          href={`/admin/pets/${id}`}
          className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
        >
          ← 돌아가기
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900">반려견 수정</h1>
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
          href="/admin/pets"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
        >
          ← 반려견 목록
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900">반려견 수정</h1>
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
            href={`/admin/pets/${id}`}
            className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
          >
            ← 상세로 돌아가기
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-neutral-900">반려견 수정</h1>
        </div>
      </div>

      {/* 보호자 정보 (읽기 전용) */}
      {guardianId && (
        <div className="rounded-2xl bg-neutral-50 px-5 py-3 ring-1 ring-neutral-200">
          <p className="text-xs font-semibold text-neutral-500">보호자</p>
          <p className="mt-1 text-sm font-medium text-neutral-800">
            {guardianName || '이름 없음'}
          </p>
        </div>
      )}

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <div className="grid gap-5 sm:grid-cols-2">
          {/* 이름 */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              이름 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="반려견 이름"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          {/* 품종 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              품종
            </label>
            <input
              type="text"
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              placeholder="예: 푸들, 말티즈"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          {/* 성별 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              성별
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-500"
            >
              <option value="">선택 안 함</option>
              <option value="남아">남아</option>
              <option value="여아">여아</option>
              <option value="중성화 남아">중성화 남아</option>
              <option value="중성화 여아">중성화 여아</option>
            </select>
          </div>

          {/* 생년월일 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              생년월일
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          {/* 체중 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              체중 (kg)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="예: 4.5"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          {/* 메모 */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              메모
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              placeholder="일반 메모"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          {/* 주의사항 */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              주의사항
            </label>
            <textarea
              value={cautionNotes}
              onChange={(e) => setCautionNotes(e.target.value)}
              rows={3}
              placeholder="터치 민감 부위, 알레르기, 행동 주의 등"
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
            onClick={() => router.push(`/admin/pets/${id}`)}
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
