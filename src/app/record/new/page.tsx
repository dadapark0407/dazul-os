'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { VisitRecord } from '@/types/visit'
import { createAutoFollowups } from '@/lib/autoFollowup'

// TODO: 역할 기반 인증 — staff 이상만 접근 가능하도록 제한
// TODO: Supabase RLS — visit_records INSERT 정책 확인 필요
// TODO: 에러 바운더리 래핑 — 네트워크 오류 시 전체 페이지 크래시 방지

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

export default function NewVisitPage() {
  const router = useRouter()

  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [filteredPets, setFilteredPets] = useState<Pet[]>([])

  const [guardianId, setGuardianId] = useState('')
  const [petId, setPetId] = useState('')
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

  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const savingRef = useRef(false) // 이중 제출 방지

  useEffect(() => {
    async function fetchInitialData() {
      const { data: guardiansData } = await supabase
        .from('guardians')
        .select('id, name, phone')
        .order('name')

      const { data: petsData } = await supabase
        .from('pets')
        .select('id, guardian_id, name, breed')
        .order('name')

      setGuardians(guardiansData || [])
      setPets(petsData || [])
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setFormSuccess('')

    // 이중 제출 방지
    if (savingRef.current) return
    savingRef.current = true

    if (!guardianId || !petId || !visitDate) {
      setFormError('보호자, 반려견, 방문일은 필수입니다.')
      savingRef.current = false
      return
    }

    try {
      setLoading(true)

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
        console.error(error)
        setFormError(`저장 중 오류가 발생했어요: ${error.message}`)
        return
      }

      // 자동 팔로업 생성 (실패해도 방문 기록 저장에는 영향 없음)
      const newRecordId = insertedRows?.[0]?.id
      if (newRecordId) {
        try {
          const followupResult = await createAutoFollowups({
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
          if (followupResult.created > 0) {
            console.log(`자동 팔로업 ${followupResult.created}건 생성됨`)
          }
        } catch (e) {
          console.warn('자동 팔로업 생성 중 오류 (무시됨):', e)
        }
      }

      setFormSuccess('방문 기록이 저장되었습니다. 이동 중...')
      router.push(`/pet/${petId}`)
    } catch (error) {
      console.error(error)
      setFormError('저장 중 예상치 못한 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
      savingRef.current = false
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: '40px auto', padding: 20 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>방문 기록 작성</h1>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>기본 정보</h2>

          <label style={labelStyle}>
            보호자
            <select value={guardianId} onChange={(e) => setGuardianId(e.target.value)} style={inputStyle}>
              <option value="">보호자를 선택하세요</option>
              {guardians.map((guardian) => (
                <option key={guardian.id} value={guardian.id}>
                  {guardian.name} {guardian.phone ? `(${guardian.phone})` : ''}
                </option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            반려견
            <select value={petId} onChange={(e) => setPetId(e.target.value)} style={inputStyle}>
              <option value="">반려견을 선택하세요</option>
              {filteredPets.map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name} {pet.breed ? `(${pet.breed})` : ''}
                </option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            방문일
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            서비스
            <input
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              placeholder="예: 미용, 목욕관리, 스파, 팩"
              style={inputStyle}
            />
          </label>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>웰니스 기록</h2>

          <label style={labelStyle}>
            피부 상태
            <input
              value={skinStatus}
              onChange={(e) => setSkinStatus(e.target.value)}
              placeholder="예: 건조, 민감, 각질 있음, 붉음 완화"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            모질 상태
            <input
              value={coatStatus}
              onChange={(e) => setCoatStatus(e.target.value)}
              placeholder="예: 엉킴 있음, 윤기 개선, 정전기 있음"
              style={inputStyle}
            />
          </label>

          <div style={labelStyle}>
            <span>컨디션</span>
            <div style={chipWrapStyle}>
              {CONDITION_OPTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setConditionStatus(item)}
                  style={getChipStyle(conditionStatus === item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div style={labelStyle}>
            <span>스트레스</span>
            <div style={chipWrapStyle}>
              {STRESS_OPTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setStressStatus(item)}
                  style={getChipStyle(stressStatus === item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <label style={labelStyle}>
            특이사항
            <textarea
              value={specialNotes}
              onChange={(e) => setSpecialNotes(e.target.value)}
              placeholder="예: 귀 청소 민감, 뒷다리 터치 예민, 피부 붉은 부위 체크"
              style={textareaStyle}
            />
          </label>

          <label style={labelStyle}>
            다음 방문 추천
            <textarea
              value={nextVisitRecommendation}
              onChange={(e) => setNextVisitRecommendation(e.target.value)}
              placeholder="예: 3주 뒤 목욕관리 + 보습 케어 추천"
              style={textareaStyle}
            />
          </label>

          <label style={labelStyle}>
            오늘 케어 요약
            <textarea
              value={careSummary}
              onChange={(e) => setCareSummary(e.target.value)}
              placeholder="예: 목욕 + 손질, 피부 보습 집중 케어"
              style={textareaStyle}
            />
          </label>

          <label style={labelStyle}>
            진행한 케어 내용
            <textarea
              value={careActions}
              onChange={(e) => setCareActions(e.target.value)}
              placeholder="예: 샴푸, 트리트먼트, 발 마사지"
              style={textareaStyle}
            />
          </label>

          <label style={labelStyle}>
            문제 → 조치
            <textarea
              value={careNotes}
              onChange={(e) => setCareNotes(e.target.value)}
              placeholder="예: 털 엉킴 → 브러시 제거, 피부 건조 → 보습제 적용"
              style={textareaStyle}
            />
          </label>

          <label style={labelStyle}>
            다음 케어 가이드
            <textarea
              value={nextCareGuide}
              onChange={(e) => setNextCareGuide(e.target.value)}
              placeholder="예: 2주 뒤 재방문 시 물광 케어 추천"
              style={textareaStyle}
            />
          </label>

          <label style={labelStyle}>
            자유 메모
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="기존 note 자유 입력"
              style={textareaStyle}
            />
          </label>
        </section>

        {formError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', fontSize: 14, color: '#dc2626' }}>
            {formError}
          </div>
        )}
        {formSuccess && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', fontSize: 14, color: '#16a34a' }}>
            {formSuccess}
          </div>
        )}

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? '저장 중...' : '저장하기'}
        </button>
      </form>
    </main>
  )
}

function getChipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '10px 14px',
    borderRadius: 999,
    border: active ? '1px solid #111827' : '1px solid #d1d5db',
    background: active ? '#111827' : '#ffffff',
    color: active ? '#ffffff' : '#111827',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  }
}

const sectionStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 20,
  display: 'grid',
  gap: 14,
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  marginBottom: 8,
}

const labelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  fontWeight: 600,
}

const chipWrapStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
}

const inputStyle: React.CSSProperties = {
  height: 44,
  border: '1px solid #d1d5db',
  borderRadius: 10,
  padding: '0 12px',
  fontSize: 14,
}

const textareaStyle: React.CSSProperties = {
  minHeight: 100,
  border: '1px solid #d1d5db',
  borderRadius: 10,
  padding: 12,
  fontSize: 14,
}

const buttonStyle: React.CSSProperties = {
  height: 48,
  border: 'none',
  borderRadius: 10,
  background: '#111827',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
}