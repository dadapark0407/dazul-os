'use client'

// =============================================================
// 사이드 패널 오버레이 — 토글 버튼 + 백드롭 + 슬라이드 드로어
// =============================================================
// AdminLayout 헤더(52px, z-30) 아래에 토글 버튼을 띄움.
// 드로어는 우측에서 슬라이드 인 (transform 0.2s).
// 콘텐츠는 DailySidePanel 재사용.
// =============================================================

import { useState } from 'react'
import DailySidePanel from './DailySidePanel'
import type { Staff, Appointment } from '@/lib/booking/actions'

type Props = {
  date: string
  staff: Staff[]
  appointments?: Appointment[]
  mode?: 'daily' | 'monthly'
}

export default function SidePanelOverlay({
  date,
  staff,
  appointments,
  mode = 'daily',
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* 토글 버튼 — AdminLayout 헤더(52px) 아래에 배치 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="사이드 패널 열기/닫기"
        title="사이드 패널"
        style={{
          position: 'fixed',
          top: 64,
          right: 16,
          width: 40,
          height: 40,
          background: open ? '#1A1A1A' : '#FFFFFF',
          color: open ? '#FFFFFF' : '#1A1A1A',
          border: '1px solid #E8E5E0',
          borderRadius: 0,
          cursor: 'pointer',
          zIndex: 70,
          fontSize: 18,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'inherit',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        {open ? '×' : '📝'}
      </button>

      {/* 백드롭 — 클릭 시 닫힘 */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 60,
          }}
        />
      )}

      {/* 드로어 — 우측 슬라이드 */}
      <aside
        onClick={(e) => e.stopPropagation()}
        aria-hidden={!open}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 260,
          background: '#FAFAF8',
          borderLeft: '1px solid #E8E5E0',
          borderRadius: 0,
          zIndex: 65,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.2s ease',
          overflowY: 'auto',
          padding: '116px 16px 16px',
          boxSizing: 'border-box',
        }}
      >
        <DailySidePanel
          date={date}
          staff={staff}
          appointments={appointments}
          mode={mode}
        />
      </aside>
    </>
  )
}
