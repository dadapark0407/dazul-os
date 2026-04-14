'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getDefaultBranchId } from '@/lib/branch'

// ─── 상수 ───

const STEPS = ['보호자 정보', '반려견 정보', '첫 방문 기록'] as const
const GENDER_OPTIONS = ['남', '여']
const NEUTERED_OPTIONS = ['예', '아니오', '모름']
const CONDITION_OPTIONS = ['안정', '예민', '피곤', '활발']
const STRESS_OPTIONS = ['낮음', '보통', '높음']

function today() {
  return new Date().toISOString().slice(0, 10)
}

// ─── 스텝 인디케이터 ───

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`flex h-6 w-6 items-center justify-center text-[10px] font-medium transition-all duration-400 ${
                i === current
                  ? 'bg-dz-primary text-white'
                  : i < current
                    ? 'bg-dz-accent/20 text-dz-accent'
                    : 'bg-dz-border/40 text-dz-muted/50'
              }`}
            >
              {i < current ? '✓' : i + 1}
            </span>
            <span
              className={`hidden text-[11px] sm:inline ${
                i === current ? 'text-dz-primary' : 'text-dz-muted/50'
              }`}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-px w-6 ${i < current ? 'bg-dz-accent/40' : 'bg-dz-border/40'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── 인풋 컴포넌트 ───

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.1em] text-dz-muted">
        {label}
        {required && <span className="ml-0.5 text-dz-accent">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full border-b border-dz-border bg-transparent px-0 py-2.5 text-sm text-dz-primary outline-none transition-all duration-400 placeholder:text-dz-border focus:border-dz-primary'
const textareaClass =
  'w-full border border-dz-border bg-transparent px-3 py-2.5 text-sm text-dz-primary outline-none transition-all duration-400 placeholder:text-dz-border focus:border-dz-primary'

function ChipSelect({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(value === opt ? '' : opt)}
          className={`border px-3 py-1.5 text-[12px] font-medium transition-all duration-400 ${
            value === opt
              ? 'border-dz-primary bg-dz-primary text-white'
              : 'border-dz-border text-dz-muted hover:border-dz-muted'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

// ─── 메인 ───

export default function NewCustomerPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 1단계: 보호자
  const [gName, setGName] = useState('')
  const [gPhone, setGPhone] = useState('')
  const [gMemo, setGMemo] = useState('')

  // 2단계: 반려견
  const [pName, setPName] = useState('')
  const [pBreed, setPBreed] = useState('')
  const [pGender, setPGender] = useState('')
  const [pBirthdate, setPBirthdate] = useState('')
  const [pWeight, setPWeight] = useState('')
  const [pNeutered, setPNeutered] = useState('')
  const [pMemo, setPMemo] = useState('')

  // 3단계: 첫 방문
  const [vDate, setVDate] = useState(today())
  const [vService, setVService] = useState('')
  const [vSkin, setVSkin] = useState('')
  const [vCoat, setVCoat] = useState('')
  const [vCondition, setVCondition] = useState('')
  const [vStress, setVStress] = useState('')
  const [vCareSummary, setVCareSummary] = useState('')
  const [vSpecial, setVSpecial] = useState('')
  const [vNextVisit, setVNextVisit] = useState('')
  const [vNote, setVNote] = useState('')

  function validateStep(): boolean {
    setError('')
    if (step === 0) {
      if (!gName.trim()) { setError('보호자 이름을 입력해주세요.'); return false }
      if (!gPhone.trim()) { setError('연락처를 입력해주세요.'); return false }
    }
    if (step === 1) {
      if (!pName.trim()) { setError('반려견 이름을 입력해주세요.'); return false }
      if (!pBreed.trim()) { setError('품종을 입력해주세요.'); return false }
      if (!pGender) { setError('성별을 선택해주세요.'); return false }
    }
    if (step === 2) {
      if (!vDate) { setError('방문일을 입력해주세요.'); return false }
      if (!vService.trim()) { setError('서비스 종류를 입력해주세요.'); return false }
    }
    return true
  }

  function nextStep() {
    if (validateStep()) setStep((s) => Math.min(s + 1, 2))
  }

  function prevStep() {
    setError('')
    setStep((s) => Math.max(s - 1, 0))
  }

  async function handleSave() {
    if (!validateStep()) return
    setSaving(true)
    setError('')

    try {
      const branchId = await getDefaultBranchId()

      // 1) 보호자 저장
      const { data: guardianData, error: gErr } = await supabase
        .from('guardians')
        .insert({
          name: gName.trim(),
          phone: gPhone.trim(),
          memo: gMemo.trim() || null,
          branch_id: branchId,
        })
        .select('id')
        .single()

      if (gErr || !guardianData) {
        setError(`보호자 저장 실패: ${gErr?.message ?? '알 수 없는 오류'}`)
        setSaving(false)
        return
      }

      const guardianId = guardianData.id

      // 2) 반려견 저장
      const petPayload: Record<string, unknown> = {
        guardian_id: guardianId,
        name: pName.trim(),
        breed: pBreed.trim(),
        gender: pGender || null,
        birthdate: pBirthdate || null,
        memo: pMemo.trim() || null,
        branch_id: branchId,
      }
      // neutered: DB에 컬럼이 있으면 저장
      if (pNeutered === '예') petPayload.neutered = true
      else if (pNeutered === '아니오') petPayload.neutered = false

      // weight: pets 테이블에 weight 컬럼이 없을 수 있으므로 memo에 추가
      if (pWeight.trim()) {
        const weightNote = `체중: ${pWeight.trim()}kg`
        petPayload.memo = petPayload.memo
          ? `${petPayload.memo}\n${weightNote}`
          : weightNote
      }

      const { data: petData, error: pErr } = await supabase
        .from('pets')
        .insert(petPayload)
        .select('id')
        .single()

      if (pErr || !petData) {
        setError(`반려견 저장 실패: ${pErr?.message ?? '알 수 없는 오류'}`)
        setSaving(false)
        return
      }

      const petId = petData.id

      // 3) 첫 방문 기록 저장
      const visitPayload: Record<string, unknown> = {
        pet_id: petId,
        guardian_id: guardianId,
        pet_name: pName.trim(),
        guardian_name: gName.trim(),
        visit_date: vDate,
        service_type: vService.trim(),
        skin_status: vSkin || null,
        coat_status: vCoat || null,
        condition_status: vCondition || null,
        stress_status: vStress || null,
        care_summary: vCareSummary.trim() || null,
        special_notes: vSpecial.trim() || null,
        next_visit_recommendation: vNextVisit.trim() || null,
        note: vNote.trim() || null,
      }

      const { error: vErr } = await supabase
        .from('visit_records')
        .insert(visitPayload)

      if (vErr) {
        setError(`방문 기록 저장 실패: ${vErr.message}`)
        setSaving(false)
        return
      }

      // 완료 → 보호자 상세 페이지
      router.push(`/admin/guardians/${guardianId}`)
    } catch (e) {
      setError(`저장 중 오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`)
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      {/* 헤더 */}
      <div>
        <Link
          href="/admin"
          className="text-[11px] tracking-[0.1em] text-dz-muted transition-all duration-400 hover:text-dz-primary"
        >
          ← 대시보드
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-dz-primary">신규 고객 등록</h1>
        <p className="mt-1 text-[12px] text-dz-muted">
          보호자 · 반려견 · 첫 방문 기록을 한 번에 등록합니다
        </p>
      </div>

      <StepIndicator current={step} />

      {/* ─── 1단계: 보호자 ─── */}
      {step === 0 && (
        <section className="space-y-5 border border-dz-border/50 bg-white p-6">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-dz-accent">
            Step 1 — 보호자 정보
          </h2>
          <Field label="이름" required>
            <input
              type="text"
              value={gName}
              onChange={(e) => setGName(e.target.value)}
              placeholder="보호자 이름"
              className={inputClass}
            />
          </Field>
          <Field label="연락처" required>
            <input
              type="tel"
              value={gPhone}
              onChange={(e) => setGPhone(e.target.value)}
              placeholder="010-0000-0000"
              className={inputClass}
            />
          </Field>
          <Field label="메모">
            <textarea
              value={gMemo}
              onChange={(e) => setGMemo(e.target.value)}
              rows={2}
              placeholder="특이사항, 선호 사항 등"
              className={textareaClass}
            />
          </Field>
        </section>
      )}

      {/* ─── 2단계: 반려견 ─── */}
      {step === 1 && (
        <section className="space-y-5 border border-dz-border/50 bg-white p-6">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-dz-accent">
            Step 2 — 반려견 정보
          </h2>
          <Field label="이름" required>
            <input
              type="text"
              value={pName}
              onChange={(e) => setPName(e.target.value)}
              placeholder="반려견 이름"
              className={inputClass}
            />
          </Field>
          <Field label="품종" required>
            <input
              type="text"
              value={pBreed}
              onChange={(e) => setPBreed(e.target.value)}
              placeholder="예: 말티즈, 푸들, 비숑"
              className={inputClass}
            />
          </Field>
          <Field label="성별" required>
            <ChipSelect options={GENDER_OPTIONS} value={pGender} onChange={setPGender} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="생년월일">
              <input
                type="date"
                value={pBirthdate}
                onChange={(e) => setPBirthdate(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="체중 (kg)">
              <input
                type="number"
                step="0.1"
                value={pWeight}
                onChange={(e) => setPWeight(e.target.value)}
                placeholder="예: 3.5"
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="중성화 여부">
            <ChipSelect options={NEUTERED_OPTIONS} value={pNeutered} onChange={setPNeutered} />
          </Field>
          <Field label="특이사항 / 알레르기">
            <textarea
              value={pMemo}
              onChange={(e) => setPMemo(e.target.value)}
              rows={2}
              placeholder="알레르기, 질환, 주의사항 등"
              className={textareaClass}
            />
          </Field>
        </section>
      )}

      {/* ─── 3단계: 첫 방문 ─── */}
      {step === 2 && (
        <section className="space-y-5 border border-dz-border/50 bg-white p-6">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-dz-accent">
            Step 3 — 첫 방문 기록
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="방문일" required>
              <input
                type="date"
                value={vDate}
                onChange={(e) => setVDate(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="서비스 종류" required>
              <input
                type="text"
                value={vService}
                onChange={(e) => setVService(e.target.value)}
                placeholder="예: 미용, 목욕관리"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="피부 상태">
              <input
                type="text"
                value={vSkin}
                onChange={(e) => setVSkin(e.target.value)}
                placeholder="예: 양호, 건조"
                className={inputClass}
              />
            </Field>
            <Field label="모질 상태">
              <input
                type="text"
                value={vCoat}
                onChange={(e) => setVCoat(e.target.value)}
                placeholder="예: 양호, 엉킴"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="컨디션">
            <ChipSelect options={CONDITION_OPTIONS} value={vCondition} onChange={setVCondition} />
          </Field>
          <Field label="스트레스">
            <ChipSelect options={STRESS_OPTIONS} value={vStress} onChange={setVStress} />
          </Field>

          <Field label="케어 요약">
            <textarea
              value={vCareSummary}
              onChange={(e) => setVCareSummary(e.target.value)}
              rows={2}
              placeholder="오늘 진행한 케어 내용"
              className={textareaClass}
            />
          </Field>
          <Field label="특이사항">
            <textarea
              value={vSpecial}
              onChange={(e) => setVSpecial(e.target.value)}
              rows={2}
              placeholder="민감 부위, 행동 특이점 등"
              className={textareaClass}
            />
          </Field>
          <Field label="다음 방문 추천">
            <input
              type="text"
              value={vNextVisit}
              onChange={(e) => setVNextVisit(e.target.value)}
              placeholder="예: 3주 뒤 목욕관리 추천"
              className={inputClass}
            />
          </Field>
          <Field label="메모">
            <textarea
              value={vNote}
              onChange={(e) => setVNote(e.target.value)}
              rows={2}
              placeholder="기타 메모"
              className={textareaClass}
            />
          </Field>
        </section>
      )}

      {/* 에러 */}
      {error && (
        <p className="text-xs text-red-600/80">{error}</p>
      )}

      {/* 네비게이션 버튼 */}
      <div className="flex justify-between">
        {step > 0 ? (
          <button
            type="button"
            onClick={prevStep}
            className="border border-dz-border px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-dz-muted transition-all duration-400 hover:border-dz-primary hover:text-dz-primary"
          >
            이전
          </button>
        ) : (
          <div />
        )}

        {step < 2 ? (
          <button
            type="button"
            onClick={nextStep}
            className="bg-dz-primary px-6 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition-all duration-400 hover:bg-dz-primary/85"
          >
            다음
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-dz-primary px-6 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-white transition-all duration-400 hover:bg-dz-primary/85 disabled:opacity-40"
          >
            {saving ? '저장 중...' : '등록 완료'}
          </button>
        )}
      </div>
    </div>
  )
}
