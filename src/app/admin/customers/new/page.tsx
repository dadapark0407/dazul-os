'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getDefaultBranchId } from '@/lib/branch'

// ─── 상수 ───

const STEPS = ['보호자 정보', '반려견 정보'] as const
const GENDER_OPTIONS = ['남', '여']
const NEUTERED_OPTIONS = ['예', '아니오', '모름']

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

// ─── 반려견 폼 타입 ───

type PetForm = {
  id: string // 로컬 식별자
  name: string
  breed: string
  gender: string
  birthdate: string
  weight: string
  neutered: string
  memo: string
}

function makeEmptyPet(): PetForm {
  return {
    id: Math.random().toString(36).slice(2, 10),
    name: '',
    breed: '',
    gender: '',
    birthdate: '',
    weight: '',
    neutered: '',
    memo: '',
  }
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

  // 2단계: 반려견 (여러 마리)
  const [pets, setPets] = useState<PetForm[]>([makeEmptyPet()])

  function updatePet(id: string, patch: Partial<PetForm>) {
    setPets((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }
  function addPet() {
    setPets((prev) => [...prev, makeEmptyPet()])
  }
  function removePet(id: string) {
    setPets((prev) => (prev.length <= 1 ? prev : prev.filter((p) => p.id !== id)))
  }

  function validateStep(): boolean {
    setError('')
    if (step === 0) {
      if (!gName.trim()) { setError('보호자 이름을 입력해주세요.'); return false }
      if (!gPhone.trim()) { setError('연락처를 입력해주세요.'); return false }
    }
    if (step === 1) {
      for (let i = 0; i < pets.length; i++) {
        const p = pets[i]
        if (!p.name.trim()) { setError(`반려견 ${i + 1} 이름을 입력해주세요.`); return false }
        if (!p.breed.trim()) { setError(`반려견 ${i + 1} 품종을 입력해주세요.`); return false }
        if (!p.gender) { setError(`반려견 ${i + 1} 성별을 선택해주세요.`); return false }
      }
    }
    return true
  }

  function nextStep() {
    if (validateStep()) setStep((s) => Math.min(s + 1, STEPS.length - 1))
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

      // 2) 반려견 여러 마리 저장
      const petPayloads = pets.map((p) => {
        const base: Record<string, unknown> = {
          guardian_id: guardianId,
          name: p.name.trim(),
          breed: p.breed.trim(),
          gender: p.gender || null,
          birthdate: p.birthdate || null,
          memo: p.memo.trim() || null,
          branch_id: branchId,
        }
        if (p.neutered === '예') base.neutered = true
        else if (p.neutered === '아니오') base.neutered = false

        // weight는 pets.weight 컬럼이 없을 수 있으므로 memo에 추가
        if (p.weight.trim()) {
          const weightNote = `체중: ${p.weight.trim()}kg`
          base.memo = base.memo ? `${base.memo}\n${weightNote}` : weightNote
        }
        return base
      })

      const { error: pErr } = await supabase.from('pets').insert(petPayloads)

      if (pErr) {
        setError(`반려견 저장 실패: ${pErr.message}`)
        setSaving(false)
        return
      }

      // 완료 → 보호자 상세 페이지
      router.push(`/admin/guardians/${guardianId}?registered=1`)
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
        <h1 className="mt-2 text-xl font-semibold text-dz-primary">고객 등록</h1>
        <p className="mt-1 text-[12px] text-dz-muted">
          보호자 · 반려견 정보를 등록합니다
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

      {/* ─── 2단계: 반려견 (여러 마리) ─── */}
      {step === 1 && (
        <div className="space-y-4">
          {pets.map((p, i) => (
            <section key={p.id} className="space-y-5 border border-dz-border/50 bg-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-dz-accent">
                  Step 2 — 반려견 {i + 1}
                </h2>
                {pets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePet(p.id)}
                    style={{
                      color: '#8A8A7A',
                      fontSize: 11,
                      letterSpacing: '0.08em',
                      padding: '4px 8px',
                    }}
                    aria-label={`반려견 ${i + 1} 삭제`}
                  >
                    ✕ 삭제
                  </button>
                )}
              </div>

              <Field label="이름" required>
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => updatePet(p.id, { name: e.target.value })}
                  placeholder="반려견 이름"
                  className={inputClass}
                />
              </Field>
              <Field label="품종" required>
                <input
                  type="text"
                  value={p.breed}
                  onChange={(e) => updatePet(p.id, { breed: e.target.value })}
                  placeholder="예: 말티즈, 푸들, 비숑"
                  className={inputClass}
                />
              </Field>
              <Field label="성별" required>
                <ChipSelect
                  options={GENDER_OPTIONS}
                  value={p.gender}
                  onChange={(v) => updatePet(p.id, { gender: v })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="생년월일">
                  <input
                    type="date"
                    value={p.birthdate}
                    onChange={(e) => updatePet(p.id, { birthdate: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="체중 (kg)">
                  <input
                    type="number"
                    step="0.1"
                    value={p.weight}
                    onChange={(e) => updatePet(p.id, { weight: e.target.value })}
                    placeholder="예: 3.5"
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="중성화 여부">
                <ChipSelect
                  options={NEUTERED_OPTIONS}
                  value={p.neutered}
                  onChange={(v) => updatePet(p.id, { neutered: v })}
                />
              </Field>
              <Field label="특이사항 / 알레르기">
                <textarea
                  value={p.memo}
                  onChange={(e) => updatePet(p.id, { memo: e.target.value })}
                  rows={2}
                  placeholder="알레르기, 질환, 주의사항 등"
                  className={textareaClass}
                />
              </Field>
            </section>
          ))}

          <button
            type="button"
            onClick={addPet}
            style={{
              border: '1px solid #C9A96E',
              color: '#C9A96E',
              background: '#FFFFFF',
              borderRadius: 0,
              fontSize: 11,
              letterSpacing: '0.1em',
              padding: '10px 16px',
              width: '100%',
            }}
          >
            + 반려견 추가
          </button>
        </div>
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

        {step < STEPS.length - 1 ? (
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
            {saving ? '저장 중...' : '고객 등록 완료'}
          </button>
        )}
      </div>
    </div>
  )
}
