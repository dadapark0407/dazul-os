'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { VisitRecord } from '@/types/visit'
import { createAutoFollowups } from '@/lib/autoFollowup'
import DynamicRecordFields from '@/components/DynamicRecordFields'
import ReportDraftGenerator from '@/components/ReportDraftGenerator'
import type { ReportDraftInput } from '@/lib/reportDraft'

// TODO: 역할 기반 인증 — staff 이상만 접근 가능하도록 제한
// TODO: Supabase RLS — visit_records INSERT 정책 확인 필요

type Guardian = {
  id: string
  name: string
  phone: string | null
}

type Pet = {
  id: string
  guardian_id: string
  name: string
  breed: string | null
}

const CONDITION_OPTIONS = ['안정', '예민', '피곤', '활발']
const STRESS_OPTIONS = ['낮음', '보통', '높음', '초반 긴장 후 안정']

export default function AdminNewRecordPageWrapper() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-sm text-neutral-500">불러오는 중...</div>}>
      <AdminNewRecordPage />
    </Suspense>
  )
}

function AdminNewRecordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [filteredPets, setFilteredPets] = useState<Pet[]>([])

  const [guardianId, setGuardianId] = useState(searchParams.get('guardianId') ?? '')
  const [petId, setPetId] = useState(searchParams.get('petId') ?? '')
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10))
  const [serviceType, setServiceType] = useState('')
  const [note, setNote] = useState('')
  const [careSummary, setCareSummary] = useState('')
  const [careActions, setCareActions] = useState('')
  const [careNotes, setCareNotes] = useState('')
  const [nextCareGuide, setNextCareGuide] = useState('')

  const [skinStatus, setSkinStatus] = useState('')
  const [coatStatus, setCoatStatus] = useState('')
  const [conditionStatus, setConditionStatus] = useState('')
  const [stressStatus, setStressStatus] = useState('')
  const [specialNotes, setSpecialNotes] = useState('')
  const [nextVisitRecommendation, setNextVisitRecommendation] = useState('')

  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const savingRef = useRef(false)

  // 동적 필드 값
  const dynamicValuesRef = useRef<Record<string, unknown>>({})
  const handleDynamicChange = useCallback(
    (values: Record<string, string | string[] | boolean | number | null>) => {
      dynamicValuesRef.current = values
    },
    []
  )

  useEffect(() => {
    async function fetchInitialData() {
      const [guardiansResult, petsResult] = await Promise.all([
        supabase.from('guardians').select('id, name, phone').order('name'),
        supabase.from('pets').select('id, guardian_id, name, breed').order('name'),
      ])
      setGuardians(guardiansResult.data || [])
      setPets(petsResult.data || [])
    }
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (!guardianId) {
      setFilteredPets([])
      setPetId('')
      return
    }
    const nextPets = pets.filter((pet) => pet.guardian_id === guardianId)
    setFilteredPets(nextPets)
    if (!nextPets.find((pet) => pet.id === petId)) {
      setPetId('')
    }
  }, [guardianId, pets, petId])

  async function handleSubmit() {
    setFormError('')
    setFormSuccess('')

    if (savingRef.current) return
    savingRef.current = true

    if (!guardianId || !petId || !visitDate) {
      setFormError('보호자, 반려견, 방문일은 필수입니다.')
      savingRef.current = false
      return
    }

    try {
      setSaving(true)

      const payload: Partial<VisitRecord> = {
        guardian_id: guardianId,
        pet_id: petId,
        visit_date: visitDate,
        service_type: serviceType || null,
        note: note || null,
        skin_status: skinStatus || null,
        coat_status: coatStatus || null,
        condition_status: conditionStatus || null,
        stress_status: stressStatus || null,
        special_notes: specialNotes || null,
        next_visit_recommendation: nextVisitRecommendation || null,
        care_summary: careSummary || null,
        care_actions: careActions || null,
        care_notes: careNotes || null,
        next_care_guide: nextCareGuide || null,
      }

      const { data: insertedRows, error } = await supabase
        .from('visit_records')
        .insert(payload)
        .select('id')

      if (error) {
        setFormError(`저장 중 오류가 발생했어요: ${error.message}`)
        return
      }

      const newRecordId = insertedRows?.[0]?.id

      // 동적 필드 값 저장
      if (newRecordId && Object.keys(dynamicValuesRef.current).length > 0) {
        try {
          const { data: allFields } = await supabase
            .from('record_fields')
            .select('id, field_key, field_type')
          if (allFields && allFields.length > 0) {
            const keyToField = new Map(allFields.map((f) => [f.field_key, f]))
            const rows = []
            for (const [key, val] of Object.entries(dynamicValuesRef.current)) {
              const field = keyToField.get(key)
              if (!field) continue
              if (val === '' || val === null || val === undefined) continue
              if (Array.isArray(val) && val.length === 0) continue
              const isJson = Array.isArray(val) || typeof val === 'boolean'
              rows.push({
                visit_record_id: newRecordId,
                field_id: field.id,
                value_text: isJson ? null : String(val),
                value_json: isJson ? val : null,
              })
            }
            if (rows.length > 0) {
              await supabase.from('record_values').insert(rows)
            }
          }
        } catch (e) {
          console.warn('동적 필드 값 저장 중 오류 (무시됨):', e)
        }
      }

      // 자동 팔로업 생성
      if (newRecordId) {
        try {
          await createAutoFollowups({
            visitRecordId: newRecordId,
            petId,
            guardianId,
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
      }

      setFormSuccess('방문 기록이 저장되었습니다. 이동 중...')
      router.push(`/pet/${petId}`)
    } catch {
      setFormError('저장 중 예상치 못한 오류가 발생했습니다.')
    } finally {
      setSaving(false)
      savingRef.current = false
    }
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <Link
          href="/admin/records"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-700"
        >
          ← 방문 기록 목록
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-neutral-900">방문 기록 작성</h1>
      </div>

      {/* 기본 정보 */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          기본 정보
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              보호자 <span className="text-red-400">*</span>
            </label>
            <select
              value={guardianId}
              onChange={(e) => setGuardianId(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-500"
            >
              <option value="">보호자를 선택하세요</option>
              {guardians.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} {g.phone ? `(${g.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
              반려견 <span className="text-red-400">*</span>
            </label>
            <select
              value={petId}
              onChange={(e) => setPetId(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-500"
            >
              <option value="">반려견을 선택하세요</option>
              {(guardianId ? filteredPets : pets).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.breed ? `(${p.breed})` : ''}
                </option>
              ))}
            </select>
          </div>

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
        </div>
      </section>

      {/* 건강 상태 */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          건강 상태
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">피부 상태</label>
            <input
              type="text"
              value={skinStatus}
              onChange={(e) => setSkinStatus(e.target.value)}
              placeholder="예: 건조, 민감, 각질 있음"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">모질 상태</label>
            <input
              type="text"
              value={coatStatus}
              onChange={(e) => setCoatStatus(e.target.value)}
              placeholder="예: 엉킴 있음, 윤기 개선"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">컨디션</label>
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
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">스트레스</label>
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
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">오늘 케어 요약</label>
            <textarea
              value={careSummary}
              onChange={(e) => setCareSummary(e.target.value)}
              rows={3}
              placeholder="예: 목욕 + 손질, 피부 보습 집중 케어"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">진행한 케어 내용</label>
            <textarea
              value={careActions}
              onChange={(e) => setCareActions(e.target.value)}
              rows={3}
              placeholder="예: 샴푸, 트리트먼트, 발 마사지"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">문제 → 조치</label>
            <textarea
              value={careNotes}
              onChange={(e) => setCareNotes(e.target.value)}
              rows={3}
              placeholder="예: 털 엉킴 → 브러시 제거"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">다음 케어 가이드</label>
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
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">특이사항</label>
            <textarea
              value={specialNotes}
              onChange={(e) => setSpecialNotes(e.target.value)}
              rows={3}
              placeholder="예: 귀 청소 민감, 뒷다리 터치 예민"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">다음 방문 추천</label>
            <textarea
              value={nextVisitRecommendation}
              onChange={(e) => setNextVisitRecommendation(e.target.value)}
              rows={2}
              placeholder="예: 3주 뒤 목욕관리 + 보습 케어 추천"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">자유 메모</label>
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

      {/* 동적 필드 */}
      <DynamicRecordFields onChange={handleDynamicChange} />

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

      {/* 에러/성공 + 액션 */}
      {formError && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {formError}
        </div>
      )}
      {formSuccess && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-600">
          {formSuccess}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.push('/admin/records')}
          className="rounded-xl border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </div>
  )
}
