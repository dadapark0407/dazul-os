'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import CareHistoryTable from './CareHistoryTable'

type R = Record<string, unknown>

type Props = {
  pets: R[]
  records: R[]
  productCategoryMap?: Record<string, string>
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

export default function GuardianPetTabs({ pets, records, productCategoryMap = {} }: Props) {
  const [activePetId, setActivePetId] = useState<string | null>(
    pets.length > 0 ? String(pets[0].id) : null
  )

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
  const age = calculateAge(str(activePet, 'birthdate'), num(activePet, 'birth_year'))
  const lastVisit = petRecords[0] ? str(petRecords[0], 'visit_date') : null
  const petName = str(activePet, 'name') ?? '이름 없음'

  return (
    <section className="space-y-5">
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
                {[breed, age, gender, neuteredText].filter(Boolean).join(' · ') || '정보 미입력'}
              </p>
              {lastVisit && (
                <p className="text-xs" style={{ color: '#C9A96E' }}>
                  마지막 방문: {formatDate(lastVisit)}
                </p>
              )}
            </div>
            <Link
              href={`/session/new?petId=${activePet.id}`}
              className="shrink-0 rounded-xl bg-neutral-900 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-neutral-700"
            >
              케어 기록 작성
            </Link>
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
