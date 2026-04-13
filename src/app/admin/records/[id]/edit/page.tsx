'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import ReportDraftGenerator from '@/components/ReportDraftGenerator'
import type { ReportDraftInput } from '@/lib/reportDraft'
import { createAutoFollowups } from '@/lib/autoFollowup'

// TODO: 역할 기반 인증 추가 필요
// TODO: 입력 유효성 검사 강화 (방문일 필수 등)
// TODO: 보호자/반려견 변경 시 연동 선택 UI 개선

const CONDITION_OPTIONS = ['안정', '예민', '피곤', '활발']
const STRESS_OPTIONS = ['낮음', '보통', '높음', '초반 긴장 후 안정']

type Guardian = { id: string; name: string | null; phone: string | null }
type Pet = { id: string; guardian_id: string | null; name: string | null; breed: string | null }

export default function AdminRecordEditPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // 관계 데이터 (드롭다운용)
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [filteredPets, setFilteredPets] = useState<Pet[]>([])

  // 기본 정보
  const [guardianId, setGuardianId] = useState('')
  const [petId, setPetId] = useState('')
  const [visitDate, setVisitDate] = useState('')
  const [serviceType, setServiceType] = useState('')

  // 건강 상태
  const [skinStatus, setSkinStatus] = useState('')
  const [coatStatus, setCoatStatus] = useState('')
  const [conditionStatus, setConditionStatus] = useState('')
  const [stressStatus, setStressStatus] = useState('')

  // 케어 기록
  const [careSummary, setCareSummary] = useState('')
  const [careActions, setCareActions] = useState('')
  const [careNotes, setCareNotes] = useState('')
  const [nextCareGuide, setNextCareGuide] = useState('')

  // 추가 기록
  const [specialNotes, setSpecialNotes] = useState('')
  const [nextVisitRecommendation, setNextVisitRecommendation] = useState('')
  const [note, setNote] = useState('')

  // 보호자/반려견 목록 + 기존 레코드 로드
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setErrorMessage('')

      // 병렬 로드: 레코드 + 보호자 + 반려견
      const [recordResult, guardiansResult, petsResult] = await Promise.all([
        supabase.from('visit_records').select('*').eq('id', id).single(),
        supabase.from('guardians').select('id, name, phone').order('name'),
        supabase.from('pets').select('id, guardian_id, name, breed').order('name'),
      ])

      if (recordResult.error || !recordResult.data) {
        setErrorMessage('방문 기록을 불러오지 못했습니다.')
        setLoading(false)
        return
      }

      const data = recordResult.data
      setGuardians(guardiansResult.data ?? [])
      setPets(petsResult.data ?? [])

      // 필드 세팅 — 존재하지 않는 컬럼은 빈 문자열로 안전 처리
      setGuardianId(data.guardian_id ?? '')
      setPetId(data.pet_id ?? '')
      setVisitDate(data.visit_date ?? '')
      setServiceType(data.service_type ?? '')
      setSkinStatus(data.skin_status ?? '')
      setCoatStatus(data.coat_status ?? '')
      setConditionStatus(data.condition_status ?? '')
      setStressStatus(data.stress_status ?? '')
      setCareSummary(data.care_summary ?? '')
      setCareActions(data.care_actions ?? '')
      setCareNotes(data.care_notes ?? '')
      setNextCareGuide(data.next_care_guide ?? '')
      setSpecialNotes(data.special_notes ?? '')
      setNextVisitRecommendation(data.next_visit_recommendation ?? '')
      setNote(data.note ?? '')

      setLoading(false)
    }

    fetchData()
  }, [id])

  // 보호자 선택 시 반려견 필터링
  useEffect(() => {
    if (!guardianId) {
      setFilteredPets(pets)
      return
    }
    const next = pets.filter((p) => p.guardian_id === guardianId)
    setFilteredPets(next)
    // 현재 petId가 필터 결과에 없으면 유지 (기존 데이터 보호)
  }, [guardianId, pets])

  async function handleSave() {
    if (!visitDate) {
      alert('방문일은 필수입니다.')
      return
    }

    setSaving(true)
    setErrorMessage('')

    // Supabase는 존재하지 않는 컬럼은 무시하지 않고 에러를 반환하므로
    // 실제 스키마에 있는 필드만 보내야 함
    // types/visit.ts에 정의된 필드 기준으로 구성
    const payload: Record<string, unknown> = {
      guardian_id: guardianId || null,
      pet_id: petId || null,
      visit_date: visitDate,
      service_type: serviceType || null,
      skin_status: skinStatus || null,
      coat_status: coatStatus || null,
      condition_status: conditionStatus || null,
      stress_status: stressStatus || null,
      care_summary: careSummary || null,
      care_actions: careActions || null,
      care_notes: careNotes || null,
      next_care_guide: nextCareGuide || null,
      special_notes: specialNotes || null,
      next_visit_recommendation: nextVisitRecommendation || null,
      note: note || null,
    }

    const { error } = await supabase
      .from('visit_records')
      .update(payload)
      .eq('id', id)

    if (error) {
      setSaving(false)
      setErrorMessage(`저장 중 오류가 발생했습니다: ${error.message}`)
      return
    }

    // 자동 팔로업 생성/갱신 (실패해도 저장 성공에는 영향 없음)
    // 저장 버튼은 리디렉션까지 비활성 상태 유지
    try {
      await createAutoFollowups({
        visitRecordId: id,
        petId: petId || null,
        guardianId: guardianId || null,
        visitDate,
        serviceType,
        skinStatus,
        coatStatus,
        conditionStatus,
        stressStatus,
        specialNotes,
        nextVisitRecommendation,
        careNotes,
      })
    } catch (e) {
      console.warn('자동 팔로업 생성 중 오류 (무시됨):', e)
    }

    // setSaving(false) 생략 — router.push가 페이지를 교체하므로 불필요
    router.push(`/admin/records/${id}`)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Link
          href={`/admin/records/${id}`}
          className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
        >
          ← 돌아가기
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900">방문 기록 수정</h1>
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-neutral-600">불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (errorMessage && !visitDate) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/records"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
        >
          ← 방문 기록 목록
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900">방문 기록 수정</h1>
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-red-600">{errorMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <Link
          href={`/admin/records/${id}`}
          className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
        >
          ← 상세로 돌아가기
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-neutral-900">방문 기록 수정</h1>
      </div>

      {/* 기본 정보 */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          기본 정보
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              방문일 <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              서비스
            </label>
            <input
              type="text"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              placeholder="예: 미용, 목욕관리, 스파, 팩"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

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
                  {p.name ?? '이름 없음'} {p.breed ? `(${p.breed})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 건강 상태 */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          건강 상태
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              피부 상태
            </label>
            <input
              type="text"
              value={skinStatus}
              onChange={(e) => setSkinStatus(e.target.value)}
              placeholder="예: 건조, 민감, 각질 있음"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              모질 상태
            </label>
            <input
              type="text"
              value={coatStatus}
              onChange={(e) => setCoatStatus(e.target.value)}
              placeholder="예: 엉킴 있음, 윤기 개선"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              컨디션
            </label>
            <div className="flex flex-wrap gap-2">
              {CONDITION_OPTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setConditionStatus(conditionStatus === item ? '' : item)}
                  className={`rounded-full border px-3.5 py-2 text-sm font-medium transition ${
                    conditionStatus === item
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              스트레스
            </label>
            <div className="flex flex-wrap gap-2">
              {STRESS_OPTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setStressStatus(stressStatus === item ? '' : item)}
                  className={`rounded-full border px-3.5 py-2 text-sm font-medium transition ${
                    stressStatus === item
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 케어 기록 */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          케어 기록
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              오늘 케어 요약
            </label>
            <textarea
              value={careSummary}
              onChange={(e) => setCareSummary(e.target.value)}
              rows={3}
              placeholder="예: 목욕 + 손질, 피부 보습 집중 케어"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              진행한 케어 내용
            </label>
            <textarea
              value={careActions}
              onChange={(e) => setCareActions(e.target.value)}
              rows={3}
              placeholder="예: 샴푸, 트리트먼트, 발 마사지"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              문제 → 조치
            </label>
            <textarea
              value={careNotes}
              onChange={(e) => setCareNotes(e.target.value)}
              rows={3}
              placeholder="예: 털 엉킴 → 브러시 제거, 피부 건조 → 보습제 적용"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              다음 케어 가이드
            </label>
            <textarea
              value={nextCareGuide}
              onChange={(e) => setNextCareGuide(e.target.value)}
              rows={3}
              placeholder="예: 2주 뒤 재방문 시 물광 케어 추천"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>
        </div>
      </section>

      {/* 추가 기록 */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          추가 기록
        </h2>
        <div className="grid gap-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              특이사항
            </label>
            <textarea
              value={specialNotes}
              onChange={(e) => setSpecialNotes(e.target.value)}
              rows={3}
              placeholder="예: 귀 청소 민감, 뒷다리 터치 예민"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              다음 방문 추천
            </label>
            <textarea
              value={nextVisitRecommendation}
              onChange={(e) => setNextVisitRecommendation(e.target.value)}
              rows={2}
              placeholder="예: 3주 뒤 목욕관리 + 보습 케어 추천"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              자유 메모
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="기타 메모"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>
        </div>
      </section>

      {/* 리포트 초안 생성 */}
      <ReportDraftGenerator
        getInput={(): ReportDraftInput => {
          const pet = pets.find((p) => p.id === petId)
          const guardian = guardians.find((g) => g.id === guardianId)
          return {
            petName: pet?.name ?? null,
            guardianName: guardian?.name ?? null,
            breed: pet?.breed ?? null,
            visitDate,
            serviceType,
            skinStatus,
            coatStatus,
            conditionStatus,
            stressStatus,
            careSummary,
            careActions,
            careNotes,
            nextCareGuide,
            specialNotes,
            nextVisitRecommendation,
            note,
          }
        }}
      />

      {/* 에러 + 액션 */}
      {errorMessage && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.push(`/admin/records/${id}`)}
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
  )
}
