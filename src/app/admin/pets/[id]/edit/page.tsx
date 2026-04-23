'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// TODO: 역할 기반 인증 추가 필요
// TODO: 입력 유효성 검사 강화 (이름 필수, 체중 범위 등)
// TODO: 이미지 업로드 필드 추가 고려

const GENDER_OPTIONS = ['남', '여']
const NEUTERED_OPTIONS: Array<'예' | '아니오' | '모름'> = ['예', '아니오', '모름']

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
  const [gender, setGender] = useState('') // '남' / '여' / ''
  const [neutered, setNeutered] = useState<'예' | '아니오' | '모름' | ''>('')
  const [birthDate, setBirthDate] = useState('')
  const [ageInput, setAgeInput] = useState('') // 생년월일 모를 때 나이 직접 입력
  const [useAge, setUseAge] = useState(false)
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

      // 성별 복원 — 신 체계('남'/'여') 우선, 레거시('남아'/'중성화 남아' 등) 변환
      const rawGender = typeof data.gender === 'string' ? data.gender : ''
      if (rawGender === '남' || rawGender === '여') {
        setGender(rawGender)
      } else if (rawGender.includes('남')) {
        setGender('남')
      } else if (rawGender.includes('여')) {
        setGender('여')
      } else {
        setGender('')
      }

      // 중성화 복원 — neutered 컬럼(boolean) 우선, 없으면 레거시 gender 문자열 추론
      if (data.neutered === true) setNeutered('예')
      else if (data.neutered === false) setNeutered('아니오')
      else if (rawGender.includes('중성화')) setNeutered('예')
      else setNeutered('')

      // 생년월일 / 나이 복원
      const bd = data.birthdate ?? ''
      setBirthDate(bd)
      if (!bd && typeof data.birth_year === 'number' && Number.isFinite(data.birth_year)) {
        const yrs = new Date().getFullYear() - data.birth_year
        if (yrs >= 0) {
          setAgeInput(String(yrs))
          setUseAge(true)
        }
      }

      setGuardianId(data.guardian_id ?? null)

      // 레거시 '체중: Nkg' / '주의사항:' 접두가 있던 memo를 정리해서
      // 모든 내용을 "특이사항/알레르기" 단일 필드로 복원
      const rawMemo = typeof data.memo === 'string' ? data.memo : ''
      const lines = rawMemo.split('\n')
      const remainingLines: string[] = []
      for (const line of lines) {
        // 레거시 체중 줄은 제거
        if (/^체중\s*:\s*[\d.]+\s*kg\s*$/.test(line)) continue
        const cMatch = line.match(/^주의사항\s*:\s*(.*)$/)
        if (cMatch) {
          remainingLines.push(cMatch[1].trim())
        } else {
          remainingLines.push(line)
        }
      }
      setCautionNotes(remainingLines.join('\n').trim())

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

    // 특이사항/알레르기 단일 필드만 memo 에 저장 (체중/접두 없이)
    const mergedMemo = cautionNotes.trim() || null

    // 나이 → birth_year 로 저장 (birthdate 모를 때)
    let birthYearPayload: number | null = null
    if (useAge && ageInput.trim()) {
      const n = parseInt(ageInput, 10)
      if (Number.isFinite(n) && n >= 0) {
        birthYearPayload = new Date().getFullYear() - n
      }
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      breed: breed.trim() || null,
      gender: gender || null,
      birthdate: useAge ? null : birthDate || null,
      birth_year: birthYearPayload,
      neutered: neutered === '예' ? true : neutered === '아니오' ? false : null,
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
            <div className="flex flex-wrap gap-2">
              {GENDER_OPTIONS.map((opt) => {
                const active = gender === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setGender(active ? '' : opt)}
                    style={{
                      border: `1px solid ${active ? '#0A0A0A' : '#E8E5E0'}`,
                      background: active ? '#0A0A0A' : '#FFFFFF',
                      color: active ? '#FFFFFF' : '#6B6B6B',
                      borderRadius: 0,
                      fontSize: 12,
                      letterSpacing: '0.05em',
                      padding: '8px 20px',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 중성화 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              중성화 여부
            </label>
            <div className="flex flex-wrap gap-2">
              {NEUTERED_OPTIONS.map((opt) => {
                const active = neutered === opt
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setNeutered(active ? '' : opt)}
                    style={{
                      border: `1px solid ${active ? '#0A0A0A' : '#E8E5E0'}`,
                      background: active ? '#0A0A0A' : '#FFFFFF',
                      color: active ? '#FFFFFF' : '#6B6B6B',
                      borderRadius: 0,
                      fontSize: 12,
                      letterSpacing: '0.05em',
                      padding: '8px 20px',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 생년월일 / 나이 토글 */}
          <div className="sm:col-span-2">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-neutral-700">
                {useAge ? '나이 (년)' : '생년월일'}
              </label>
              <button
                type="button"
                onClick={() => setUseAge((v) => !v)}
                style={{
                  border: '1px solid #C9A96E',
                  background: '#FFFFFF',
                  color: '#C9A96E',
                  borderRadius: 0,
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  padding: '4px 10px',
                  cursor: 'pointer',
                }}
              >
                {useAge ? '생년월일로 입력' : '나이로 입력'}
              </button>
            </div>
            {useAge ? (
              <input
                type="number"
                min="0"
                value={ageInput}
                onChange={(e) => setAgeInput(e.target.value)}
                placeholder="예: 3"
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
              />
            ) : (
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
              />
            )}
          </div>

          {/* 특이사항 / 알레르기 */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              특이사항 / 알레르기
            </label>
            <textarea
              value={cautionNotes}
              onChange={(e) => setCautionNotes(e.target.value)}
              rows={3}
              placeholder="알레르기, 질환, 주의사항 등"
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
