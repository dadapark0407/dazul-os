'use client'

// =============================================================
// 반려견 보호자 이전 모달
//   기존 보호자: 검색 → 대상 선택 → 확인
//   신규 보호자: 이름·연락처 입력 → 확인 → 보호자 생성 → 이전
// =============================================================

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getDefaultBranchId } from '@/lib/branch'
import { formatPhone } from '@/lib/phone'
import {
  getTransferPreview,
  searchTransferGuardians,
  transferPet,
  type GuardianOption,
  type TransferPreview,
} from '@/actions/transferPet'

type Props = {
  open: boolean
  onClose: () => void
  petId: string
  petName: string
  guardianId: string
}

type Mode = 'search' | 'new' | 'confirm'
type NewGuardian = { name: string; phone: string }
type PhoneMatch = { id: string; name: string; phone: string | null }

const textButton: React.CSSProperties = {
  border: '1px solid #E8E5E0',
  color: '#8A8A7A',
  background: '#FFFFFF',
  borderRadius: 0,
  fontSize: 11,
  letterSpacing: '0.1em',
  padding: '8px 16px',
  cursor: 'pointer',
}

const primaryButton = (busy: boolean): React.CSSProperties => ({
  background: '#0A0A0A',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: 0,
  fontSize: 11,
  letterSpacing: '0.1em',
  padding: '8px 20px',
  cursor: busy ? 'not-allowed' : 'pointer',
  opacity: busy ? 0.6 : 1,
})

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #E8E5E0',
  borderRadius: 0,
  background: '#FFFFFF',
  padding: '10px 12px',
  fontSize: 14,
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  letterSpacing: '0.1em',
  color: '#8A8A7A',
  marginBottom: 6,
}

/** 같은 연락처의 기존 보호자 — DB에 하이픈 유무가 섞여 있어 두 형식 모두 비교 */
async function findGuardianByPhone(phone: string): Promise<PhoneMatch | null> {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  const formats = Array.from(new Set([digits, formatPhone(digits)]))
  const { data } = await supabase
    .from('guardians')
    .select('id, name, phone')
    .in('phone', formats)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()
  return data ? { id: data.id, name: data.name ?? '이름 없음', phone: data.phone ?? null } : null
}

