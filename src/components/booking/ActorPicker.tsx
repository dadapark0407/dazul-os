'use client'

// =============================================================
// ActorPicker — "누가 처리했나요?" 모달 (imperative API).
//   pickActor(staff)        → 매번 새로 선택 (등록/취소/삭제)
//   getOrPickActor(staff)   → 세션에 저장된 값 있으면 그대로 반환, 없으면 모달
// =============================================================

import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import { getStaffForActor, type Staff } from '@/lib/booking/actions'
import {
  type SessionActor,
  getSessionActor,
  setSessionActor,
} from '@/lib/booking/actor-client'

type ModalProps = {
  preset: SessionActor | null
  onResolve: (actor: SessionActor | null) => void
}

function ActorPickerModal({ preset, onResolve }: ModalProps) {
  const [open, setOpen] = useState(true)
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getStaffForActor()
      .then((rows) => {
        if (!cancelled) {
          setStaff(rows)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        onResolve(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onResolve])

  if (!open) return null

  function pick(s: Staff) {
    const actor: SessionActor = { staff_id: s.id, staff_name: s.name }
    setSessionActor(actor)
    setOpen(false)
    onResolve(actor)
  }

  function pickUnassigned() {
    const actor: SessionActor = { staff_id: null, staff_name: '미지정' }
    setSessionActor(actor)
    setOpen(false)
    onResolve(actor)
  }

  return (
    <div
      onClick={() => {
        setOpen(false)
        onResolve(null)
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        zIndex: 200,
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
          maxWidth: 360,
          padding: '24px 22px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
        }}
      >
        <p
          style={{
            fontSize: 11,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#8A8A7A',
            textAlign: 'center',
          }}
        >
          PROCESSED BY
        </p>
        <p
          style={{
            marginTop: 8,
            fontSize: 14,
            color: '#1A1A1A',
            textAlign: 'center',
            letterSpacing: '0.02em',
          }}
        >
          누가 처리했나요?
        </p>

        {loading ? (
          <div
            style={{
              marginTop: 20,
              padding: '20px 0',
              textAlign: 'center',
              fontSize: 12,
              color: '#8A8A7A',
              letterSpacing: '0.05em',
            }}
          >
            불러오는 중...
          </div>
        ) : (
          <div
            style={{
              marginTop: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 8,
            }}
          >
            {staff.map((s) => {
              const isPreset = preset?.staff_id === s.id
              const inactive = !s.is_active
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pick(s)}
                  title={inactive ? '비활성 직원' : undefined}
                  style={{
                    height: 44,
                    background: isPreset ? '#C9A96E' : '#FFFFFF',
                    color: isPreset ? '#FFFFFF' : inactive ? '#8A8A7A' : '#1A1A1A',
                    border: '1px solid ' + (isPreset ? '#C9A96E' : '#E8E5E0'),
                    borderRadius: 0,
                    fontSize: 13,
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    fontWeight: isPreset ? 600 : 400,
                    fontStyle: inactive ? 'italic' : 'normal',
                  }}
                >
                  {s.name}
                  {inactive && (
                    <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.7 }}>
                      (비활성)
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <button
          type="button"
          onClick={pickUnassigned}
          style={{
            marginTop: 10,
            width: '100%',
            height: 38,
            background: '#FFFFFF',
            color: '#8A8A7A',
            border: '1px solid #E8E5E0',
            borderRadius: 0,
            fontSize: 12,
            letterSpacing: '0.04em',
            cursor: 'pointer',
          }}
        >
          미지정으로 기록
        </button>

        <button
          type="button"
          onClick={() => {
            setOpen(false)
            onResolve(null)
          }}
          style={{
            marginTop: 8,
            width: '100%',
            height: 32,
            background: 'transparent',
            color: '#8A8A7A',
            border: 'none',
            fontSize: 11,
            letterSpacing: '0.08em',
            cursor: 'pointer',
          }}
        >
          취소
        </button>
      </div>
    </div>
  )
}

/** 매번 새로 선택 — 주요 작업 (등록/취소/삭제) 용. */
export function pickActor(): Promise<SessionActor | null> {
  return mountModal(getSessionActor())
}

/** 세션에 저장된 값이 있으면 그대로 반환, 없으면 모달 — 보조 작업용. */
export function getOrPickActor(): Promise<SessionActor | null> {
  const existing = getSessionActor()
  if (existing) return Promise.resolve(existing)
  return mountModal(null)
}

function mountModal(preset: SessionActor | null): Promise<SessionActor | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null)
      return
    }
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const cleanup = (actor: SessionActor | null) => {
      // 다음 마이크로태스크에 unmount (React 18 권고)
      setTimeout(() => {
        root.unmount()
        container.remove()
      }, 0)
      resolve(actor)
    }
    root.render(<ActorPickerModal preset={preset} onResolve={cleanup} />)
  })
}
