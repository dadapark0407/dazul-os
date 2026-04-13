'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// TODO: 역할 기반 인증 추가 필요
// TODO: 방문 기록 저장 후 자동 팔로업 생성 플로우 연동

const TYPE_OPTIONS = [
  { value: '재방문', label: '재방문' },
  { value: '피부 체크', label: '피부 체크' },
  { value: '컨디션 체크', label: '컨디션 체크' },
  { value: '제품 사용 확인', label: '제품 사용 확인' },
  { value: '기타', label: '기타' },
]

type Pet = { id: string; name: string | null; guardian_id: string | null }
type Guardian = { id: string; name: string | null; phone: string | null }
type VisitRecord = { id: string; visit_date: string | null; pet_id: string | null }

export default function AdminFollowupNewPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-neutral-900">새 팔로업 등록</h1>
          <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
            <p className="text-sm text-neutral-600">불러오는 중...</p>
          </div>
        </div>
      }
    >
      <AdminFollowupNewForm />
    </Suspense>
  )
}

function AdminFollowupNewForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL에서 사전 선택값 읽기 (방문 기록 상세에서 링크할 때 유용)
  const presetPetId = searchParams.get('pet_id') ?? ''
  const presetGuardianId = searchParams.get('guardian_id') ?? ''
  const presetRecordId = searchParams.get('record_id') ?? ''

  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // 관계 데이터
  const [pets, setPets] = useState<Pet[]>([])
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [records, setRecords] = useState<VisitRecord[]>([])
  const [filteredPets, setFilteredPets] = useState<Pet[]>([])
  const [filteredRecords, setFilteredRecords] = useState<VisitRecord[]>([])

  // 폼 필드
  const [petId, setPetId] = useState(presetPetId)
  const [guardianId, setGuardianId] = useState(presetGuardianId)
  const [relatedRecordId, setRelatedRecordId] = useState(presetRecordId)
  const [type, setType] = useState('재방문')
  const [dueDate, setDueDate] = useState('')
  const [note, setNote] = useState('')

  // 데이터 로드
  useEffect(() => {
    async function fetchData() {
      const [petsResult, guardiansResult, recordsResult] = await Promise.all([
        supabase.from('pets').select('id, name, guardian_id').order('name'),
        supabase.from('guardians').select('id, name, phone').order('name'),
        supabase
          .from('visit_records')
          .select('id, visit_date, pet_id')
          .order('visit_date', { ascending: false })
          .limit(50),
      ])

      setPets(petsResult.data ?? [])
      setGuardians(guardiansResult.data ?? [])
      setRecords(recordsResult.data ?? [])
    }

    fetchData()
  }, [])

  // 보호자 선택 시 반려견/기록 필터링
  useEffect(() => {
    if (!guardianId) {
      setFilteredPets(pets)
      setFilteredRecords(records)
      return
    }
    const gPets = pets.filter((p) => p.guardian_id === guardianId)
    setFilteredPets(gPets)

    const gPetIds = new Set(gPets.map((p) => p.id))
    setFilteredRecords(records.filter((r) => r.pet_id && gPetIds.has(r.pet_id)))
  }, [guardianId, pets, records])

  // 반려견 선택 시 보호자 자동 설정
  useEffect(() => {
    if (!petId) return
    const pet = pets.find((p) => p.id === petId)
    if (pet?.guardian_id && !guardianId) {
      setGuardianId(pet.guardian_id)
    }
  }, [petId, pets, guardianId])

  async function handleSave() {
    if (!type) {
      alert('유형을 선택해 주세요.')
      return
    }

    setSaving(true)
    setErrorMessage('')

    const payload: Record<string, unknown> = {
      pet_id: petId || null,
      guardian_id: guardianId || null,
      related_record_id: relatedRecordId || null,
      type,
      status: 'pending',
      due_date: dueDate || null,
      note: note || null,
    }

    const { error } = await supabase.from('followups').insert(payload)

    setSaving(false)

    if (error) {
      setErrorMessage(`저장 중 오류가 발생했습니다: ${error.message}`)
      return
    }

    router.push('/admin/followups')
  }

  function formatRecordLabel(r: VisitRecord): string {
    const date = r.visit_date ?? '날짜 없음'
    const pet = pets.find((p) => p.id === r.pet_id)
    const petName = pet?.name ?? ''
    return `${date}${petName ? ` · ${petName}` : ''}`
  }

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
        <h1 className="mt-1 text-2xl font-bold text-neutral-900">새 팔로업 등록</h1>
        <p className="mt-1 text-sm text-neutral-500">
          재방문 알림, 피부/컨디션 체크 등 후속 관리를 등록합니다.
        </p>
      </div>

      {/* 유형 선택 */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          유형
        </h2>
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setType(opt.value)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                type === opt.value
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* 연결 정보 */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          연결 정보
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              보호자
            </label>
            <select
              value={guardianId}
              onChange={(e) => setGuardianId(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-500"
            >
              <option value="">선택 안 함</option>
              {guardians.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name ?? '이름 없음'} {g.phone ? `(${g.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              반려견
            </label>
            <select
              value={petId}
              onChange={(e) => setPetId(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-500"
            >
              <option value="">선택 안 함</option>
              {(guardianId ? filteredPets : pets).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name ?? '이름 없음'}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              관련 방문 기록 (선택)
            </label>
            <select
              value={relatedRecordId}
              onChange={(e) => setRelatedRecordId(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-500"
            >
              <option value="">선택 안 함</option>
              {(guardianId ? filteredRecords : records).map((r) => (
                <option key={r.id} value={r.id}>
                  {formatRecordLabel(r)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 기한 + 메모 */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          세부 내용
        </h2>
        <div className="grid gap-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              기한
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              메모
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="예: 2주 뒤 피부 상태 재확인 필요, 보호자에게 보습제 사용 여부 확인"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>
        </div>
      </section>

      {/* 에러 + 액션 */}
      {errorMessage && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.push('/admin/followups')}
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
          {saving ? '저장 중...' : '팔로업 등록'}
        </button>
      </div>
    </div>
  )
}