export default function PetTransferModal({ open, onClose, petId, petName, guardianId }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GuardianOption[]>([])
  const [searched, setSearched] = useState(false)
  const [selected, setSelected] = useState<GuardianOption | null>(null)
  const [newGuardian, setNewGuardian] = useState<NewGuardian | null>(null)
  const [nName, setNName] = useState('')
  const [nPhone, setNPhone] = useState('')
  const [phoneMatch, setPhoneMatch] = useState<PhoneMatch | null>(null)
  const [preview, setPreview] = useState<TransferPreview | null>(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false) // 일부라도 반영된 뒤의 오류 → 닫기만 허용
  const [searching, startSearch] = useTransition()
  const [checking, startCheck] = useTransition()
  const [pending, startTransfer] = useTransition()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const searchSeq = useRef(0)

  useEffect(() => {
    if (!open) return
    setMode('search')
    setQuery('')
    setResults([])
    setSearched(false)
    setSelected(null)
    setNewGuardian(null)
    setNName('')
    setNPhone('')
    setPhoneMatch(null)
    setError('')
    setDone(false)
    setPreview(null)
    getTransferPreview(petId).then(setPreview).catch(() => setPreview(null))
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [open, petId])

  // 입력 후 잠시 멈추면 검색
  useEffect(() => {
    if (!open || mode !== 'search') return
    const q = query.trim()
    if (!q) {
      setResults([])
      setSearched(false)
      return
    }
    const seq = ++searchSeq.current
    const t = setTimeout(() => {
      startSearch(async () => {
        const rows = await searchTransferGuardians(q, guardianId)
        if (seq !== searchSeq.current) return
        setResults(rows)
        setSearched(true)
      })
    }, 250)
    return () => clearTimeout(t)
  }, [query, open, mode, guardianId])

  function pickExisting(g: GuardianOption) {
    setSelected(g)
    setNewGuardian(null)
    setError('')
    setMode('confirm')
  }

  function openNewForm() {
    // 검색어가 이름/연락처처럼 보이면 미리 채워 입력 줄이기
    const q = query.trim()
    const digits = q.replace(/\D/g, '')
    setNName(digits.length >= 3 ? '' : q)
    setNPhone(digits.length >= 3 ? formatPhone(digits) : '')
    setPhoneMatch(null)
    setError('')
    setMode('new')
  }

  function submitNewForm() {
    if (checking) return
    setError('')
    setPhoneMatch(null)
    if (!nName.trim()) { setError('보호자 이름을 입력해주세요.'); return }
    if (!nPhone.trim()) { setError('연락처를 입력해주세요.'); return }
    startCheck(async () => {
      const match = await findGuardianByPhone(nPhone)
      if (match) {
        setPhoneMatch(match)
        return
      }
      setSelected(null)
      setNewGuardian({ name: nName.trim(), phone: nPhone.trim() })
      setMode('confirm')
    })
  }

  function selectPhoneMatch(m: PhoneMatch) {
    pickExisting({ id: m.id, name: m.name, phone: m.phone, petNames: [] })
  }

  function confirm() {
    if (pending || (!selected && !newGuardian)) return
    setError('')
    startTransfer(async () => {
      let targetId = selected?.id ?? null

      // 신규 보호자 생성 — 고객 등록(admin/customers/new)과 같은 필드·클라이언트.
      // share_token 은 DB 트리거(trigger_set_guardian_share_token)가 생성.
      if (newGuardian) {
        const dup = await findGuardianByPhone(newGuardian.phone)
        if (dup) {
          setPhoneMatch(dup)
          setMode('new')
          return
        }
        const branchId = await getDefaultBranchId()
        const { data: created, error: gErr } = await supabase
          .from('guardians')
          .insert({
            name: newGuardian.name,
            phone: newGuardian.phone,
            memo: null,
            branch_id: branchId,
          })
          .select('id')
          .single()
        if (gErr || !created) {
          setError(`보호자 생성 실패: ${gErr?.message ?? '알 수 없는 오류'}\n변경된 내용은 없습니다.`)
          return
        }
        targetId = created.id
      }
      if (!targetId) return

      const res = await transferPet(petId, guardianId, targetId)
      if (res.ok) {
        onClose()
        router.refresh()
        return
      }
      setDone(true)
      setError(newGuardian ? `보호자는 생성됨, 이전 실패\n${res.error}` : res.error)
      router.refresh()
    })
  }

  if (!open) return null

  const targetName = selected?.name ?? newGuardian?.name ?? ''
  const busy = pending || checking

  return (
    <div
      onClick={busy ? undefined : onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FAFAF8',
          border: '1px solid #E8E5E0',
          borderRadius: 0,
          width: '100%',
          maxWidth: 420,
          padding: '28px 24px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
        }}
      >
        <p
          style={{
            fontSize: 11,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#C9A96E',
            marginBottom: 6,
          }}
        >
          Transfer Guardian
        </p>
        <p style={{ fontSize: 16, fontWeight: 500, color: '#1A1A1A', marginBottom: 4 }}>보호자 이전</p>
        <p style={{ fontSize: 12, color: '#8A8A7A', marginBottom: 20 }}>{petName}</p>

        {mode === 'search' && (
          <>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="보호자 이름 또는 연락처"
              style={inputStyle}
            />

            <div style={{ marginTop: 12, maxHeight: 280, overflowY: 'auto' }}>
              {searching && results.length === 0 && (
                <p style={{ fontSize: 12, color: '#8A8A7A', padding: '8px 0' }}>검색 중...</p>
              )}
              {results.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => pickExisting(g)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: '#FFFFFF',
                    border: '1px solid #E8E5E0',
                    borderRadius: 0,
                    padding: '12px 14px',
                    marginBottom: -1,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 14, color: '#1A1A1A' }}>{g.name}</span>
                  {g.phone && (
                    <span style={{ fontSize: 12, color: '#8A8A7A', marginLeft: 8 }}>{formatPhone(g.phone)}</span>
                  )}
                  {g.petNames.length > 0 && (
                    <span style={{ display: 'block', fontSize: 11, color: '#8A8A7A', marginTop: 2 }}>
                      {g.petNames.join(', ')}
                    </span>
                  )}
                </button>
              ))}
              {searched && !searching && results.length === 0 && (
                <p style={{ fontSize: 12, color: '#8A8A7A', padding: '8px 0' }}>검색된 보호자가 없습니다.</p>
              )}
            </div>

            {/* 신규 보호자 — 검색 결과와 무관하게 항상 표시 */}
            <button
              type="button"
              onClick={openNewForm}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'transparent',
                border: '1px dashed #C9A96E',
                borderRadius: 0,
                padding: '12px 14px',
                marginTop: 12,
                fontSize: 13,
                color: '#C9A96E',
                letterSpacing: '0.05em',
                cursor: 'pointer',
              }}
            >
              + 신규 보호자로 등록 후 이전
            </button>

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose} style={textButton}>
                취소
              </button>
            </div>
          </>
        )}

        {mode === 'new' && (
          <>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={labelStyle}>보호자 이름</label>
                <input
                  type="text"
                  value={nName}
                  onChange={(e) => setNName(e.target.value)}
                  placeholder="이름"
                  autoFocus
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>연락처</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={nPhone}
                  onChange={(e) => {
                    setNPhone(formatPhone(e.target.value))
                    setPhoneMatch(null)
                  }}
                  placeholder="010-0000-0000"
                  style={inputStyle}
                />
              </div>
            </div>

            {phoneMatch && (
              <div style={{ borderLeft: '2px solid #C9A96E', padding: '4px 0 4px 14px', marginTop: 16 }}>
                <p style={{ fontSize: 12, color: '#1A1A1A', lineHeight: 1.6 }}>
                  이미 등록된 연락처입니다 — {phoneMatch.name}
                </p>
                {phoneMatch.id === guardianId ? (
                  <p style={{ fontSize: 11, color: '#8A8A7A', marginTop: 4 }}>현재 보호자의 연락처입니다.</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => selectPhoneMatch(phoneMatch)}
                    style={{ ...textButton, marginTop: 8, color: '#C9A96E', borderColor: '#C9A96E' }}
                  >
                    {phoneMatch.name}님 선택
                  </button>
                )}
              </div>
            )}

            {error && (
              <p style={{ fontSize: 12, color: '#B54A3C', marginTop: 12, whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                {error}
              </p>
            )}

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setError('')
                  setPhoneMatch(null)
                  setMode('search')
                }}
                disabled={checking}
                style={textButton}
              >
                뒤로
              </button>
              <button type="button" onClick={submitNewForm} disabled={checking} style={primaryButton(checking)}>
                {checking ? '확인 중...' : '다음'}
              </button>
            </div>
          </>
        )}

        {mode === 'confirm' && (
          <>
            <div style={{ borderLeft: '2px solid #C9A96E', padding: '4px 0 4px 14px' }}>
              <p style={{ fontSize: 14, color: '#1A1A1A', lineHeight: 1.7 }}>
                {petName}을(를) {targetName}님께 이전합니다.
              </p>
              <p style={{ fontSize: 12, color: '#6B6B6B', lineHeight: 1.7, marginTop: 4 }}>
                케어 이력은 반려견과 함께 {targetName}님 리포트로 이동하며,
                <br />
                예정된 예약과 정기 스케줄도 함께 이전됩니다.
              </p>
            </div>

            {newGuardian && (
              <p style={{ fontSize: 11, color: '#8A8A7A', marginTop: 12 }}>
                신규 보호자 등록 · {newGuardian.name} · {newGuardian.phone}
              </p>
            )}

            <p style={{ fontSize: 11, letterSpacing: '0.05em', color: '#8A8A7A', marginTop: newGuardian ? 4 : 16 }}>
              {preview
                ? `예정 예약 ${preview.appointments}건 · 정기 스케줄 ${preview.schedules}건 함께 이전`
                : '이전 대상 확인 중...'}
            </p>

            {error && (
              <p style={{ fontSize: 12, color: '#B54A3C', marginTop: 12, whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                {error}
              </p>
            )}

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  if (done) return onClose()
                  setError('')
                  setMode(newGuardian ? 'new' : 'search')
                }}
                disabled={pending}
                style={textButton}
              >
                {done ? '닫기' : newGuardian ? '뒤로' : '다시 선택'}
              </button>
              {!done && (
                <button type="button" onClick={confirm} disabled={pending} style={primaryButton(pending)}>
                  {pending ? '이전 중...' : '이전'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
