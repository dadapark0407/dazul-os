'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import CareHistoryTable from './CareHistoryTable'

type R = Record<string, unknown>

type Props = {
  pets: R[]
  records: R[]
  productCategoryMap?: Record<string, string>
  guardianId?: string
  branchId?: string | null
}

function str(obj: R | null | undefined, key: string): string | null {
  if (!obj) return null
  const v = obj[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function num(obj: R | null | undefined, key: string): number | null {
  if (!obj) return null
  const v = obj[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  return null
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

function calculateAge(birthdate?: string | null, birthYear?: number | null): string | null {
  if (birthdate) {
    const d = new Date(birthdate)
    if (!Number.isNaN(d.getTime())) {
      const today = new Date()
      let y = today.getFullYear() - d.getFullYear()
      const m = today.getMonth() - d.getMonth()
      if (m < 0 || (m === 0 && today.getDate() < d.getDate())) y--
      return y >= 0 ? `${y}세` : null
    }
  }
  if (birthYear && Number.isFinite(birthYear)) {
    const y = new Date().getFullYear() - birthYear
    return y >= 0 ? `${y}세` : null
  }
  return null
}

// pets.memo 를 특이사항/알레르기로 복원 — 레거시 '체중: Nkg' 줄은 제거,
// 레거시 '주의사항:' 접두는 본문만 살리고, 나머지는 모두 특이사항으로 표시
function parseCaution(raw: string | null): string | null {
  if (!raw) return null
  const lines = raw.split('\n')
  const out: string[] = []
  for (const line of lines) {
    if (/^체중\s*:\s*[\d.]+\s*kg\s*$/.test(line)) continue
    const c = line.match(/^주의사항\s*:\s*(.*)$/)
    if (c) out.push(c[1].trim())
    else if (line.trim()) out.push(line)
  }
  const text = out.join('\n').trim()
  return text ? text : null
}

export default function GuardianPetTabs({ pets, records, productCategoryMap = {}, guardianId, branchId }: Props) {
  const router = useRouter()
  const [activePetId, setActivePetId] = useState<string | null>(
    pets.length > 0 ? String(pets[0].id) : null
  )

  // ─── 반려견 추가 폼 상태 ───
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [fName, setFName] = useState('')
  const [fBreed, setFBreed] = useState('')
  const [fGender, setFGender] = useState('') // '남' / '여'
  const [fBirthdate, setFBirthdate] = useState('')
  const [fAgeInput, setFAgeInput] = useState('')
  const [fUseAge, setFUseAge] = useState(false)
  const [fNeutered, setFNeutered] = useState('') // '예' / '아니오' / '모름'
  const [fMemo, setFMemo] = useState('')

  function resetForm() {
    setFName('')
    setFBreed('')
    setFGender('')
    setFBirthdate('')
    setFAgeInput('')
    setFUseAge(false)
    setFNeutered('')
    setFMemo('')
    setFormError('')
  }

  async function handleAddPet() {
    if (!guardianId) {
      setFormError('보호자 정보가 없어 저장할 수 없습니다.')
      return
    }
    if (!fName.trim()) {
      setFormError('이름은 필수입니다.')
      return
    }
    setSaving(true)
    setFormError('')

    // 나이 → birth_year (생년월일 모를 때)
    let birthYear: number | null = null
    if (fUseAge && fAgeInput.trim()) {
      const n = parseInt(fAgeInput, 10)
      if (Number.isFinite(n) && n >= 0) birthYear = new Date().getFullYear() - n
    }

    const payload: Record<string, unknown> = {
      guardian_id: guardianId,
      name: fName.trim(),
      breed: fBreed.trim() || null,
      gender: fGender || null,
      birthdate: fUseAge ? null : fBirthdate || null,
      birth_year: birthYear,
      memo: fMemo.trim() || null,
      neutered: fNeutered === '예' ? true : fNeutered === '아니오' ? false : null,
    }
    if (branchId) payload.branch_id = branchId

    const { error } = await supabase.from('pets').insert(payload)

    setSaving(false)

    if (error) {
      setFormError(`저장 실패: ${error.message}`)
      return
    }

    resetForm()
    setAddOpen(false)
    router.refresh()
  }

  const activePet = useMemo(
    () => pets.find((p) => String(p.id) === activePetId) ?? null,
    [pets, activePetId]
  )

  const petRecords = useMemo(
    () => records.filter((r) => String(r.pet_id) === activePetId),
    [records, activePetId]
  )

  if (pets.length === 0) {
    return (
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
        <h2 className="text-lg font-bold text-neutral-900">반려견 케어 히스토리</h2>
        <div className="mt-6 rounded-xl border border-dashed border-neutral-300 py-10 text-center">
          <p className="text-sm text-neutral-500">등록된 반려견이 없습니다.</p>
        </div>
      </section>
    )
  }

  const breed = str(activePet, 'breed')
  const gender = str(activePet, 'gender')
  const neutered = activePet?.neutered
  const neuteredText = neutered === true ? '중성화 완료' : neutered === false ? '중성화 미실시' : null
  const birthdate = str(activePet, 'birthdate')
  const age = calculateAge(birthdate, num(activePet, 'birth_year'))
  const lastVisit = petRecords[0] ? str(petRecords[0], 'visit_date') : null
  const petName = str(activePet, 'name') ?? '이름 없음'
  const petCaution = parseCaution(str(activePet, 'memo'))

  const canAddPet = !!guardianId

  return (
    <section className="space-y-5">
      {/* 반려견 추가 버튼 */}
      {canAddPet && !addOpen && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            style={{
              border: '1px solid #C9A96E',
              color: '#C9A96E',
              background: '#FFFFFF',
              borderRadius: 0,
              fontSize: 11,
              letterSpacing: '0.1em',
              padding: '8px 16px',
              cursor: 'pointer',
            }}
          >
            + 반려견 추가
          </button>
        </div>
      )}

      {/* 인라인 추가 폼 */}
      {canAddPet && addOpen && (
        <div
          style={{
            border: '1px solid #E8E5E0',
            padding: 20,
            background: '#FAFAF8',
          }}
        >
          <p style={{ fontSize: 11, letterSpacing: '0.15em', color: '#8A8A7A', marginBottom: 16 }}>
            반려견 추가
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-neutral-700">
                이름 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={fName}
                onChange={(e) => setFName(e.target.value)}
                placeholder="반려견 이름"
                className="w-full rounded-none border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-700">견종</label>
              <input
                type="text"
                value={fBreed}
                onChange={(e) => setFBreed(e.target.value)}
                placeholder="예: 말티즈"
                className="w-full rounded-none border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-700">성별</label>
              <div className="flex flex-wrap gap-2">
                {['남', '여'].map((opt) => {
                  const active = fGender === opt
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFGender(active ? '' : opt)}
                      style={{
                        border: `1px solid ${active ? '#0A0A0A' : '#E8E5E0'}`,
                        background: active ? '#0A0A0A' : '#FFFFFF',
                        color: active ? '#FFFFFF' : '#6B6B6B',
                        borderRadius: 0,
                        fontSize: 12,
                        letterSpacing: '0.05em',
                        padding: '6px 18px',
                        cursor: 'pointer',
                      }}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-700">
                  {fUseAge ? '나이 (년)' : '생년월일'}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setFUseAge((v) => !v)
                    if (!fUseAge) setFBirthdate('')
                    else setFAgeInput('')
                  }}
                  style={{
                    border: '1px solid #C9A96E',
                    background: '#FFFFFF',
                    color: '#C9A96E',
                    borderRadius: 0,
                    fontSize: 10,
                    letterSpacing: '0.1em',
                    padding: '2px 8px',
                    cursor: 'pointer',
                  }}
                >
                  {fUseAge ? '생년월일' : '나이로'}
                </button>
              </div>
              {fUseAge ? (
                <input
                  type="number"
                  min="0"
                  value={fAgeInput}
                  onChange={(e) => setFAgeInput(e.target.value)}
                  placeholder="예: 3"
                  className="w-full rounded-none border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500"
                />
              ) : (
                <input
                  type="date"
                  value={fBirthdate}
                  onChange={(e) => setFBirthdate(e.target.value)}
                  className="w-full rounded-none border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500"
                />
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-neutral-700">중성화 여부</label>
              <div className="flex flex-wrap gap-2">
                {['예', '아니오', '모름'].map((opt) => {
                  const active = fNeutered === opt
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFNeutered(active ? '' : opt)}
                      style={{
                        border: `1px solid ${active ? '#0A0A0A' : '#E8E5E0'}`,
                        background: active ? '#0A0A0A' : '#FFFFFF',
                        color: active ? '#FFFFFF' : '#6B6B6B',
                        borderRadius: 0,
                        fontSize: 12,
                        letterSpacing: '0.05em',
                        padding: '6px 18px',
                        cursor: 'pointer',
                      }}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-neutral-700">특이사항 / 알레르기</label>
              <textarea
                value={fMemo}
                onChange={(e) => setFMemo(e.target.value)}
                rows={2}
                placeholder="알레르기, 질환, 주의사항 등"
                className="w-full rounded-none border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </div>
          </div>

          {formError && <p className="mt-3 text-xs text-red-600">{formError}</p>}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                resetForm()
                setAddOpen(false)
              }}
              disabled={saving}
              style={{
                border: '1px solid #E8E5E0',
                color: '#8A8A7A',
                background: '#FFFFFF',
                borderRadius: 0,
                fontSize: 11,
                letterSpacing: '0.1em',
                padding: '8px 16px',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleAddPet}
              disabled={saving}
              style={{
                background: '#0A0A0A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 0,
                fontSize: 11,
                letterSpacing: '0.1em',
                padding: '8px 20px',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* 반려견 탭 (2마리 이상일 때) */}
      {pets.length > 1 && (
        <div
          style={{
            display: 'flex',
            gap: 24,
            borderBottom: '1px solid #E8E5E0',
            paddingBottom: 12,
          }}
        >
          {pets.map((p) => {
            const pid = String(p.id)
            const active = pid === activePetId
            return (
              <button
                key={pid}
                type="button"
                onClick={() => setActivePetId(pid)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '4px 0',
                  borderBottom: active ? '1px solid #0A0A0A' : '1px solid transparent',
                  color: active ? '#1A1A1A' : '#8A8A7A',
                  fontWeight: active ? 500 : 300,
                  fontSize: 12,
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
              >
                {str(p, 'name') ?? '이름 없음'}
              </button>
            )
          })}
        </div>
      )}

      {activePet && (
        <div className="space-y-4">
          {/* 반려견 기본 정보 */}
          <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-neutral-900">{petName}</h3>
                <Link
                  href={`/admin/pets/${activePet.id}`}
                  className="text-xs text-neutral-500 hover:text-neutral-700"
                >
                  상세 →
                </Link>
              </div>
              <p className="text-sm text-neutral-500">
                {[
                  breed,
                  age,
                  gender,
                  neuteredText,
                  birthdate ? formatDate(birthdate) : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || '정보 미입력'}
              </p>
              {petCaution && (
                <p className="text-xs" style={{ color: '#C9A96E' }}>
                  ⚠ 주의사항: {petCaution}
                </p>
              )}
              {lastVisit && (
                <p className="text-xs" style={{ color: '#C9A96E' }}>
                  마지막 방문: {formatDate(lastVisit)}
                </p>
              )}
            </div>
          </div>

          {/* 케어 히스토리 테이블 */}
          <CareHistoryTable
            records={petRecords}
            petName={petName}
            productCategoryMap={productCategoryMap}
          />
        </div>
      )}
    </section>
  )
}
