'use client'

// =============================================================
// 반려견 보호자 이전 모달 — 보호자 검색 → 대상 선택 → 확인
// =============================================================

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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

export default function PetTransferModal({ open, onClose, petId, petName, guardianId }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GuardianOption[]>([])
  const [searched, setSearched] = useState(false)
  const [selected, setSelected] = useState<GuardianOption | null>(null)
  const [preview, setPreview] = useState<TransferPreview | null>(null)
  const [error, setError] = useState('')
  const [searching, startSearch] = useTransition()
  const [pending, startTransfer] = useTransition()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const searchSeq = useRef(0)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setResults([])
    setSearched(false)
    setSelected(null)
    setError('')
    setPreview(null)
    getTransferPreview(petId).then(setPreview).catch(() => setPreview(null))
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [open, petId])

  // 입력 후 잠시 멈추면 검색
  useEffect(() => {
    if (!open || selected) return
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
  }, [query, open, selected, guardianId])

  function confirm() {
    if (!selected || pending) return
    setError('')
    startTransfer(async () => {
      const res = await transferPet(petId, guardianId, selected.id)
      if (res.ok) {
        onClose()
        router.refresh()
      } else {
        setError(res.error)
        router.refresh()
      }
    })
  }

  if (!open) return null

  return (
    <div
      onClick={pending ? undefined : onClose}
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

        {!selected ? (
          <>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="보호자 이름 또는 연락처"
              style={{
                width: '100%',
                border: '1px solid #E8E5E0',
                borderRadius: 0,
                background: '#FFFFFF',
                padding: '10px 12px',
                fontSize: 14,
                outline: 'none',
              }}
            />

            <div style={{ marginTop: 12, maxHeight: 280, overflowY: 'auto' }}>
              {searching && results.length === 0 && (
                <p style={{ fontSize: 12, color: '#8A8A7A', padding: '8px 0' }}>검색 중...</p>
              )}
              {results.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelected(g)}
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
                <p style={{ fontSize: 12, color: '#8A8A7A', lineHeight: 1.6, padding: '8px 0' }}>
                  검색된 보호자가 없습니다.
                  <br />
                  새 보호자라면 보호자 등록을 먼저 하고 다시 이전해 주세요.
                </p>
              )}
            </div>

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose} style={textButton}>
                취소
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ borderLeft: '2px solid #C9A96E', padding: '4px 0 4px 14px' }}>
              <p style={{ fontSize: 14, color: '#1A1A1A', lineHeight: 1.7 }}>
                {petName}을(를) {selected.name}님께 이전합니다.
              </p>
              <p style={{ fontSize: 12, color: '#6B6B6B', lineHeight: 1.7, marginTop: 4 }}>
                케어 이력은 반려견과 함께 {selected.name}님 리포트로 이동하며,
                <br />
                예정된 예약과 정기 스케줄도 함께 이전됩니다.
              </p>
            </div>

            <p style={{ fontSize: 11, letterSpacing: '0.05em', color: '#8A8A7A', marginTop: 16 }}>
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
                onClick={() => (error ? onClose() : setSelected(null))}
                disabled={pending}
                style={textButton}
              >
                {error ? '닫기' : '다시 선택'}
              </button>
              {!error && (
                <button
                  type="button"
                  onClick={confirm}
                  disabled={pending}
                  style={{
                    background: '#0A0A0A',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 0,
                    fontSize: 11,
                    letterSpacing: '0.1em',
                    padding: '8px 20px',
                    cursor: pending ? 'not-allowed' : 'pointer',
                    opacity: pending ? 0.6 : 1,
                  }}
                >
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
